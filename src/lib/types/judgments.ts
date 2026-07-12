// ─────────────────────────────────────────────────────────────
// Primitive unions
// ─────────────────────────────────────────────────────────────

export type JudgmentVerb = 'always' | 'never' | 'prefer' | 'avoid'

export type JudgmentStatus = 'proposed' | 'confirmed' | 'rejected' | 'retired'

// ─────────────────────────────────────────────────────────────
// DB row type
// ─────────────────────────────────────────────────────────────

export interface Judgment {
  id: string
  user_id: string
  verb: JudgmentVerb
  domain: string
  statement: string
  context_id: string | null
  status: JudgmentStatus
  confidence: number | null
  strength: number | null
  source_capture_ids: string[]
  proposed_by: string | null
  proposed_at: string
  confirmed_by: string | null
  confirmed_at: string | null
  review_note: string | null
  supersedes_id: string | null
  superseded_at: string | null
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────────────────────
// Extraction input
// ─────────────────────────────────────────────────────────────

export interface ProposedJudgmentInput {
  verb: JudgmentVerb
  domain: string
  statement: string
  context_id?: string
  confidence: number
  source_capture_ids: string[]
}

// ─────────────────────────────────────────────────────────────
// Review input
// ─────────────────────────────────────────────────────────────

export type JudgmentReviewAction = 'confirm' | 'reject' | 'edit_and_confirm'

export interface JudgmentReviewInput {
  judgment_id: string
  action: JudgmentReviewAction
  edited_statement?: string
  strength?: number
  review_note?: string
}

// ─────────────────────────────────────────────────────────────
// Domain vocabulary
// ─────────────────────────────────────────────────────────────

export const JudgmentDomain = [
  'typography', 'color', 'composition', 'texture', 'space', 'motion',
  'material', 'mood',
] as const
