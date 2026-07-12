# Curato — Single-User → Multi-Tenant Pre-Migration Audit

*Read-only. No solutions or migration code included. All findings sourced from direct file inspection.*

*Date: 2026-06-30*

---

## Section 1: Full Database Schema

### Tables in version-controlled migration (`supabase/migrations/001_initial_schema.sql`)

#### `captures`
| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `user_id` | `uuid NOT NULL` | FK → `auth.users(id)` ON DELETE CASCADE |
| `type` | `text NOT NULL` | |
| `content` | `text` | |
| `media_url` | `text` | |
| `tags` | `text[]` | |
| `domain` | `text` | |
| `mood` | `text` | |
| `verdict` | `text` | |
| `context_ids` | `uuid[]` | |
| `agent_processed` | `bool` | DEFAULT false |
| `agent_suggestions` | `jsonb` | |
| `protocol_json_url` | `text` | |
| `created_at` | `timestamptz` | DEFAULT now() |

RLS: enabled. Policies (4): `SELECT`, `INSERT`, `UPDATE`, `DELETE` — all use `auth.uid() = user_id`.
Indexes: `captures_user_id_idx`, `captures_created_at_idx`, `captures_type_idx`.

#### `contexts`
| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `user_id` | `uuid NOT NULL` | FK → `auth.users(id)` ON DELETE CASCADE |
| `name` | `text NOT NULL` | |
| `type` | `text` | |
| `parent_id` | `uuid` | FK → `contexts(id)` (self-ref) |
| `description` | `text` | |
| `tags` | `text[]` | |
| `created_at` | `timestamptz` | DEFAULT now() |

RLS: enabled. Policies (4): same pattern as captures.
Index: `contexts_user_id_idx`.

#### `capsules`
| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `user_id` | `uuid NOT NULL` | FK → `auth.users(id)` ON DELETE CASCADE |
| `context_id` | `uuid` | FK → `contexts(id)` |
| `version` | `int` | DEFAULT 1 |
| `title` | `text` | |
| `declaration` | `text` | |
| `rules` | `jsonb` | |
| `frequency_map` | `jsonb` | |
| `protocol_json_url` | `text` | |
| `created_at` | `timestamptz` | DEFAULT now() |

RLS: enabled. Policies (5): 4 owner policies + **"Public capsules are viewable by all"** using `protocol_json_url is not null` (not a boolean flag — public state is encoded as the presence of a URL value).
Index: `capsules_context_id_idx`.

### Tables NOT in version-controlled migration

`ds_connections`, `ds_versions`, and `ds_changelog` exist in the live database (TypeScript types and runtime queries reference them) but have **no migration file**. Schema is inferred from `src/lib/types/design-system.ts` only.

#### `ds_connections` (inferred)
`id`, `user_id`, `name`, `description`, `context_id`, `source`, `github_repo`, `github_branch`, `github_skill_path`, `github_tokens_path`, `github_pat_encrypted`, `raw_skill_url`, `raw_tokens_url`, `raw_bundle_url`, `skill_md_url`, `tokens_css_url`, `bundle_js_url`, `last_synced_at`, `last_sync_version`, `last_capsule_version`, `sync_status`, `sync_error`, `created_at`, `updated_at`.

#### `ds_versions` (inferred)
`id`, `user_id`, `ds_connection_id`, `version`, `title`, `notes`, `capsule_id`, `capsule_version`, `tokens_snapshot`, `rules_snapshot`, `feelings_snapshot`, `anti_slop_score`, `tokens_css_url`, `readme_patch_url`, `skill_patch_url`, `components_patch_url`, `report_url`, `is_current`, `published_by`, `created_at`.

#### `ds_changelog` (inferred)
`id`, `user_id`, `version_id`, `category`, `change_type`, `description`, `before_value`, `after_value`, `source`, `created_at`.

**RLS status for all three DS tables: UNKNOWN.** No migration file exists to confirm or deny policies.

---

## Section 2: Every `user_id` Reference in the Codebase

### `src/lib/captures.ts`

| Function | Operation | `user_id` handling |
|---|---|---|
| `saveCapture()` | INSERT | Explicit: `user_id: user.id` |
| `flushOfflineQueue()` | INSERT (batched) | Explicit: `user_id: user.id` on each row |
| `getRecentCaptures()` | SELECT | RLS only — no explicit filter |
| `getTodayCaptures()` | SELECT | RLS only |
| `getInboxCaptures()` | SELECT | RLS only |
| `searchCaptures()` | SELECT | RLS only |
| `updateCapture()` | UPDATE | Filter by `id` only — RLS only |
| `deleteCapture()` | DELETE | Filter by `id` only — RLS only |
| `acceptAgentSuggestion()` | UPDATE | Filter by `id` only — RLS only |
| `acceptAllSuggestions()` | UPDATE (multiple) | Filter by `id` only — RLS only |
| `bulkAssignContext()` | UPDATE | Filter by `id` array — RLS only |
| `bulkAddTags()` | UPDATE | Filter by `id` array — RLS only |

### `src/lib/contexts.ts`

| Function | Operation | `user_id` handling |
|---|---|---|
| `createContext()` | INSERT | Explicit: `user_id: user.id` |
| `getContexts()` | SELECT | RLS only |
| `getContextById()` | SELECT | RLS only |
| `getCapturesForContext()` | SELECT | RLS only |
| `updateContextAssignment()` | UPDATE | Filter by `id` only — RLS only |

### `src/lib/capsule.ts`

| Function | Operation | `user_id` handling |
|---|---|---|
| `saveCapsule()` | INSERT | Explicit: `user_id: user.id` |

### `src/lib/ds-connections.ts`

All functions accept `userId` as an explicit parameter — no reliance on RLS.

| Function | Operation | `user_id` handling |
|---|---|---|
| `getDSConnections(userId)` | SELECT | Explicit: `.eq('user_id', userId)` |
| `createDSConnection(userId, ...)` | INSERT | Explicit: `user_id: userId` |
| `createDSVersion(userId, ...)` | INSERT | Explicit: `user_id: userId` |
| `getRecentDSChangelog(userId, ...)` | SELECT | Explicit: filter on `ds_versions.user_id` |
| `insertChangelogEntries(userId, ...)` | INSERT (batched) | Explicit: `user_id: userId` on each entry |

### `src/app/api/capsule/generate/route.ts`

Uses a **service-role client** (bypasses RLS), then manually verifies session.

| Query | Filter | `user_id` handling |
|---|---|---|
| Context lookup | `.eq('id', contextId)` | **No `user_id` filter** |
| Captures lookup (primary) | `.contains('context_ids', [contextId])` | **No `user_id` filter** |
| Captures lookup (parent) | `.contains('context_ids', contextIds)` | **No `user_id` filter** |
| Capsule INSERT | `user_id: user.id` | Explicit |

### `src/app/api/ds/sync/route.ts`

Uses session-aware client (respects RLS). All queries additionally carry explicit `user_id` filters.

| Query | `user_id` handling |
|---|---|
| Capsule lookup | `.eq('user_id', user.id)` |
| Captures (3 separate queries) | `.eq('user_id', user.id)` each |
| Changelog object construction | `user_id: user.id` on each object |

### `src/app/api/agent/triage/route.ts`

4 explicit `.eq('user_id', user.id)` filters: capture lookup, tag context query, contexts lookup, capture update.

---

## Section 3: Auth Implementation Details

- **Method**: Magic-link only (`signInWithOtp`) — no passwords, no OAuth, no anonymous.
- **Flow**: Email → OTP email → `/auth/callback` → `exchangeCodeForSession` → redirect `/feed`.
- **Middleware** (`src/middleware.ts`): runs on every request; refreshes session cookie via `createServerClient` from `@supabase/ssr`. Gates all app routes. Allowed without auth: `/login`, `/auth/*`, `/share/*`, `/api/*` (self-guarded individually), static assets.
- **Browser client** (`src/lib/supabase.ts`): `createBrowserClient(supabaseUrl, supabaseAnonKey)`. `getOrCreateSession()` calls `auth.getUser()`.
- **Server client**: `createServerClient` from `@supabase/ssr` — session-aware, sets cookies, used in most API routes.
- **Service-role client**: used in `capsule/generate/route.ts`. Bypasses RLS entirely. Auth is re-verified manually in that route after creating the service client.
- **Auth ID in DB**: all tables use `auth.uid()` in RLS policies, and application code uses `user.id` from `auth.getUser()`.

---

## Section 4: Capsule Generation and Ownership

- Each capsule generation inserts a **new row** — versioned, not overwritten. Many capsules can exist per `context_id`.
- The generate route verifies the caller is authenticated, but then switches to a service-role client for all DB reads.
- **Context fetch**: queries `contexts` table by `id` only — no ownership check. If given another user's `contextId`, the service-role client will return that row.
- **Captures fetch**: queries by `context_ids` array containment — no ownership check. Same exposure.
- **Capsule insert**: uses `user_id: user.id` from the verified session — correctly attributed.
- **Public flag mechanism**: not a `is_public` boolean. A capsule is considered public when `protocol_json_url IS NOT NULL`. This is also the condition used in the 5th RLS policy (`"Public capsules are viewable by all"`).
- There is no capsule-per-user limit or uniqueness constraint. The home screen picks the most recently created capsule.

---

## Section 5: Captures and Contexts Relationship

- Captures have a `context_ids uuid[]` column — a many-to-many relationship stored as an array on the capture row. There is no join table.
- Assignment is additive: assigning a capture to a context adds the context's UUID to the array. The capture is not "moved" — it remains in the general library.
- Contexts have a `parent_id` self-reference for hierarchy (Personal → Brand → Project per `CLAUDE.md`).
- `getCapturesForContext()` queries captures where `context_ids @> ARRAY[contextId]` (array containment) — relies on RLS for tenant isolation.
- There is no `context_id` on the capture itself — only the array. Removing a context would require a data migration to scrub its ID from all `context_ids` arrays.

---

## Section 6: DS Connection Layer State

- All three DS tables (`ds_connections`, `ds_versions`, `ds_changelog`) were created **outside the version-controlled migration**. No `supabase/migrations/` file governs them. Their current RLS configuration in production is unknown from code inspection alone.
- All DS functions in `src/lib/ds-connections.ts` pass `userId` explicitly — they do not rely on RLS for tenant isolation in application logic. This is defense-in-depth where RLS status is unknown.
- Source comment in `createDSVersion`: `"Not atomic, but acceptable for single-user DS flow"` — an explicit architectural assumption documented in code.
- `ds_connections` has a `context_id` column (FK → `contexts`) — connections are scoped to a context. No join across users is performed in current code.
- `ds_versions.published_by` column exists (string) — semantics unclear from types alone; could be user ID or display name.
- `ds_versions.is_current` is a boolean — likely meant to mark the active version per connection, but no uniqueness constraint is visible in the inferred schema.

---

## Section 7: UI Assumptions About Single Ownership

**Home screen** (`src/app/(app)/feed/page.tsx`):
- Queries `capsules` table with `.order('created_at', {ascending:false}).limit(1).single()` — no explicit `user_id` filter, relies on RLS. Under single-user this always returns the one most-recent capsule. Under multi-tenant, RLS would correctly scope this to the authenticated user's capsules, but `.single()` will error if zero capsules exist.
- Counts in `captures` (today and total): no explicit user_id filter — RLS only.

**UI copy with single-owner framing** (confirmed from file inspection):
- `feed/page.tsx:130`: `"Sharpen your taste, capture daily."` — personal framing
- `contexts/page.tsx:86`: `"Brands and projects for your captures"` — singular owner
- `settings/ds/page.tsx:155`: `"Connect your design system to sync taste from your capsule."` — singular capsule assumed
- `components/ds/ConnectModal.tsx:153`: `"No DS yet — Curato will generate one from your capsule"` — singular

**No multi-user UI elements found**: no team switcher, no workspace selector, no organization field, no "shared with" affordance, no user profile dropdown beyond the sign-out link in the contexts header.

---

## Section 8: Storage and File Ownership

### `capture-media` bucket

- Path pattern: `{user.id}/{folder}/{Date.now()}.{ext}`
- `user.id` is the **first path segment** — isolation is structural.
- Access: signed URL, 1-hour TTL, generated per-request. No public access.
- Bucket-level RLS or policies: not inspectable from code alone.

### `ds-patches` bucket

- Path pattern: `{user.id}/{ds_connection_id}/{version}/`
- `user.id` is the **first path segment** — isolation is structural.
- Access: `getPublicUrl()` — **not signed, not time-limited**. Files are publicly accessible to anyone with the URL. The URL is not guessable (UUID-based), but there is no auth gate.
- The URL is stored in `ds_versions` columns (`tokens_css_url`, `readme_patch_url`, `skill_patch_url`, `components_patch_url`, `report_url`) and passed to the client.

---

## Section 9: Risk Summary

Ordered by severity for a multi-tenant migration.

### Critical

**1. Service-role client fetches unowned data in `/api/capsule/generate`**
The generate route switches to a service-role client that bypasses RLS, then queries `contexts` and `captures` by ID without any `user_id` filter. A malicious authenticated user could supply another user's `contextId` in the POST body and receive their context data and all associated captures. The resulting capsule would be attributed to the attacker (`user_id: user.id`), not the victim.

### High

**2. DS tables have no migration file and unknown RLS status**
`ds_connections`, `ds_versions`, and `ds_changelog` exist in the database but are not versioned in `supabase/migrations/`. Their RLS configuration cannot be confirmed from code inspection. If RLS was never applied, all DS data is accessible to any authenticated user via the anon client. Current protection relies entirely on application-level `user_id` parameter threading in `ds-connections.ts`.

**3. DS patches bucket uses public URLs**
`ds-patches` files are served via `getPublicUrl` — no authentication required to download patch files, readme patches, tokens CSS, or component diffs. Anyone who obtains a URL (from a DB read, from network inspection, or from a shared capsule) can download another user's DS artifacts.

### Medium

**4. DS architecture has an explicit single-user assumption in code**
The comment `"Not atomic, but acceptable for single-user DS flow"` in `createDSVersion` documents that the function was not designed for concurrent writes. Under multi-tenancy, two users writing DS versions simultaneously would not conflict (different `user_id`), but the non-atomic pattern (separate insert then update of `is_current`) could produce inconsistent `is_current` state even for a single user with two concurrent sessions.

**5. Home screen uses `.single()` on capsule query**
`feed/page.tsx` calls `.single()` on the capsules query. If a user has zero capsules (new account), this returns a PostgREST error (`PGRST116`). Current code wraps this in `try/catch` so it fails silently, but it means a new user in a multi-tenant system sees an empty/broken home screen state. Additionally, if the query ever returns more than one row (not possible today with `.limit(1)`, but noted for robustness), `.single()` would error.

### Low

**6. Media signed URLs expire in 1 hour**
Capture media access tokens last 1 hour. For a single-user tool used in short sessions this is fine. Multi-tenant use cases (shared capsules, design handoff) may require longer-lived or publicly accessible media URLs for embedded images — currently there is no mechanism for this.

**7. `protocol_json_url` encodes public state**
Capsule visibility is not a dedicated boolean column. The 5th RLS policy (`"Public capsules are viewable by all"`) fires when `protocol_json_url IS NOT NULL`. Setting a capsule private would require nulling this column, not toggling a flag. This creates a semantic coupling between "public" and "has a protocol export URL" that may cause confusion during migration.

**8. `context_ids` as array prevents efficient FK cleanup**
If a context is deleted, its UUID remains in all `context_ids` arrays across the `captures` table. There is no cascading cleanup (PostgreSQL FK cascade does not operate on array elements). Multi-tenant migrations that reorganize or transfer contexts will need explicit array scrubbing.

---

*End of audit. All findings sourced from: `supabase/migrations/001_initial_schema.sql`, `src/lib/captures.ts`, `src/lib/contexts.ts`, `src/lib/capsule.ts`, `src/lib/ds-connections.ts`, `src/lib/types/design-system.ts`, `src/app/api/capsule/generate/route.ts`, `src/app/api/ds/sync/route.ts`, `src/app/api/agent/triage/route.ts`, `src/lib/storage.ts`, `src/middleware.ts`, `src/lib/supabase.ts`, `src/app/(app)/feed/page.tsx`, `src/app/(app)/contexts/page.tsx`, `src/app/(app)/settings/ds/page.tsx`, `src/components/ds/ConnectModal.tsx`.*
