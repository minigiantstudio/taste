import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { nextVersion } from '@/lib/capsule'
import type { Capture } from '@/types/capture'
import type { Context } from '@/types/context'
import type { DistilledRule } from '@/types/capsule'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createSupabaseClient(url, key)
}

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY
const CLAUDE_MODEL = 'claude-sonnet-4-6'

async function callClaude(prompt: string): Promise<string> {
  if (!CLAUDE_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${response.status} ${err}`)
  }
  const data = await response.json() as { content: Array<{ type: string; text: string }> }
  const block = data.content.find(b => b.type === 'text')
  if (!block) throw new Error('No text response from Claude')
  return block.text
}

export async function POST(req: NextRequest) {
  try {
    // Auth guard: this route is excluded from the middleware gate and uses the
    // service-role key, so it must verify the caller has a session.
    const authed = await createServerSupabaseClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as { contextId?: string }
    const { contextId } = body

    if (!contextId) {
      return NextResponse.json({ error: 'contextId is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Fetch context — ownership check required: service client bypasses RLS
    const { data: contextData, error: contextError } = await supabase
      .from('contexts')
      .select('*')
      .eq('id', contextId)
      .eq('user_id', user.id)
      .single()

    if (contextError || !contextData) {
      return NextResponse.json({ error: 'Context not found' }, { status: 404 })
    }

    const context = contextData as Context

    // Fetch captures for this context — ownership check: service client bypasses RLS
    const { data: capturesData } = await supabase
      .from('captures')
      .select('*')
      .eq('user_id', user.id)
      .contains('context_ids', [contextId])

    let captures: Capture[] = (capturesData ?? []) as Capture[]

    // Also fetch parent context captures if applicable
    if (context.parent_context_id) {
      const { data: parentCapturesData, error: parentError } = await supabase
        .from('captures')
        .select('*')
        .eq('user_id', user.id)
        .contains('context_ids', [context.parent_context_id])

      if (parentError) {
        console.warn('generate: failed to fetch parent captures:', parentError)
      }

      if (parentCapturesData) {
        const parentCaptures = parentCapturesData as Capture[]
        const existingIds = new Set(captures.map(c => c.id))
        const deduplicated = parentCaptures.filter(c => !existingIds.has(c.id))
        captures = [...captures, ...deduplicated]
      }
    }

    // Determine next version (service client — the lib getCapsule uses the browser
    // client, which has no session in this server route).
    const { data: latestRows } = await supabase
      .from('capsules')
      .select('version')
      .eq('context_id', contextId)
      .order('created_at', { ascending: false })
      .limit(1)
    const latestVersion = (latestRows?.[0]?.version as string | undefined) ?? null
    const version = nextVersion(latestVersion ? ({ version: latestVersion } as never) : null)

    // Build capture lines
    const captureLines = captures.map(c => {
      const parts = [
        c.type.toUpperCase(),
        c.verdict ? `[${c.verdict.toUpperCase()}]` : '[UNSET]',
        c.content.slice(0, 300),
      ]
      if (c.tags?.length) parts.push(`tags: ${c.tags?.join(', ')}`)
      if (c.domains?.length) parts.push(`domains: ${c.domains?.join(', ')}`)
      if (c.rule_verb) parts.push(`rule: ${c.rule_verb}`)
      return parts.join(' | ')
    }).join('\n') || '(no captures yet)'

    const prompt = `You are synthesizing an Art Director's aesthetic position into a Taste Capsule.

Context: ${context.name} (${context.type})
Description: ${context.description || 'none'}

Captures (${captures.length} total):
${captureLines}

Generate a Taste Capsule as JSON (no markdown, no explanation — raw JSON only):
{
  "declaration": "string — One sentence. Editorial magazine voice. States the aesthetic position with specificity and conviction. No generalities. Example: 'Every surface earns its warmth through material reality, never decoration.'",
  "distilled_rules": [
    { "verb": "ALWAYS|NEVER|PREFER|AVOID", "domain": "string", "text": "string" }
  ],
  "dominant_domains": ["string"],
  "frequency_map": { "word": 0.0 },
  "capsule_summary": "string — 2-3 sentences. What this designer/brand/project stands for aesthetically."
}

Rules:
- distilled_rules: deduplicated, maximum 12, most important first
- dominant_domains: sorted by frequency in captures
- frequency_map: 20-40 words, weight = aesthetic signal strength 0.1-1.0, skip stop words and generic terms
- Return valid JSON only`

    const rawResponse = await callClaude(prompt)

    // Strip ```json fences if present
    const cleaned = rawResponse
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    let parsed: { declaration: string; distilled_rules: DistilledRule[]; dominant_domains: string[]; frequency_map: Record<string, number>; capsule_summary: string }
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      throw new Error('Failed to parse Capsule JSON from Claude. Raw response: ' + rawResponse.slice(0, 200))
    }

    if (!parsed.declaration || typeof parsed.declaration !== 'string') {
      throw new Error('Claude returned invalid Capsule structure — missing declaration')
    }

    // Save with the service client + the authenticated user (the lib saveCapsule
    // relies on the browser session, which is absent in this server route).
    const { data: capsule, error: saveError } = await supabase
      .from('capsules')
      .insert({
        user_id: user.id,
        context_id: contextId,
        version,
        title: `${context.name} ${version}`,
        declaration: parsed.declaration,
        rules: parsed.distilled_rules,
        frequency_map: parsed.frequency_map,
        protocol_version: '1',
      } as never)
      .select()
      .single()

    if (saveError || !capsule) {
      console.error('generate: failed to save capsule:', saveError)
      throw new Error('Failed to save capsule')
    }

    return NextResponse.json({
      capsule,
      dominant_domains: parsed.dominant_domains,
      capsule_summary: parsed.capsule_summary,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
