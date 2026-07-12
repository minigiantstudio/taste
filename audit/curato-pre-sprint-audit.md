# Curato — Pre-Sprint Audit

*Read directly from source files. Inferences are flagged explicitly.*

*Generated: 2026-07-11*

---

## Section 1 — Project Structure

**Next.js version:** 14.2.35
**Router:** App Router, `src/`-based, route group `(app)` for authenticated screens.

```
/
├── audit/
│   └── curato-pre-migration-audit.md
├── docs/superpowers/
│   ├── plans/
│   └── specs/
├── public/
│   ├── fonts/ABCArizona-FlareRegular.otf
│   ├── manifest.json                          ← PWA manifest present
│   └── screenshot-540.png
├── scripts/
│   ├── ef1-verify.ts
│   └── test-stats.ts
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── capsule/
│   │   │   │   ├── [contextId]/page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── contexts/
│   │   │   │   ├── [id]/page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── dossier/[capsuleId]/page.tsx
│   │   │   ├── feed/page.tsx
│   │   │   ├── inbox/page.tsx
│   │   │   ├── library/page.tsx
│   │   │   ├── settings/
│   │   │   │   ├── ds/page.tsx
│   │   │   │   └── layout.tsx
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   ├── agent/triage/route.ts
│   │   │   ├── capsule/
│   │   │   │   ├── generate/route.ts
│   │   │   │   └── stats/route.ts
│   │   │   ├── ds/
│   │   │   │   ├── sync/route.ts
│   │   │   │   └── validate/route.ts
│   │   │   ├── guidelines/[capsuleId]/route.ts
│   │   │   └── transcribe/route.ts
│   │   ├── auth/callback/route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── page.tsx                           ← root redirect to /feed
│   │   └── share/[capsuleId]/page.tsx
│   ├── components/
│   │   ├── FAB.tsx
│   │   ├── FeedCard.tsx                       ⚠ DEAD — not imported anywhere
│   │   ├── FeedScreen.tsx                     ⚠ DEAD — not imported anywhere
│   │   ├── OnlineFlush.tsx
│   │   ├── PhoneFrame.tsx
│   │   ├── SyncIndicator.tsx
│   │   ├── capture/                           (7 files + index.ts)
│   │   ├── contexts/                          (2 files)
│   │   ├── dossier/                           (3 files)
│   │   ├── ds/                                (2 files)
│   │   ├── feed/                              (AgentTriageStrip, FeedCard)
│   │   ├── focus/                             (2 files + index.ts)
│   │   ├── home/                              (CapsuleWidget, ExportSheet, StepRail)
│   │   ├── inbox/                             (TagRow, TriageCard, VoiceRecorder)
│   │   ├── icons.tsx
│   │   ├── library/                           (FilterBar, LibraryCard, SearchBar)
│   │   └── ui/                                (Chip, Sheet, Tag, TagInput, Wave)
│   ├── lib/
│   │   ├── agent.ts
│   │   ├── auth.ts
│   │   ├── capsule.ts
│   │   ├── captures.ts
│   │   ├── claude.ts
│   │   ├── contexts.ts
│   │   ├── ds-connections.ts
│   │   ├── github.ts
│   │   ├── guidelines/                        (process.ts, format.ts)
│   │   ├── guidelines-generator.ts
│   │   ├── offline-queue.ts
│   │   ├── storage.ts
│   │   ├── supabase-server.ts
│   │   ├── supabase.ts
│   │   └── types/
│   │       ├── design-system.ts
│   │       └── judgments.ts
│   ├── middleware.ts
│   └── types/
│       ├── agent.ts
│       ├── capsule.ts
│       ├── capture.ts
│       ├── context.ts
│       ├── guidelines.ts
│       └── speech.d.ts
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   └── 002_judgments.sql
│   └── .temp/linked-project.json             ← empty, no projectRef stored
└── .superpowers/brainstorm/
```

**Unusual / notable:**
- `src/components/FeedCard.tsx` and `FeedScreen.tsx` at the top level are dead code — the actively used equivalents live in `src/components/feed/`.
- `supabase/.temp/linked-project.json` contains no `projectRef` — `pnpm db:types` will fail until this is configured.
- `framer-motion` is in `dependencies` — not found in any import during this audit (inferred).
- `CLAUDE.md` still contains `Supabase project: [fill in project ID after connecting]` — placeholder never updated.
- `public/manifest.json` and icons indicate PWA intent but no service worker is present.

---

## Section 2 — package.json

```json
"dependencies": {
  "@supabase/ssr":         "^0.10.3",
  "@supabase/supabase-js": "^2.107.0",
  "framer-motion":         "^12.40.0",
  "next":                  "14.2.35",
  "react":                 "^18",
  "react-dom":             "^18"
}

"devDependencies": {
  "@types/node":        "^20",
  "@types/react":       "^18",
  "@types/react-dom":   "^18",
  "eslint":             "^8",
  "eslint-config-next": "14.2.35",
  "postcss":            "^8",
  "supabase":           "^2.105.0",
  "tailwindcss":        "^3.4.1",
  "typescript":         "^5"
}
```

**Notable:**
- `@anthropic-ai/sdk` is **not installed**. All three Claude call sites use raw `fetch` to `https://api.anthropic.com/v1/messages`.
- `framer-motion`: `^12.40.0` — present in dependencies, not found in any import during this audit.
- No `engines.node` field — Node version unspecified.

---

## Section 3 — Environment Variables

| Variable | Files that reference it | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `supabase.ts`, `supabase-server.ts`, `middleware.ts`, `generate/route.ts`, `guidelines-generator.ts`, `share/[capsuleId]/page.tsx` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `supabase.ts`, `supabase-server.ts`, `middleware.ts` | Anon key for browser/server clients |
| `SUPABASE_SERVICE_ROLE_KEY` | `generate/route.ts`, `guidelines-generator.ts`, `share/[capsuleId]/page.tsx` | Service role (bypasses RLS); used as fallback to anon key if unset |
| `ANTHROPIC_API_KEY` | `claude.ts`, `generate/route.ts`, `transcribe/route.ts` | Claude API key |
| `NEXT_PUBLIC_SITE_URL` | `login/page.tsx` | Magic link redirect base URL; optional — falls back to `window.location.origin` |

**Pattern:** `SUPABASE_SERVICE_ROLE_KEY ?? NEXT_PUBLIC_SUPABASE_ANON_KEY!` appears in three files. If `SUPABASE_SERVICE_ROLE_KEY` is unset, the "service" client silently becomes an anon client — changing the security model without any error or warning (except in `guidelines-generator.ts`, which has an explicit `console.warn`).

---

## Section 4 — Supabase Setup

**Browser client** — `src/lib/supabase.ts`
```ts
import { createBrowserClient } from '@supabase/ssr'
export function createClient() { return createBrowserClient(url, anonKey) }
```

**Server client** — `src/lib/supabase-server.ts`
```ts
import { createServerClient } from '@supabase/ssr'
export async function createServerSupabaseClient() { ... }  // reads/sets cookies
```

**Service-role client** — no shared factory. Defined inline in two separate files:
- `src/app/api/capsule/generate/route.ts:9–13`
- `src/lib/guidelines-generator.ts:13–20`

Both use `import { createClient as createSupabaseClient } from '@supabase/supabase-js'` directly.

**Import pattern consistency:**

| Import | Client type | Files |
|---|---|---|
| `from '@/lib/supabase'` | Browser client | `captures.ts`, `contexts.ts`, `capsule.ts`, `storage.ts`, `feed/page.tsx`, `capsule/page.tsx` |
| `from '@/lib/supabase-server'` | Server client | `agent/triage/route.ts`, `transcribe/route.ts`, `stats/route.ts`, `guidelines/route.ts`, `ds/sync/route.ts`, `ds/validate/route.ts` |
| Inline `createClient` from `@supabase/supabase-js` | Service-role | `generate/route.ts`, `guidelines-generator.ts` |

Pattern is consistent within each tier. The inconsistency is that the service-role pattern has no shared home.

---

## Section 5 — Claude API Usage

**No `@anthropic-ai/sdk` is used.** All calls are raw `fetch` with `anthropic-version: '2023-06-01'`.

### `src/lib/claude.ts`
- **Model:** `claude-sonnet-4-6`
- **max_tokens:** 1000
- **Streaming:** No
- **Timeout:** 15 seconds
- **Purpose:** `analyzeCapture()` — background triage agent; suggests tags, domains, context IDs, extracts rules
- **System prompt note:** Still says "Taste" not "Curato" in the agent identity string

### `src/app/api/capsule/generate/route.ts`
- **Model:** `claude-sonnet-4-6` (constant `CLAUDE_MODEL`)
- **max_tokens:** 2000
- **Streaming:** No
- **Timeout:** 30 seconds
- **Purpose:** Generate Taste Capsule (declaration + distilled rules + frequency map)
- **Prompt structure:** Single user message, no system message

### `src/app/api/transcribe/route.ts`
- **Model:** `claude-haiku-4-5` ← **different from the other two**
- **max_tokens:** 1024
- **Streaming:** No
- **Timeout:** 30 seconds
- **Purpose:** Transcribe voice note audio (multimodal: base64 audio + text instruction)

---

## Section 6 — Existing API Routes

### `POST /api/agent/triage`
- **Auth:** Session client → `auth.getUser()` → 401 if none
- **Reads:** `captures` (by `id` + `user_id`), `captures` (by `user_id`, limit 100), `contexts` (by `user_id`)
- **Writes:** `captures` UPDATE (ai fields) filtered by `id` + `user_id`
- **Client:** Session client throughout
- **Issues:** Final update has no error handling — silent failure returns `{ ok: true }` regardless

### `POST /api/capsule/generate`
- **Auth:** Session client → `auth.getUser()` → 401; then switches to service-role client
- **Reads:** `contexts` by `.eq('id', contextId)` only — **no `user_id` filter**. `captures` by `.contains('context_ids', [contextId])` — **no `user_id` filter**.
- **Writes:** `capsules` INSERT with `user_id: user.id` — correctly attributed
- **Client:** Service-role for all DB reads and writes after auth check
- **CRITICAL ISSUE:** Authenticated user can supply any `contextId` and read another user's context and captures

### `GET /api/capsule/stats`
- **Auth:** Session client → `auth.getUser()` → 401; verifies capsule ownership via RLS-scoped query
- **Client:** Session client for ownership check; service client inside `guidelines-generator.ts`
- **Issues:** None significant — ownership verified before service client access

### `POST /api/ds/sync`
- **Auth:** Session client → `auth.getUser()` → 401
- **Reads/Writes:** `capsules`, `captures`, `ds_versions`, `ds_changelog`, `ds_connections`, Storage `ds-patches`
- **Client:** Session client throughout; explicit `user_id` filters on all reads
- **Issues:** `createDSVersion` + is_current flag update are non-atomic

### `POST /api/ds/validate`
- **Auth:** Session client → `auth.getUser()` → 401
- **Reads:** External GitHub API or raw URLs — no DB reads
- **Issues:** None

### `GET /api/guidelines/[capsuleId]`
- **Auth:** Session client → `auth.getUser()` → 401; ownership enforced via injected session client RLS
- **Issues:** None

### `POST /api/transcribe`
- **Auth:** Session client → `auth.getUser()` → 401
- **DB reads/writes:** None
- **Issues:** None

---

## Section 7 — Pages and Components

### Pages in `src/app/(app)/`

| Route | What it shows |
|---|---|
| `/feed` | Home dashboard — CapsuleWidget, StepRail, ExportSheet, FocusBar |
| `/capsule` | Redirect to latest capsule by context_id |
| `/capsule/[contextId]` | Generate capsule, history, word cloud, diff |
| `/contexts` | List brands and projects; focus entry point |
| `/contexts/[id]` | Context detail — Captures / Rules / Capsule tabs |
| `/dossier/[capsuleId]` | Authenticated dossier — theme, PDF, public toggle |
| `/inbox` | Capture review / triage — TriageCard, VoiceRecorder, TagRow |
| `/library` | Masonry grid + bulk select + search |
| `/settings/ds` | DS connection management |

### Dead components at top level

| File | Status |
|---|---|
| `src/components/FeedCard.tsx` | Not imported anywhere — superseded by `src/components/feed/FeedCard.tsx` |
| `src/components/FeedScreen.tsx` | Not imported anywhere — superseded by `feed/page.tsx` |

---

## Section 8 — Navigation and Routing

**Home/default route:** `/feed` — root `src/app/page.tsx` redirects to `/feed`.

**BottomNav** (inline in `src/app/(app)/layout.tsx`):

| Label | href |
|---|---|
| Home | `/feed` |
| Capsule | `/capsule` |
| Brands | `/contexts` |

Note: `/library`, `/inbox`, `/dossier`, `/settings` are **not in the tab bar** — reached via StepRail, context screens, or capsule screen.

**StepRail** (`src/components/home/StepRail.tsx`) — 4 rows on the home screen:

| # | Title | Action |
|---|---|---|
| 01 | Captures | push → `/library` |
| 02 | Capsule | push → `/capsule/{contextId}` if available |
| 03 | Export | calls `onExport` prop (opens ExportSheet) |
| 04 | Review | push → `/inbox`; accented in `var(--violet)` when `inboxCount > 0` |

`AppShell` hides FAB and BottomNav when pathname starts with `/inbox`.

---

## Section 9 — CSS and Design System

**Single source:** `src/app/globals.css` — all tokens are defined here.

**CSS variables defined:**

| Group | Variables |
|---|---|
| Surfaces | `--cream`, `--cream-2`, `--panel` |
| Ink | `--ink`, `--ink-soft`, `--ink-faint` |
| Line | `--line`, `--line-soft` |
| Accents | `--violet`, `--violet-soft`, `--red`, `--red-soft`, `--green`, `--green-soft` |
| Extended | `--blue`, `--orange`, `--pink`, `--yellow`, `--rule-hair`, `--rule` |
| Typography | `--display` (ABCArizona Flare), `--mono` (DM Mono) |

**Fonts:**
- ABCArizona Flare — `@font-face` in `globals.css`, from `/fonts/ABCArizona-FlareRegular.otf`
- DM Mono — referenced in `--mono` but **no `@font-face` or Google Fonts link in `globals.css`** — must be loaded in root layout or falls back to system mono

**Missing tokens (used but not defined in globals.css):**
- `var(--dust)` — referenced in `src/app/(app)/layout.tsx:28` (BottomNav `borderTop`)
- `var(--stone)` — referenced in `src/app/(app)/layout.tsx:47` (inactive nav label color)

**Border-radius convention:** Inconsistent. Curato-era components use `borderRadius: 0`. Older components use 8–12px. No enforced convention.

**Base spacing unit:** None defined. All spacing is ad-hoc inline values.

---

## Section 10 — Capsule Generation (Deep Read)

**File:** `src/app/api/capsule/generate/route.ts`

### Sequence of operations

1. `createServerSupabaseClient()` — session-aware client
2. `authed.auth.getUser()` — verify authenticated → 401 if not
3. Parse `contextId` from request body → 400 if missing
4. **Switch to `createServiceClient()`** — service-role client, bypasses RLS for all remaining DB ops
5. `supabase.from('contexts').select('*').eq('id', contextId).single()` — **no `user_id` filter**
6. `supabase.from('captures').select('*').contains('context_ids', [contextId])` — **no `user_id` filter**
7. If `context.parent_context_id` exists: fetch parent captures — **no `user_id` filter**
8. Fetch latest capsule version for `nextVersion()`
9. Build `captureLines` string (type, verdict, content slice 300, tags, domains, rule_verb)
10. Call Claude (raw fetch, model `claude-sonnet-4-6`, max_tokens 2000, 30s timeout, **no system message**)
11. Strip ` ```json ` fences from response
12. `JSON.parse()` the cleaned string
13. Validate `parsed.declaration` is a non-empty string
14. `supabase.from('capsules').insert({ user_id: user.id, ... })` — correctly attributed
15. Return `{ capsule, dominant_domains, capsule_summary }`

### Ownership check on contextId

**No.** Confirmed absent. Step 5 queries `contexts` by `id` only.

### Claude prompt structure

No `system` field. Single user message containing the full prompt. Key sections:

```
You are synthesizing an Art Director's aesthetic position into a Taste Capsule.

Context: {context.name} ({context.type})
Description: {context.description || 'none'}

Captures ({captures.length} total):
{captureLines}

Generate a Taste Capsule as JSON (no markdown, no explanation — raw JSON only):
{
  "declaration": "string — One sentence. Editorial magazine voice...",
  "distilled_rules": [
    { "verb": "ALWAYS|NEVER|PREFER|AVOID", "domain": "string", "text": "string" }
  ],
  "dominant_domains": ["string"],
  "frequency_map": { "word": 0.0 },
  "capsule_summary": "string — 2-3 sentences..."
}

Rules:
- distilled_rules: deduplicated, maximum 12, most important first
- Return valid JSON only
```

### What gets written to DB

- `rules` (jsonb): `parsed.distilled_rules` — shape `{ verb: "ALWAYS"|"NEVER"|"PREFER"|"AVOID", domain, text }[]`
- `frequency_map` (jsonb): `parsed.frequency_map` — `{ word: number }` flat object
- No schema validation beyond checking `parsed.declaration` exists

### Hardcoded values

| Value | Source |
|---|---|
| Model `'claude-sonnet-4-6'` | `CLAUDE_MODEL` constant |
| `max_tokens: 2000` | Hardcoded |
| 30s timeout | `AbortSignal.timeout(30_000)` |
| Max 12 rules | Prompt instruction only — not enforced in code |
| Frequency map 20–40 words | Prompt instruction only — not enforced in code |
| `protocol_version: '1'` | Always hardcoded |

---

## Section 11 — Storage

### Bucket: `capture-media`

- **Defined at:** `src/lib/storage.ts:3` — `const BUCKET = 'capture-media'`
- **Path pattern:** `{user.id}/{folder}/{Date.now()}.{ext}` — `folder` is `'photos'` or `'audio'`
- **Access:** `createSignedUrl(path, 3600)` — private, 1-hour signed URLs
- **Public:** No

### Bucket: `ds-patches`

- **Defined at:** `src/app/api/ds/sync/route.ts:253,260` — inline string, not a constant
- **Path pattern:** `{user.id}/{ds_connection_id}/{version}/curato-tokens.css` and `.../curato-skill-patch.md`
- **Access:** `getPublicUrl()` — public, no auth required
- **Public:** Yes

---

## Section 12 — What's Missing or Broken

### A. Security Issues

**CRITICAL — `src/app/api/capsule/generate/route.ts`**
Service-role client fetches `contexts` and `captures` with no `user_id` filter. An authenticated user can POST `{ contextId: "<another_user_uuid>" }` and receive that user's context and all associated captures. The resulting capsule is saved under the attacker's `user_id`, but the data read is entirely unowned.

**HIGH — `src/app/share/[capsuleId]/page.tsx`** *(inferred — file not fully read)*
Uses `SUPABASE_SERVICE_ROLE_KEY ?? NEXT_PUBLIC_SUPABASE_ANON_KEY` inline. If it queries capsules by `id` only (service client skips RLS), any capsule ID — including private ones — could be read without the `protocol_json_url IS NOT NULL` public check. Requires verification.

**MEDIUM — `SUPABASE_SERVICE_ROLE_KEY ?? NEXT_PUBLIC_SUPABASE_ANON_KEY` fallback**
If `SUPABASE_SERVICE_ROLE_KEY` is missing from the deployment environment, the service client silently becomes an anon client. In `generate/route.ts` this causes context/captures queries to hit RLS, likely causing silent data-not-found rather than an error.

---

### B. TypeScript Issues

No `@ts-ignore` found in `src/`. However:

| File | Issue |
|---|---|
| `src/app/api/capsule/generate/route.ts:112` | `as never` — workaround for `nextVersion()` type |
| `src/app/api/capsule/generate/route.ts:185` | `as never` — Supabase insert type inference workaround |
| `src/lib/capsule.ts:54` | `as never` — same Supabase insert workaround |
| `src/lib/capsule.ts:66` | `as never` — Supabase update workaround |
| `src/app/(app)/capsule/[contextId]/page.tsx:418` | `as unknown as React.CSSProperties` — CSS cast |
| `src/app/(app)/feed/page.tsx:19` | `rules: unknown[]` — `CapsuleRow` interface has untyped rules |

Root cause of `as never` pattern: `pnpm db:types` has never been run — `supabase/.temp/linked-project.json` has no `projectRef`.

---

### C. Missing Error Handling

| File | Issue |
|---|---|
| `src/app/(app)/capsule/page.tsx` | No try/catch — Supabase errors silently leave user in infinite loading state |
| `src/app/(app)/feed/page.tsx:42` | `getInboxCaptures().then(...)` — no `.catch()` — unhandled rejection |
| `src/app/api/agent/triage/route.ts:57` | Final `authed.update(...)` has no error check — silent failure returns `{ ok: true }` regardless |
| `src/app/api/ds/sync/route.ts:333` | Patch URL update after `createDSVersion` has no error handling — patch URLs silently go missing if this update fails |

---

### D. Inconsistencies

**1. Claude API — three separate implementations:**
`src/lib/claude.ts`, `src/app/api/capsule/generate/route.ts`, and `src/app/api/transcribe/route.ts` each define their own fetch logic and `CLAUDE_API_KEY` reference. The extraction route (Sprint 2) would add a fourth.

**2. Service client — no shared factory:**
`createServiceClient()` is copy-pasted with identical logic in `generate/route.ts` and `guidelines-generator.ts`.

**3. `as never` in two places for the same root problem:**
Supabase type inference on `.insert()` / `.update()` requires workarounds in both `src/lib/capsule.ts` and `generate/route.ts`. Root fix: run `supabase db:types` after linking the CLI.

**4. Missing CSS tokens:**
`src/app/(app)/layout.tsx` uses `var(--dust)` and `var(--stone)` — neither is defined in `globals.css`. They silently render as initial values (transparent / inherit).

**5. Domain vocabulary split:**
`src/types/capture.ts` — `DOMAINS = ['Spatial','Type','Color','Garments','Objects','Sound','Print']` (title-case, 7 values)
`src/lib/types/judgments.ts` — `JudgmentDomain = ['typography','color','composition','texture','space','motion','material','mood']` (lowercase, 8 values, different set)
Sprint 2 extraction route must define an explicit mapping strategy — they do not align by case-folding alone.

**6. `DistilledRule.verb` vs `JudgmentVerb` casing:**
`src/types/capsule.ts` — `DistilledRule.verb: 'ALWAYS'|'NEVER'|'PREFER'|'AVOID'` (uppercase)
`src/lib/types/judgments.ts` — `JudgmentVerb = 'always'|'never'|'prefer'|'avoid'` (lowercase)
Sprint 2/3 capsule rewrite must map between these explicitly.

**7. Brand name in AI prompt:**
`src/lib/claude.ts` system prompt still says "Taste" not "Curato".

---

### E. Dead Code

| File | Reason |
|---|---|
| `src/components/FeedCard.tsx` | Not imported anywhere; superseded by `src/components/feed/FeedCard.tsx` |
| `src/components/FeedScreen.tsx` | Not imported anywhere; superseded by the HomeScreen in `feed/page.tsx` |
| `src/app/(app)/settings/ds/page.tsx` | No tab bar entry, no visible navigation from any screen *(inferred — did not trace all `router.push` calls)* |

---

### F. Sprint-by-Sprint Conflicts

**Sprint 1 — Security fixes + judgments migration**

- `src/app/api/capsule/generate/route.ts` — primary target. Must add `.eq('user_id', user.id)` to context and captures queries. Options: switch to session client, or keep service client with explicit ownership check.
- `src/app/share/[capsuleId]/page.tsx` — review for the same service-client/no-ownership-check problem.
- `supabase/migrations/002_judgments.sql` — already written, needs to be applied via Supabase dashboard for project `duppejolqfwxodglbibc`. The `supabase/.temp/linked-project.json` has no `projectRef`, so `supabase db push` from CLI will also fail until linked.
- `pnpm db:types` — run after CLI is linked to generate proper types and eliminate `as never` workarounds.

**Sprint 2 — Judgments layer (extraction, review, capsule rewrite)**

- **New file needed:** `src/app/api/judgments/extract/route.ts` — will be the 4th Claude call site; shared-Claude-client inconsistency becomes more acute.
- **New file needed:** `src/lib/judgments.ts` — data layer functions; currently absent.
- **Capsule generation rewrite** — `generate/route.ts` must read confirmed judgments instead of re-deriving from captures. The `rules` jsonb currently holds `DistilledRule[]` (uppercase verbs); if rewrite outputs confirmed `Judgment[]` (lowercase verbs), the JSON shape changes and all consumers (`DossierDocument`, `ds/sync`, `guidelines/process.ts`) must be updated.
- **Domain vocabulary mismatch** — must be resolved before extraction route can validate proposed judgment domains against captures.

**Sprint 3 — Comparison mechanic**

- `src/app/(app)/capsule/[contextId]/page.tsx` already has `diffCapsules()` wiring — comparison mechanic may conflict or build on this.
- No other specific conflicts identified without a spec.

**Sprint 4 — Daily trigger / Spotify effect**

- No existing scheduled job infrastructure — will require Supabase Edge Functions (cron), Vercel Cron, or external scheduler.
- `src/lib/captures.ts` has `getTodayCaptures()` and `getInboxCaptures()` — likely relevant.
- No conflicts with current code identified.

---

*End of audit.*
