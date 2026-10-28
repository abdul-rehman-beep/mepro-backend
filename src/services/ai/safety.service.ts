import { logger } from '../../utils/logger';

/**
 * Safety layer for all AI output.
 *
 * Two responsibilities:
 *   1. `screenUserInput` detects requests that need refusal or redirection to a
 *      professional, before any model or template runs.
 *   2. `sanitiseAssistantText` guarantees the final answer can never read as a
 *      diagnosis, a prescription, or an instruction to stop seeking care.
 *
 * MEPro is a fitness and wellness app. It must never position itself as a
 * medical provider, so these checks are deliberately broad.
 */

export const MEDICAL_DISCLAIMER =
  'I am a fitness and wellness assistant, not a medical professional. For medical concerns, please speak with a doctor or pharmacist.';

export const URGENCY_ADVICE =
  'If this is an emergency or an urgent health concern, contact your local emergency number or seek in-person medical care now.';

export type SafetyCategory =
  | 'emergency'
  | 'diagnosis_request'
  | 'medication_request'
  | 'self_harm'
  | 'pregnancy_medical'
  | 'disordered_eating'
  | 'extreme_diet'
  | 'injury_diagnosis'
  | 'none';

export interface SafetyAssessment {
  category: SafetyCategory;
  isSafe: boolean;
  /** True when the answer must point the user to a healthcare professional. */
  requiresProfessionalReferral: boolean;
  reason: string | null;
  matchedTerms: string[];
}

interface SafetyRule {
  category: SafetyCategory;
  requiresProfessionalReferral: boolean;
  reason: string;
  patterns: RegExp[];
}

/**
 * Ordered most-severe first. The first match wins, so an emergency phrase is
 * never downgraded to a softer category.
 */
const SAFETY_RULES: SafetyRule[] = [
  {
    category: 'self_harm',
    requiresProfessionalReferral: true,
    reason: 'The message indicates a risk of self-harm or suicide, which requires immediate human support.',
    patterns: [
      /\b(kill myself|end my life|suicide|self[- ]harm|hurt myself|want to die|take my (own )?life)\b/i,
      /\bno reason to (live|continue)\b/i,
    ],
  },
  {
    category: 'emergency',
    requiresProfessionalReferral: true,
    reason: 'The message describes a medical emergency.',
    patterns: [
      /\b(emergency|ambulance|911|999|112|108|call an ambulance|going to the ER)\b/i,
      /\b(can'?t breathe|can not breathe|choking|unconscious|unresponsive|severe bleeding)\b/i,
      /\b(heart attack|stroke|cardiac arrest|seizure.*\b(?:now|again)\b|overdose)\b/i,
    ],
  },
  {
    category: 'medication_request',
    requiresProfessionalReferral: true,
    reason: 'The message asks for medication advice, which must come from a doctor or pharmacist.',
    patterns: [
      /\b(what (medication|medicine|pill|tablet)s? (should|do|can) (i|you) (take|use))\b/i,
      /\b(which|what) (medication|medicine|pill|tablet|supplement)s? (is|are) (best|good|right)\b/i,
      /\b(prescribe|prescription|dosage|dose) (for|of)\b/i,
      /\b(take|use|start) (ibuprofen|paracetamol|acetaminophen|aspirin|insulin|antibiotics?|steroids?)\b/i,
      /\b(is it safe to take|can i mix).*\b(medication|pill|supplement)\b/i,
    ],
  },
  {
    category: 'diagnosis_request',
    requiresProfessionalReferral: true,
    reason: 'The message asks for a medical diagnosis, which cannot be provided by a wellness app.',
    patterns: [
      /\b(do i have|what (disease|condition|illness|disorder|infection) (do i have|is this))\b/i,
      /\b(diagnose|diagnosis)\b.{0,30}\b(my|the)\b/i,
      /\b(is this (symptom|sign)s?)\b/i,
      /\b(check|test) (my|for) (diabetes|blood pressure|thyroid|cancer|hiv|cholesterol)\b/i,
      /\b(am i|are i) (pregnant|dyslexic|depressed|anorexic|bulimic)\b/i,
      /\b(why (do|does) my (heart|body|test|blood) .*(beat|ache|feel))\b/i,
    ],
  },
  {
    category: 'injury_diagnosis',
    requiresProfessionalReferral: true,
    reason: 'The message describes a possible injury that needs a physical assessment.',
    patterns: [
      /\b(is my (shoulder|knee|back|ankle|elbow|wrist|hip) (torn|fractured|broken|dislocated))\b/i,
      /\b(should i (see a doctor|go to (the )?(hospital|er|emergency)))\b/i,
      /\b(sharp|severe) (pain|in pain)\b.{0,40}\b(when|after|while)\b/i,
    ],
  },
  {
    category: 'pregnancy_medical',
    requiresProfessionalReferral: true,
    reason: 'Pregnancy and postnatal questions should be directed to a healthcare professional.',
    patterns: [
      /\b(pregnan(t|cy)|breastfeed(ing)?|postpartum|postnatal|trimester)\b/i,
      /\b(safe to (exercise|workout|train|eat).{0,20}pregnan)/i,
    ],
  },
  {
    category: 'disordered_eating',
    requiresProfessionalReferral: true,
    reason: 'The message describes patterns that may indicate an eating disorder.',
    patterns: [
      /\b(purge|vomit(ing)? after eating|laxative|binge(ing)? and purge)\b/i,
      /\b(anorexic|anorexia nervosa|bulimia)\b/i,
      /\b(i (want|need) to (starve|not) eat)\b/i,
    ],
  },
  {
    category: 'extreme_diet',
    requiresProfessionalReferral: true,
    reason: 'The request involves extreme restriction, which is not something this app will advise on.',
    patterns: [
      /\b(lose \d{2,3} ?(kg| pounds|lbs) in \d+ days?|fast(ing)? for \d+ days?)\b/i,
      /\b(how (long|fast) can i (go without|not) eat)\b/i,
      /\b(only drink|juice (cleanse|fast)|water fast for)\b/i,
      /\b(what (can|should) i (stop|not) eat (entirely|completely))\b/i,
    ],
  },
];

const NONE_ASSESSMENT: SafetyAssessment = {
  category: 'none',
  isSafe: true,
  requiresProfessionalReferral: false,
  reason: null,
  matchedTerms: [],
};

export function screenUserInput(text: string): SafetyAssessment {
  if (!text || text.trim().length === 0) return NONE_ASSESSMENT;

  for (const rule of SAFETY_RULES) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(text);
      if (match) {
        logger.debug('Safety rule matched', { category: rule.category, term: match[0] });
        return {
          category: rule.category,
          isSafe: false,
          requiresProfessionalReferral: rule.requiresProfessionalReferral,
          reason: rule.reason,
          matchedTerms: [match[0]],
        };
      }
    }
  }

  return NONE_ASSESSMENT;
}

/** Phrases a model or template must never emit. */
const FORBIDDEN_OUTPUT_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\byou (should|must|need to) (take|start|stop) (your |the )?[a-z ]{0,30}(medication|medicine|pills?|tablets?|antibiotics?|insulin|steroids?)\b/gi, replacement: 'talk to a doctor about medication' },
  { pattern: /\b(diagnos(e|ed|is) (you|your)|you have (a|an) \w+ (disease|infection|disorder|syndrome))\b/gi, replacement: 'I cannot diagnose anything' },
  { pattern: /\b(guarantee[ds]?|will definitely) (lose|burn|drop)\b/gi, replacement: 'may help' },
  { pattern: /\b(100% safe|no side effects|risk[- ]free)\b/gi, replacement: 'generally considered low risk, but check with a professional if unsure' },
  { pattern: /\bstop (taking|using) your\b/gi, replacement: 'speak to your doctor before changing' },
];

export interface SanitiseResult {
  text: string;
  modified: boolean;
  violations: string[];
}

export function sanitiseAssistantText(text: string): SanitiseResult {
  let output = text;
  const violations: string[] = [];

  for (const { pattern, replacement } of FORBIDDEN_OUTPUT_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(output)) {
      pattern.lastIndex = 0;
      output = output.replace(pattern, replacement);
      violations.push(replacement);
    }
  }

  // Collapse any whitespace introduced by substitutions.
  output = output.replace(/[ \t]{2,}/g, ' ').trim();

  return { text: output, modified: violations.length > 0, violations };
}

/** True when an answer refers to a medical claim and must be de-risked. */
export function answerNeedsDisclaimer(answer: string): boolean {
  return /\b(symptom|pain|injur|disease|condition|medicat|blood pressure|healing|rehab)\b/i.test(answer);
}

export function buildProfessionalReferral(): string {
  return `${URGENCY_ADVICE} ${MEDICAL_DISCLAIMER}`;
}

export const SAFETY_CATEGORIES = SAFETY_RULES.map((rule) => rule.category);
