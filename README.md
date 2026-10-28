# MEPro API

Backend for MEPro, a fitness and wellness tracker: workouts, yoga, nutrition,
hydration, progress, goals, achievements, a community feed, and a fully local
AI assistant.

Built with Express 5, TypeScript and MongoDB (Mongoose 9). No external AI
service is used: the assistant and recommendations run through
Transformers.js on the CPU, with a deterministic rule engine as a fallback, so
the whole feature set works offline and without API keys.

- **API reference:** [`docs/API.md`](docs/API.md) (generated from the routes)
- **Node:** 20 or newer
- **Database:** MongoDB 6+ (developed against 8.0)

## Quick start

```bash
npm install
cp .env.example .env          # then set the two JWT secrets
npm run seed                  # catalogues + 4 demo users with 45 days of history
npm run dev                   # http://localhost:5000
```

Verify the whole thing end to end:

```bash
npm run typecheck
npm test                      # 130 unit tests, no database needed
npm run validate:seed         # catalogue integrity against the model enums
npm run verify:seed           # 40 post-seed database integrity checks
bash scripts/start-dev.sh --wait && bash scripts/smoke.sh   # 90 checks over live HTTP
```

`scripts/smoke.sh` needs the API running and a seeded database. It makes about a
dozen credential requests, and `/api/auth/login` is limited to 20 per 15 minutes
per IP, so **run it against a freshly started server** — the pre-flight check
will tell you if the limit is already spent.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Watch mode |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests for the pure logic |
| `npm run seed` | Idempotent seed: catalogues plus demo history |
| `npm run seed:reset` | Wipe every collection, then seed from scratch |
| `npm run validate:seed` | Check seed data against the model schemas and enums |
| `npm run verify:seed` | Check the seeded database for referential integrity |
| `npm run docs` | Regenerate `docs/API.md` from the route definitions |

## Demo accounts

All four use the password `Demo@12345`:

| Email | Profile |
| --- | --- |
| `aarav@mepro.app` | Muscle gain, intermediate, gym |
| `priya@mepro.app` | Weight loss, beginner, home |
| `rohan@mepro.app` | Yoga and flexibility focus |
| `ananya@mepro.app` | Yoga and stress relief, advanced |

Each has 45 days of realistic history: sessions, food and water logs, weight
entries, goals, badges, and a varied streak, so charts and insights have
something to show. The seed is deterministic for a given day, so re-running it
reproduces the same dataset.

## Layout

```
src/
  config/       env parsing (Zod) and logger
  models/       Mongoose schemas, enums, and schema-level invariants
  services/     business logic; the only layer that touches the database
  controllers/  request/response translation
  routes/       URL to controller mapping, and where auth is applied
  validators/   Zod schemas for every body, query and param
  middleware/   auth, error handling, rate limiting, uploads
  utils/        dates, pagination, health maths, JWT, response envelope
  seed/         seed runner and typed catalogue data
  __tests__/    unit tests for the pure logic
scripts/        seed validation, verification, smoke test, API doc generator
```

The layering is strict: routes validate and delegate, controllers translate,
services own the data. Nothing below a service imports a request or response
object, which is what keeps the logic testable without a database.

## Design notes

**Dates are UTC.** A "day" is the same 24-hour window everywhere, so a log made
at 23:30 in one timezone cannot land in a different bucket on the server.
Day-level query parameters are `YYYY-MM-DD`.

**Auto-sourced goals sync on write.** A goal with `source: "weight"` or
`"workout_count"` captures a server-owned `baselineValue` at creation and is
recalculated immediately, so a client never sees a freshly created goal sitting
at 0% when real progress already exists. A weight goal is refused if the user
has no weight on record, because a baseline of zero would be meaningless.

**Sessions know their source.** A `WorkoutSession` holds exactly one of
`workoutId` or `yogaId`, enforced by a schema pre-hook, plus a denormalised
`title` so history renders without a second lookup.

**Diet data is two fields.** `dietTags` holds only the user's dietary
*preferences* (`vegan`, `pescatarian`, …). Everything else — `gluten_free`,
`contains_nuts` — lives in `dietaryFlags`. Conflating them made "vegan" match
every gluten-free food and vice versa.

**Health maths is clamped and tested.** Calorie targets never fall below 1200
kcal or exceed 5000 even for an extreme profile, and the macro split divides
only the calories left after protein so the three macros add up to the target
instead of overshooting it. BMI and hydration results always carry a disclaimer:
they are population estimates, not medical advice.

**Failure modes are explicit.** A single response envelope for both success and
error, with a machine-readable `code` alongside the message, and ownership
checks on every read and write — another user's goal returns `404`, not `403`,
so the API does not confirm that the document exists.

**The AI is optional by design.** The model is loaded in the background after
boot so the server is never blocked on it. If loading fails or times out, the
rule engine answers instead and `/api/ai/status` reports which path is live. The
assistant screens for medical questions and answers from the user's own logged
data rather than inventing advice.

**The API reference cannot drift.** `npm run docs` parses the route files and
regenerates `docs/API.md`, and warns about any endpoint missing a summary, so
a new route shows up in the docs as soon as it is added.

## Security

- Access and refresh tokens use different secrets and different lifetimes.
- Passwords are bcrypt hashed; refresh tokens are stored hashed and rotated on
  every use. Replaying a rotated token revokes the entire token family.
- `helmet` sets security headers; CORS is restricted to `CLIENT_URL`.
- A global rate limit covers `/api`, with tighter per-IP limits on credential
  and AI endpoints.
- Request bodies are capped at 1 MB and uploads are type- and size-checked.
- Uploads are served from a directory outside the source tree.
- `.env` is git-ignored. The app refuses to start in production with missing or
  placeholder secrets.

Rate limits are per process and held in memory, which is correct for a single
instance. Running several instances would need a shared store, such as Redis.

## Testing

`npm test` covers the pure logic where a subtle mistake is most likely: goal
progress arithmetic, the health calculations, UTC date boundaries, pagination
and regex escaping, and the validation schemas. These need no database, so they
run in about two seconds.

The database itself is covered by the smoke suite (`scripts/smoke.sh`, 90
checks) and the seed verifier, which run against a real MongoDB.
