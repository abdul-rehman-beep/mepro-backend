import path from 'node:path';
import fs from 'node:fs';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * Thin wrapper around @huggingface/transformers.
 *
 * Design goals, in priority order (see docs/AI.md):
 *   1. The API must never depend on inference succeeding.
 *   2. Model load happens once, lazily, off the request path where possible.
 *   3. Every call is bounded by a timeout so a slow CPU cannot hang a request.
 *   4. If the model or the network is unavailable, `isAvailable()` returns false
 *      and callers use the deterministic rule engine instead.
 */

export interface ModelStatus {
  configured: boolean;
  available: boolean;
  loaded: boolean;
  modelId: string;
  loadMs: number | null;
  lastInferenceMs: number | null;
  lastError: string | null;
  device: string;
}

type TransformersModule = typeof import('@huggingface/transformers');

let transformersPromise: Promise<TransformersModule | null> | null = null;
let pipelinePromise: Promise<unknown> | null = null;
let transformersLoadMs: number | null = null;
let lastError: string | null = null;
let pipelineLoadMs: number | null = null;
let inFlightWarmup: Promise<boolean> | null = null;

// Only one process-wide warmup, even if several requests race.
let warmupStarted = false;

function ensureCacheDir(): void {
  try {
    fs.mkdirSync(env.aiCachePath, { recursive: true });
  } catch (error) {
    logger.warn('Could not create AI cache directory', { path: env.aiCachePath, error });
  }
}

/**
 * Loads the transformers runtime. Sets the ONNX cache dir before any model is
 * instantiated so weights are not re-downloaded on every boot.
 */
async function loadTransformers(): Promise<TransformersModule | null> {
  if (!env.AI_ENABLED) {
    lastError = 'AI disabled by configuration';
    return null;
  }

  if (transformersPromise) return transformersPromise;

  transformersPromise = (async () => {
    const startedAt = Date.now();
    try {
      ensureCacheDir();
      const mod = await import('@huggingface/transformers');

      mod.env.cacheDir = env.aiCachePath;
      // Reduce ONNX Runtime chatter; our own logger already reports failures.
      mod.env.logLevel = 3;
      transformersLoadMs = Date.now() - startedAt;
      logger.info('Transformers runtime ready', { loadMs: transformersLoadMs, cacheDir: env.aiCachePath });
      return mod;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      logger.warn('Transformers runtime unavailable; AI will use the rule-based fallback', { error: lastError });
      return null;
    }
  })();

  return transformersPromise;
}

/**
 * ONNX Runtime options shared by every pipeline.
 *
 * `q8` keeps each model in the 8-bit weights bundle (~23 MB for MiniLM instead of
 * ~90 MB for fp32) which is what makes this viable on a student laptop, and the
 * thread caps stop ONNX from oversubscribing a small container: past the core
 * count, extra threads make CPU inference *slower*, not faster.
 */
const PIPELINE_OPTIONS = {
  dtype: 'q8' as const,
  session_options: {
    intraOpNumThreads: 1,
    interOpNumThreads: 1,
  },
};

/**
 * Resolves the embedding pipeline, creating it on first use.
 * `Xenova/all-MiniLM-L6-v2` is ~23 MB quantised: small enough for a student
 * laptop, strong enough for semantic similarity.
 */
async function getEmbeddingPipeline(): Promise<unknown> {
  if (pipelinePromise) return pipelinePromise;

  pipelinePromise = (async () => {
    const mod = await loadTransformers();
    if (!mod) return null;
    const startedAt = Date.now();
    try {
      const pipeline = await mod.pipeline('feature-extraction', env.AI_EMBEDDING_MODEL, PIPELINE_OPTIONS);
      pipelineLoadMs = Date.now() - startedAt;
      logger.info('Embedding model ready', { model: env.AI_EMBEDDING_MODEL, loadMs: pipelineLoadMs });
      return pipeline;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      logger.warn('Embedding model failed to load; falling back to rules', { error: lastError });
      return null;
    }
  })();

  return pipelinePromise;
}

async function getClassifierPipeline(): Promise<unknown> {
  const mod = await loadTransformers();
  if (!mod) return null;
  try {
    return await mod.pipeline('zero-shot-classification', env.AI_MODEL, PIPELINE_OPTIONS);
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    logger.warn('Classification model failed to load; using rule-based intent detection', { error: lastError });
    return null;
  }
}

class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} exceeded ${ms}ms budget`);
    this.name = 'TimeoutError';
  }
}

export async function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface EmbeddingVector {
  vector: number[];
  dims: number;
  ms: number;
}

/**
 * Mean-pools the token embeddings into a single dense vector, then L2-normalises
 * it so cosine similarity reduces to a dot product.
 */
export async function embed(texts: string[]): Promise<EmbeddingVector[] | null> {
  const pipeline = await withTimeout(getEmbeddingPipeline(), env.AI_TIMEOUT_MS * 2, 'embedding model load');
  if (!pipeline) return null;

  const startedAt = Date.now();
  try {
    const result = (await withTimeout(
      (pipeline as (input: string[], opts: unknown) => Promise<{ data: Float32Array; dims: number[] }>)(
        texts,
        { pooling: 'mean', normalize: true },
      ),
      env.AI_TIMEOUT_MS,
      'embedding inference',
    )) as { data: Float32Array; dims: number[] };

    const dims = result.dims.at(-1) ?? 0;
    const count = texts.length;
    const vectors: EmbeddingVector[] = [];

    for (let i = 0; i < count; i += 1) {
      const start = i * dims;
      vectors.push({
        vector: Array.from(result.data.slice(start, start + dims)),
        dims,
        ms: Date.now() - startedAt,
      });
    }

    lastError = null;
    return vectors;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    logger.warn('Embedding inference failed; falling back to lexical matching', { error: lastError });
    return null;
  }
}

export interface ClassificationResult {
  label: string;
  score: number;
}

/** Zero-shot intent classification. Returns null if the model is unavailable. */
export async function classify(text: string, labels: string[]): Promise<ClassificationResult[] | null> {
  const pipeline = await withTimeout(getClassifierPipeline(), env.AI_TIMEOUT_MS * 3, 'classifier model load');
  if (!pipeline) return null;

  try {
    const result = (await withTimeout(
      (pipeline as (input: string, args: unknown) => Promise<{ labels: string[]; scores: number[] }>)(text, {
        candidate_labels: labels,
        multi_label: false,
      }),
      env.AI_TIMEOUT_MS,
      'classification inference',
    )) as { labels: string[]; scores: number[] };

    lastError = null;
    return result.labels.map((label, index) => ({ label, score: result.scores[index] ?? 0 }));
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    logger.warn('Classification inference failed; using rule-based intent detection', { error: lastError });
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Kanji-free fallback: token overlap score, used when embeddings are unavailable. */
export function lexicalSimilarity(a: string, b: string): number {
  const tokenise = (text: string) =>
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 2),
    );

  const tokensA = tokenise(a);
  const tokensB = tokenise(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const token of tokensA) if (tokensB.has(token)) overlap += 1;
  return (2 * overlap) / (tokensA.size + tokensB.size);
}

export function isAiAvailable(): boolean {
  return env.AI_ENABLED && lastError === null;
}

export function getModelStatus(): ModelStatus {
  return {
    configured: env.AI_ENABLED,
    available: isAiAvailable(),
    loaded: Boolean(transformersPromise && pipelineLoadMs !== null),
    modelId: env.AI_EMBEDDING_MODEL,
    loadMs: pipelineLoadMs ?? transformersLoadMs,
    lastInferenceMs: null,
    lastError,
    device: 'cpu',
  };
}

export function getAiCachePath(): string {
  return path.resolve(env.aiCachePath);
}

/**
 * Starts loading models in the background at boot. Fire-and-forget: the server
 * must be able to serve requests before any model is ready.
 */
export function warmupModels(): void {
  if (warmupStarted || !env.AI_ENABLED) return;
  warmupStarted = true;

  inFlightWarmup = (async () => {
    const pipeline = await getEmbeddingPipeline();
    if (!pipeline) return false;
    // Run one tiny inference so the first real request does not pay graph init.
    await embed(['warmup']);
    return true;
  })().catch((error) => {
    logger.warn('AI warmup failed', { error });
    return false;
  });
}

export async function waitForWarmup(): Promise<boolean> {
  if (!inFlightWarmup) return false;
  return inFlightWarmup;
}

/** Test seam: clears module state so suites start from a clean slate. */
export function resetModelStateForTests(): void {
  transformersPromise = null;
  pipelinePromise = null;
  transformersLoadMs = null;
  pipelineLoadMs = null;
  lastError = null;
  inFlightWarmup = null;
  warmupStarted = false;
}

export const AI_MODEL_ID = env.AI_MODEL;
export const AI_EMBEDDING_MODEL_ID = env.AI_EMBEDDING_MODEL;
export const AI_ENABLED = env.AI_ENABLED;
export const AI_CACHE_DIR = env.aiCachePath;
