# Curato Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Curato Inbox — a full-screen triage interface at `/inbox` where users swipe through unreviewed captures (verdict IS NULL), tag them, add observations, and either "Add to library" (verdict='keep') or "Skip for now" (defer to next session).

**Architecture:** New route `/src/app/(app)/inbox/page.tsx` (client component, dark-themed) assembles three child components: `TriageCard` (swipeable full-screen card for photo/voice variants), `VoiceRecorder` (overlay for recording new voice captures), and `TagRow` (horizontal scrolling chip selector). Data layer: new `getInboxCaptures()` function in `captures.ts`; triage uses existing `updateCapture`. HomeScreen's `StepRail` gains an Inbox row linking to the route.

**Tech Stack:** Next.js 14 App Router (`'use client'`), Supabase browser client, MediaRecorder API, Visual Viewport API, touch/mouse drag events, existing `/api/transcribe` route, CSS variables from design system.

---

## File Map

**Create:**
- `src/components/inbox/TagRow.tsx` — horizontal scrolling tag chip row (pure UI)
- `src/components/inbox/TriageCard.tsx` — full-screen swipeable card (photo + voice variants)
- `src/components/inbox/VoiceRecorder.tsx` — full-screen recording overlay
- `src/app/(app)/inbox/page.tsx` — InboxScreen: state machine, data fetch, queue logic

**Modify:**
- `src/lib/captures.ts` — add `getInboxCaptures(limit?: number): Promise<Capture[]>`
- `src/components/home/StepRail.tsx` — add `inboxCount` prop; wire row 01 to `/inbox`
- `src/app/(app)/feed/page.tsx` — fetch `inboxCount`, pass to `StepRail`

---

## Design System Reference

Colors (dark theme used in InboxScreen):
- Screen bg: `#0A0A0A`
- Primary text: `var(--cream)` = `#F3ECDD`
- Secondary text: `rgba(243,236,221,0.5)`
- Faint text / metadata: `rgba(243,236,221,0.4)`
- Accent: `var(--violet)` = `#4A3DB0`
- Destructive (stop rec): `#C45F6B`
- Border: `rgba(243,236,221,0.12)`
- Photo gradient: `linear-gradient(to bottom, transparent 0%, rgba(10,10,10,0.7) 50%, #0A0A0A 92%)`

Fonts: `var(--mono)` (DM Mono), `var(--display)` (ABCArizona Flare)

Rules: `borderRadius: 0` on all buttons and cards. No external icon libraries — `Ic.*` from `src/components/icons.tsx` only. `Ic.mic` exists for microphone.

Keyframes already in `src/app/globals.css`: `shimmer`, `fadeUp`, `wave-a`, `wave-b`, `wave-c`, `wave-d`.

---

## Task 1: Data layer — `getInboxCaptures`

**Files:**
- Modify: `src/lib/captures.ts` (append after `getTodayCaptures`)

- [ ] **Step 1: Append the function to `src/lib/captures.ts`**

Add after the closing brace of `getTodayCaptures` (around line 94), before `subscribeToTodayCaptures`:

```typescript
export async function getInboxCaptures(limit = 20): Promise<Capture[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('captures')
    .select('*')
    .is('verdict', null)
    .in('type', ['photo', 'voice'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) { console.error('getInboxCaptures:', error); return [] }
  return (data ?? []) as Capture[]
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
cd /Users/saulsuaza/Documents/CLAUDE\ CODE\ PROJECTS/Taste\ App/taste && pnpm build 2>&1 | tail -20
```

Expected: no TypeScript or build errors related to `captures.ts`.

- [ ] **Step 3: Commit**

```bash
cd /Users/saulsuaza/Documents/CLAUDE\ CODE\ PROJECTS/Taste\ App/taste && git add src/lib/captures.ts && git commit -m "feat: add getInboxCaptures() — fetches verdict-null photo/voice captures"
```

---

## Task 2: TagRow component

**Files:**
- Create: `src/components/inbox/TagRow.tsx`

- [ ] **Step 1: Create `src/components/inbox/TagRow.tsx`**

```typescript
'use client'

interface Props {
  suggestions: string[]
  selected: string[]
  onToggle: (tag: string) => void
}

export function TagRow({ suggestions, selected, onToggle }: Props) {
  return (
    <div style={{
      display: 'flex',
      gap: 8,
      overflowX: 'auto',
      scrollbarWidth: 'none',
      paddingBottom: 2,
      msOverflowStyle: 'none',
    } as React.CSSProperties}>
      {suggestions.map(tag => {
        const active = selected.includes(tag)
        return (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            style={{
              flexShrink: 0,
              height: 32,
              padding: '0 12px',
              borderRadius: 0,
              border: `1px solid ${active ? 'var(--violet)' : 'rgba(243,236,221,0.25)'}`,
              background: active ? 'var(--violet)' : 'rgba(243,236,221,0.07)',
              color: active ? '#F3ECDD' : 'rgba(243,236,221,0.65)',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            {tag}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/saulsuaza/Documents/CLAUDE\ CODE\ PROJECTS/Taste\ App/taste && pnpm build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/saulsuaza/Documents/CLAUDE\ CODE\ PROJECTS/Taste\ App/taste && git add src/components/inbox/TagRow.tsx && git commit -m "feat: add TagRow component for inbox triage tag selection"
```

---

## Task 3: TriageCard component

**Files:**
- Create: `src/components/inbox/TriageCard.tsx`

This component renders a full-screen triage card for one capture. It handles swipe gesture detection (touch + mouse). It comes in two visual variants: photo (full-bleed image with gradient overlay) and voice (dark bg, static waveform bars, transcription text). Both variants share a bottom content section: source metadata, TagRow, separator, and observation textarea.

Swipe threshold: 80px. Swipe right → `onSwipeRight()`. Swipe left → `onSwipeLeft()`. Touches/clicks on `textarea` or `button` inside the card do NOT start a drag.

Exit animation: `translateX(±120vw)` with 0.28s ease, then parent calls the callback after 300ms.

- [ ] **Step 1: Create `src/components/inbox/TriageCard.tsx`**

```typescript
'use client'

import { useRef, useCallback, useEffect } from 'react'
import type { Capture } from '@/types/capture'
import { TagRow } from './TagRow'

const STATIC_TAGS = ['composition', 'lighting', 'texture', 'color', 'minimal', 'editorial', 'restraint', 'material']
const THRESHOLD = 80

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

interface Props {
  capture: Capture
  observation: string
  selectedTags: string[]
  onObservationChange: (val: string) => void
  onTagToggle: (tag: string) => void
  onSwipeLeft: () => void
  onSwipeRight: () => void
}

export function TriageCard({
  capture, observation, selectedTags,
  onObservationChange, onTagToggle,
  onSwipeLeft, onSwipeRight,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, startX: 0, currentX: 0 })

  const applyTransform = useCallback((dx: number) => {
    const card = cardRef.current
    if (!card) return
    card.style.transform = `translateX(${dx}px) rotate(${dx * 0.03}deg)`
    const addHint = card.querySelector<HTMLElement>('[data-hint="add"]')
    const skipHint = card.querySelector<HTMLElement>('[data-hint="skip"]')
    const ratio = Math.min(1, Math.abs(dx) / 100)
    if (dx > 0) {
      if (addHint) addHint.style.opacity = String(ratio)
      if (skipHint) skipHint.style.opacity = '0'
    } else {
      if (skipHint) skipHint.style.opacity = String(ratio)
      if (addHint) addHint.style.opacity = '0'
    }
  }, [])

  const resetTransform = useCallback(() => {
    const card = cardRef.current
    if (!card) return
    card.style.transition = 'transform 0.22s cubic-bezier(0.4,0,0.2,1)'
    card.style.transform = 'none'
    card.querySelectorAll<HTMLElement>('[data-hint]').forEach(el => { el.style.opacity = '0' })
    setTimeout(() => { if (card) card.style.transition = 'none' }, 240)
  }, [])

  const exitCard = useCallback((dir: 'left' | 'right') => {
    const card = cardRef.current
    if (!card) return
    card.style.transition = 'transform 0.28s ease, opacity 0.24s ease'
    card.style.transform = dir === 'right' ? 'translateX(110vw) rotate(6deg)' : 'translateX(-110vw) rotate(-6deg)'
    card.style.opacity = '0'
  }, [])

  const isInteractive = (target: EventTarget | null) =>
    !!(target as HTMLElement)?.closest('textarea, button, input')

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (isInteractive(e.target)) return
    drag.current = { active: true, startX: e.touches[0].clientX, currentX: e.touches[0].clientX }
    if (cardRef.current) cardRef.current.style.transition = 'none'
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!drag.current.active) return
    drag.current.currentX = e.touches[0].clientX
    applyTransform(drag.current.currentX - drag.current.startX)
  }, [applyTransform])

  const onTouchEnd = useCallback(() => {
    if (!drag.current.active) return
    drag.current.active = false
    const dx = drag.current.currentX - drag.current.startX
    if (dx > THRESHOLD) { exitCard('right'); setTimeout(onSwipeRight, 300) }
    else if (dx < -THRESHOLD) { exitCard('left'); setTimeout(onSwipeLeft, 300) }
    else resetTransform()
  }, [exitCard, onSwipeLeft, onSwipeRight, resetTransform])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (isInteractive(e.target)) return
    drag.current = { active: true, startX: e.clientX, currentX: e.clientX }
    if (cardRef.current) cardRef.current.style.transition = 'none'
    e.preventDefault()
  }, [])

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!drag.current.active) return
    drag.current.currentX = e.clientX
    applyTransform(drag.current.currentX - drag.current.startX)
  }, [applyTransform])

  const onMouseUp = useCallback(() => {
    if (!drag.current.active) return
    drag.current.active = false
    const dx = drag.current.currentX - drag.current.startX
    if (dx > THRESHOLD) { exitCard('right'); setTimeout(onSwipeRight, 300) }
    else if (dx < -THRESHOLD) { exitCard('left'); setTimeout(onSwipeLeft, 300) }
    else resetTransform()
  }, [exitCard, onSwipeLeft, onSwipeRight, resetTransform])

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  const suggestions = [...new Set([...(capture.ai_tags ?? []), ...STATIC_TAGS])].slice(0, 8)
  const isVoice = capture.type === 'voice'

  // Static waveform heights for voice cards
  const WAVE_H = [32, 56, 44, 72, 52, 38, 64, 48, 36, 60]
  const WAVE_ANIM = ['wave-a', 'wave-b', 'wave-c', 'wave-d', 'wave-b', 'wave-a', 'wave-c', 'wave-d', 'wave-b', 'wave-c']

  const contentSection = (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 11,
        color: 'rgba(243,236,221,0.4)',
        marginBottom: 10, letterSpacing: '0.03em',
      }}>
        {isVoice ? 'Voice note' : 'Camera Roll'} · {timeAgo(capture.created_at)}
      </div>
      <div style={{ marginBottom: 10 }}>
        <TagRow suggestions={suggestions} selected={selectedTags} onToggle={onTagToggle} />
      </div>
      <div style={{ height: 1, background: 'rgba(243,236,221,0.12)', marginBottom: 10 }} />
      <textarea
        placeholder="What do you notice?"
        value={observation}
        onChange={e => onObservationChange(e.target.value)}
        rows={1}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontSize: 16,
          color: '#F3ECDD',
          resize: 'none',
          lineHeight: 1.45,
          padding: 0,
          fontFamily: 'var(--display)',
          maxHeight: 80,
          overflow: 'hidden',
          display: 'block',
          boxSizing: 'border-box',
        }}
        onInput={e => {
          const t = e.currentTarget
          t.style.height = 'auto'
          t.style.height = Math.min(t.scrollHeight, 80) + 'px'
        }}
      />
    </div>
  )

  return (
    <div
      ref={cardRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute', inset: 0,
        userSelect: 'none',
        cursor: 'grab',
        willChange: 'transform',
        overflow: 'hidden',
      }}
    >
      {isVoice ? (
        <div style={{
          position: 'absolute', inset: 0,
          background: '#111',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Voice content: waveform + transcription centered, then flex-push to bottom */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 72, marginBottom: 24 }}>
              {WAVE_H.map((h, i) => (
                <div key={i} style={{
                  width: 3, height: h,
                  background: 'rgba(74,61,176,0.5)',
                  borderRadius: 1.5,
                  transformOrigin: 'bottom',
                  animation: `${WAVE_ANIM[i]} ${1.4 + i * 0.12}s ease-in-out infinite`,
                }} />
              ))}
            </div>
            {capture.content && (
              <p style={{
                margin: 0,
                fontFamily: 'var(--display)',
                fontSize: 16,
                color: 'rgba(243,236,221,0.75)',
                lineHeight: 1.6,
                textAlign: 'center',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 5,
                WebkitBoxOrient: 'vertical',
              } as React.CSSProperties}>
                {capture.content}
              </p>
            )}
          </div>
          {contentSection}
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0 }}>
          {capture.media_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={capture.media_url}
              alt={capture.content || 'capture'}
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              animation: 'shimmer 1.4s ease-in-out infinite',
            }} />
          )}
          {/* Gradient overlay */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(10,10,10,0.7) 45%, #0A0A0A 92%)',
            pointerEvents: 'none',
          }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            {contentSection}
          </div>
        </div>
      )}

      {/* Swipe hint labels */}
      <div data-hint="add" style={{
        position: 'absolute', top: '38%', right: 16,
        fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', fontWeight: 700,
        color: '#7B71E8', background: 'rgba(0,0,0,0.55)',
        padding: '4px 8px', opacity: 0, pointerEvents: 'none',
      }}>ADD →</div>
      <div data-hint="skip" style={{
        position: 'absolute', top: '38%', left: 16,
        fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', fontWeight: 700,
        color: 'rgba(243,236,221,0.75)', background: 'rgba(0,0,0,0.55)',
        padding: '4px 8px', opacity: 0, pointerEvents: 'none',
      }}>← SKIP</div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/saulsuaza/Documents/CLAUDE\ CODE\ PROJECTS/Taste\ App/taste && pnpm build 2>&1 | tail -30
```

Expected: no TypeScript errors. The `-webkit-box` display value may trigger a React unknown CSS property warning — wrap those specific styles with `as React.CSSProperties` (already done above).

- [ ] **Step 3: Commit**

```bash
cd /Users/saulsuaza/Documents/CLAUDE\ CODE\ PROJECTS/Taste\ App/taste && git add src/components/inbox/TriageCard.tsx && git commit -m "feat: add TriageCard — swipeable photo/voice triage card with observation + tags"
```

---

## Task 4: VoiceRecorder component

**Files:**
- Create: `src/components/inbox/VoiceRecorder.tsx`

Full-screen fixed overlay shown when the user wants to record a new voice note from the inbox empty state. Uses `MediaRecorder` API to capture audio. Shows animated waveform bars (using `wave-a/b/c/d` keyframes from `globals.css`), a running timer, a stop button (red circle with white square), and a Cancel link.

Flow:
1. Mounts → `getUserMedia({ audio: true })` → start recording
2. Timer ticks every second
3. Stop button → stop MediaRecorder → collect chunks → POST to `/api/transcribe` → call `onSave(blob, transcript)`
4. Cancel button → stop and discard → call `onCancel()`

- [ ] **Step 1: Create `src/components/inbox/VoiceRecorder.tsx`**

```typescript
'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface Props {
  onSave: (audioBlob: Blob, transcript: string) => Promise<void>
  onCancel: () => void
}

const WAVE_HEIGHTS = [36, 68, 50, 84, 60, 40, 76, 52, 44, 72]
const WAVE_ANIMS = ['wave-a', 'wave-b', 'wave-c', 'wave-d', 'wave-b', 'wave-a', 'wave-c', 'wave-d', 'wave-b', 'wave-c']

export function VoiceRecorder({ onSave, onCancel }: Props) {
  const [seconds, setSeconds] = useState(0)
  const [saving, setSaving] = useState(false)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let mr: MediaRecorder

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        streamRef.current = stream
        mr = new MediaRecorder(stream)
        mediaRef.current = mr
        chunksRef.current = []

        mr.ondataavailable = e => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }

        mr.start(100)
        timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
      })
      .catch(err => {
        console.error('Microphone access denied:', err)
        onCancel()
      })

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (mediaRef.current?.state !== 'inactive') {
        mediaRef.current?.stop()
      }
    }
  }, [onCancel])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    return `${m}:${(s % 60).toString().padStart(2, '0')}`
  }

  const handleStop = useCallback(async () => {
    const mr = mediaRef.current
    if (!mr || saving) return
    setSaving(true)
    if (timerRef.current) clearInterval(timerRef.current)

    await new Promise<void>(resolve => {
      mr.onstop = () => resolve()
      if (mr.state !== 'inactive') mr.stop()
      streamRef.current?.getTracks().forEach(t => t.stop())
    })

    const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })

    let transcript = ''
    try {
      const fd = new FormData()
      fd.append('audio', blob, 'recording.webm')
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json() as { transcript: string }
        transcript = data.transcript ?? ''
      }
    } catch {
      // proceed with empty transcript if transcription fails
    }

    await onSave(blob, transcript)
  }, [saving, onSave])

  const handleCancel = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (mediaRef.current?.state !== 'inactive') mediaRef.current?.stop()
    onCancel()
  }, [onCancel])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0A0A0A',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 60,
    }}>
      {/* Cancel link */}
      <div style={{
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
        left: 20,
      }}>
        <button
          onClick={handleCancel}
          disabled={saving}
          style={{
            background: 'none', border: 'none',
            fontFamily: 'var(--mono)', fontSize: 13,
            color: 'rgba(243,236,221,0.5)',
            cursor: 'pointer', padding: '8px 0', minHeight: 44,
            letterSpacing: '0.03em',
          }}
        >
          Cancel
        </button>
      </div>

      {/* Animated waveform */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, marginBottom: 32, height: 84 }}>
        {WAVE_HEIGHTS.map((h, i) => (
          <div
            key={i}
            style={{
              width: 4, height: h,
              background: 'var(--violet)',
              borderRadius: 2,
              transformOrigin: 'bottom',
              animation: `${WAVE_ANIMS[i]} ${1.2 + i * 0.14}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      {/* Timer */}
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 34,
        color: '#F3ECDD', letterSpacing: '0.06em',
        fontWeight: 500, marginBottom: 52,
      }}>
        {formatTime(seconds)}
      </div>

      {/* Stop button */}
      <button
        onClick={handleStop}
        disabled={saving}
        style={{
          width: 80, height: 80,
          borderRadius: '50%',
          background: saving ? 'rgba(196,95,107,0.5)' : '#C45F6B',
          border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: saving ? 'wait' : 'pointer',
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        <div style={{ width: 24, height: 24, background: '#fff', borderRadius: 3 }} />
      </button>

      <span style={{
        fontFamily: 'var(--mono)', fontSize: 12,
        color: 'rgba(243,236,221,0.4)',
        letterSpacing: '0.04em',
      }}>
        {saving ? 'Saving...' : 'Tap to stop'}
      </span>

      {/* Home indicator space */}
      <div style={{
        position: 'absolute',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
        display: 'flex', justifyContent: 'center', width: '100%',
      }}>
        <div style={{ width: 120, height: 4, background: 'rgba(243,236,221,0.07)', borderRadius: 2 }} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/saulsuaza/Documents/CLAUDE\ CODE\ PROJECTS/Taste\ App/taste && pnpm build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/saulsuaza/Documents/CLAUDE\ CODE\ PROJECTS/Taste\ App/taste && git add src/components/inbox/VoiceRecorder.tsx && git commit -m "feat: add VoiceRecorder — MediaRecorder waveform overlay with transcription"
```

---

## Task 5: InboxScreen page

**Files:**
- Create: `src/app/(app)/inbox/page.tsx`

State machine: `'loading' | 'triage' | 'empty' | 'recording'`

State transitions:
- Mount → fetch → `'triage'` (if items) or `'empty'`
- doAdd → update DB → advance index → `'empty'` if exhausted
- doSkip → advance index without DB write → `'empty'` if exhausted
- FAB mic button → `'recording'`
- VoiceRecorder.onSave → refresh queue → `'triage'`
- VoiceRecorder.onCancel → back to `'triage'` or `'empty'`

Layout (dark theme, `height: '100dvh'`, `overflow: 'hidden'`):
- Fixed header: back button ← / INBOX / pending count
- Card area: fills between header and action bar (using fixed positioning)
- Fixed action bar: 3px progress bar + "Skip for now" + "Add to library" buttons
- Empty state: centered ◈ + headline + mic button
- Recording overlay: `VoiceRecorder` (position: fixed, z-index: 60)

- [ ] **Step 1: Create `src/app/(app)/inbox/page.tsx`**

```typescript
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getInboxCaptures, updateCapture, saveCaptureWithMedia } from '@/lib/captures'
import { Ic } from '@/components/icons'
import type { Capture } from '@/types/capture'
import { TriageCard } from '@/components/inbox/TriageCard'
import { VoiceRecorder } from '@/components/inbox/VoiceRecorder'

type FlowState = 'loading' | 'triage' | 'empty' | 'recording'

const HEADER_H = 56
const ACTION_BAR_H = 112

export default function InboxPage() {
  const router = useRouter()
  const [flow, setFlow] = useState<FlowState>('loading')
  const [queue, setQueue] = useState<Capture[]>([])
  const [index, setIndex] = useState(0)
  const [observation, setObservation] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const prevFlowRef = useRef<FlowState>('triage')

  useEffect(() => {
    getInboxCaptures().then(items => {
      setQueue(items)
      setIndex(0)
      setFlow(items.length > 0 ? 'triage' : 'empty')
    })
  }, [])

  const current = queue[index]

  const resetCard = useCallback(() => {
    setObservation('')
    setSelectedTags([])
  }, [])

  const advance = useCallback((newQueue?: Capture[]) => {
    const q = newQueue ?? queue
    const next = index + 1
    if (next >= q.length) {
      setFlow('empty')
    } else {
      setIndex(next)
      resetCard()
    }
  }, [index, queue, resetCard])

  const doAdd = useCallback(async () => {
    if (!current || saving) return
    setSaving(true)
    await updateCapture(current.id, {
      verdict: 'keep',
      content: observation.trim() || current.content,
      tags: selectedTags.length > 0 ? selectedTags : (current.tags ?? []),
    })
    setSaving(false)
    advance()
  }, [current, saving, observation, selectedTags, advance])

  const doSkip = useCallback(() => {
    if (!current) return
    advance()
  }, [current, advance])

  const onTagToggle = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }, [])

  const startRecording = useCallback(() => {
    prevFlowRef.current = flow
    setFlow('recording')
  }, [flow])

  const onRecordSave = useCallback(async (audioBlob: Blob, transcript: string) => {
    const file = new File([audioBlob], 'recording.webm', { type: audioBlob.type || 'audio/webm' })
    await saveCaptureWithMedia(
      { type: 'voice', content: transcript, verdict: null },
      file,
      'audio'
    )
    const fresh = await getInboxCaptures()
    setQueue(fresh)
    setIndex(0)
    resetCard()
    setFlow(fresh.length > 0 ? 'triage' : 'empty')
  }, [resetCard])

  const onRecordCancel = useCallback(() => {
    setFlow(prevFlowRef.current === 'recording' ? 'empty' : prevFlowRef.current)
  }, [])

  const remaining = queue.length - index
  const progress = queue.length > 0 ? index / queue.length : 0

  const safeTop = `calc(env(safe-area-inset-top, 0px) + ${HEADER_H}px)`
  const safeBottom = `calc(env(safe-area-inset-bottom, 0px) + ${ACTION_BAR_H}px)`

  return (
    <div style={{ background: '#0A0A0A', height: '100dvh', overflow: 'hidden', position: 'relative' }}>

      {/* Recording overlay */}
      {flow === 'recording' && (
        <VoiceRecorder onSave={onRecordSave} onCancel={onRecordCancel} />
      )}

      {/* Header */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: `calc(env(safe-area-inset-top, 0px) + ${HEADER_H}px)`,
        display: 'flex', alignItems: 'flex-end',
        padding: `0 20px 12px`,
        justifyContent: 'space-between',
        background: '#0A0A0A',
        borderBottom: '1px solid rgba(243,236,221,0.07)',
        zIndex: 20, boxSizing: 'border-box',
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none', border: 'none',
            color: 'rgba(243,236,221,0.55)', cursor: 'pointer',
            padding: '4px 0', minHeight: 36, display: 'flex', alignItems: 'center',
          }}
        >
          <Ic.back width={22} height={22} />
        </button>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 12,
          color: 'rgba(243,236,221,0.5)',
          letterSpacing: '0.14em',
        }}>
          INBOX
        </span>
        {flow === 'triage' ? (
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 12,
            color: 'var(--violet)', minWidth: 60, textAlign: 'right',
          }}>
            {remaining} left
          </span>
        ) : (
          <span style={{ minWidth: 60 }} />
        )}
      </div>

      {/* Triage state */}
      {flow === 'triage' && current && (
        <>
          {/* Card viewport */}
          <div style={{
            position: 'fixed',
            top: safeTop,
            bottom: safeBottom,
            left: 0, right: 0,
            overflow: 'hidden',
          }}>
            <TriageCard
              key={current.id}
              capture={current}
              observation={observation}
              selectedTags={selectedTags}
              onObservationChange={setObservation}
              onTagToggle={onTagToggle}
              onSwipeRight={doAdd}
              onSwipeLeft={doSkip}
            />
          </div>

          {/* Action bar */}
          <div style={{
            position: 'fixed',
            bottom: 0, left: 0, right: 0,
            height: `calc(env(safe-area-inset-bottom, 0px) + ${ACTION_BAR_H}px)`,
            background: '#0A0A0A',
            borderTop: '1px solid rgba(243,236,221,0.07)',
            padding: `10px 16px calc(env(safe-area-inset-bottom, 0px) + 10px)`,
            boxSizing: 'border-box',
            zIndex: 20,
          }}>
            {/* Progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                flex: 1, height: 3,
                background: 'rgba(243,236,221,0.08)',
                borderRadius: 2, overflow: 'hidden',
              }}>
                <div style={{
                  height: 3,
                  background: 'var(--violet)',
                  width: `${progress * 100}%`,
                  transition: 'width 0.35s ease',
                }} />
              </div>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 11,
                color: 'rgba(243,236,221,0.4)',
                whiteSpace: 'nowrap',
              }}>
                {index + 1} / {queue.length}
              </span>
            </div>
            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={doSkip}
                style={{
                  flex: 1, height: 52,
                  background: 'rgba(243,236,221,0.04)',
                  border: '1px solid rgba(243,236,221,0.14)',
                  borderRadius: 0,
                  fontFamily: 'var(--mono)', fontSize: 13,
                  color: 'rgba(243,236,221,0.65)',
                  cursor: 'pointer', letterSpacing: '0.03em',
                }}
              >
                Skip for now
              </button>
              <button
                onClick={doAdd}
                disabled={saving}
                style={{
                  flex: 1, height: 52,
                  background: saving ? 'rgba(74,61,176,0.5)' : 'var(--violet)',
                  border: 'none', borderRadius: 0,
                  fontFamily: 'var(--mono)', fontSize: 13,
                  color: '#F3ECDD',
                  cursor: saving ? 'wait' : 'pointer',
                  fontWeight: 600, letterSpacing: '0.03em',
                }}
              >
                {saving ? 'Saving…' : 'Add to library'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {flow === 'empty' && (
        <div style={{
          height: '100dvh',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 40px 60px',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 56,
            color: 'rgba(74,61,176,0.35)',
            marginBottom: 24, lineHeight: 1,
          }}>◈</div>
          <h2 style={{
            fontFamily: 'var(--display)', fontSize: 22,
            fontWeight: 400, color: '#F3ECDD',
            margin: '0 0 10px', letterSpacing: '-0.01em',
          }}>
            {"You're caught up."}
          </h2>
          <p style={{
            fontSize: 14,
            color: 'rgba(243,236,221,0.4)',
            lineHeight: 1.7, margin: '0 0 48px',
            maxWidth: 220,
            fontFamily: 'var(--mono)',
          }}>
            Add photos to your Curato album to grow your library.
          </p>
          <button
            onClick={startRecording}
            style={{
              width: 76, height: 76,
              borderRadius: '50%',
              background: 'rgba(74,61,176,0.1)',
              border: '1px solid rgba(74,61,176,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--violet)',
              marginBottom: 12,
            }}
          >
            <Ic.mic width={28} height={28} />
          </button>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 11,
            color: 'rgba(243,236,221,0.3)',
            letterSpacing: '0.04em',
          }}>
            Record a voice note
          </span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/saulsuaza/Documents/CLAUDE\ CODE\ PROJECTS/Taste\ App/taste && pnpm build 2>&1 | tail -30
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
cd /Users/saulsuaza/Documents/CLAUDE\ CODE\ PROJECTS/Taste\ App/taste && git add src/app/\(app\)/inbox/page.tsx && git commit -m "feat: add InboxScreen — full-screen triage at /inbox with swipe + voice recording"
```

---

## Task 6: HomeScreen — Inbox entry point

**Files:**
- Modify: `src/components/home/StepRail.tsx`
- Modify: `src/app/(app)/feed/page.tsx`

Add `inboxCount` prop to `StepRail`. Row 01 changes from static "Capture" to clickable "Inbox" that routes to `/inbox` and shows the pending count.

The feed page (`src/app/(app)/feed/page.tsx`) already imports and calls `getRecentCaptures`. Add a parallel call to `getInboxCaptures` to get the count.

- [ ] **Step 1: Update `src/components/home/StepRail.tsx`**

Replace the entire file with:

```typescript
'use client'

import { useRouter } from 'next/navigation'

interface Props {
  todayCount: number
  totalCount: number
  inboxCount: number
  onExport: () => void
}

export function StepRail({ todayCount, totalCount, inboxCount, onExport }: Props) {
  const router = useRouter()

  const rows = [
    {
      num: '01',
      title: 'Inbox',
      sub: inboxCount > 0 ? `${inboxCount} to review` : "you're caught up",
      chip: inboxCount > 0
        ? <span style={{
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em',
            color: '#fff', background: 'var(--violet)',
            padding: '2px 7px', borderRadius: 2, fontWeight: 700,
          }}>{inboxCount}</span>
        : <span style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--green)', lineHeight: 1,
          }}>✓</span>,
      onClick: () => router.push('/inbox'),
    },
    {
      num: '02',
      title: 'Library',
      sub: `${totalCount} structured`,
      chip: <span style={{
        fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--green)', lineHeight: 1,
      }}>✓</span>,
      onClick: () => router.push('/library'),
    },
    {
      num: '03',
      title: 'Export',
      sub: 'Claude · Figma · Canva',
      chip: <span style={{
        fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-faint)', lineHeight: 1,
      }}>→</span>,
      onClick: onExport,
    },
  ]

  const todayLine = todayCount > 0
    ? <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--violet)', marginTop: 4 }}>{todayCount} logged today</div>
    : null

  return (
    <div style={{ border: '1px solid var(--line-soft)', borderRadius: 0 }}>
      {rows.map((row, i) => (
        <button
          key={row.num}
          onClick={row.onClick}
          style={{
            display: 'flex', alignItems: 'center',
            width: '100%', minHeight: 48,
            padding: '10px 14px',
            background: 'none', border: 'none',
            borderBottom: i < rows.length - 1 ? '1px solid var(--line-soft)' : 'none',
            cursor: 'pointer',
            textAlign: 'left', gap: 12,
          }}
        >
          <span style={{
            fontFamily: 'var(--display)', fontSize: 12,
            color: i === 0 ? 'var(--violet)' : 'var(--ink-faint)',
            minWidth: 20, flexShrink: 0,
          }}>{row.num}</span>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600,
              color: 'var(--ink)', letterSpacing: '0.02em',
            }}>{row.title}</div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 10,
              color: 'var(--ink-faint)', marginTop: 1,
            }}>{row.sub}</div>
            {i === 0 ? todayLine : null}
          </div>
          {row.chip}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Update `src/app/(app)/feed/page.tsx` to pass `inboxCount`**

Read the file, find where `StepRail` is imported and used, and:
1. Import `getInboxCaptures` alongside existing imports from `@/lib/captures`
2. Add `const [inboxCount, setInboxCount] = useState(0)` to state
3. Inside the data-loading `useEffect` (or in a new `useEffect`), add a call to `getInboxCaptures()` to populate `inboxCount`
4. Pass `inboxCount={inboxCount}` to `<StepRail>`

The exact diff depends on the current file contents. Read the file first:

```bash
cat -n /Users/saulsuaza/Documents/CLAUDE\ CODE\ PROJECTS/Taste\ App/taste/src/app/\(app\)/feed/page.tsx
```

Then make the minimal change to add `inboxCount` state and wire it up. A standalone `useEffect` for inbox count is simplest and avoids disturbing existing loading logic:

```typescript
// Add to imports:
import { getRecentCaptures, getTodayCaptures, getInboxCaptures } from '@/lib/captures'

// Add to state declarations:
const [inboxCount, setInboxCount] = useState(0)

// Add a separate useEffect (after existing ones):
useEffect(() => {
  getInboxCaptures().then(items => setInboxCount(items.length))
}, [])

// Update StepRail usage:
<StepRail
  todayCount={todayCount}
  totalCount={totalCount}
  inboxCount={inboxCount}
  onExport={...}
/>
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/saulsuaza/Documents/CLAUDE\ CODE\ PROJECTS/Taste\ App/taste && pnpm build 2>&1 | tail -30
```

Expected: clean build. If TypeScript complains that `StepRail` no longer accepts `disabled` on row 01 (old `cursor: default` path is removed), that's expected — the row is now always clickable.

- [ ] **Step 4: Commit**

```bash
cd /Users/saulsuaza/Documents/CLAUDE\ CODE\ PROJECTS/Taste\ App/taste && git add src/components/home/StepRail.tsx src/app/\(app\)/feed/page.tsx && git commit -m "feat: wire Inbox row in StepRail — shows pending count, routes to /inbox"
```

---

## Final Verification

- [ ] **Full build passes**

```bash
cd /Users/saulsuaza/Documents/CLAUDE\ CODE\ PROJECTS/Taste\ App/taste && pnpm build
```

Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Push to main**

```bash
cd /Users/saulsuaza/Documents/CLAUDE\ CODE\ PROJECTS/Taste\ App/taste && git push origin main
```

---

## Spec Self-Review

**Coverage check:**
- ✅ State 1 (triage card) — TriageCard component (Task 3) + InboxScreen triage flow (Task 5)
- ✅ State 2 (empty inbox) — InboxScreen empty state (Task 5)
- ✅ State 3 (voice recording) — VoiceRecorder component (Task 4) + InboxScreen recording state (Task 5)
- ✅ Swipe gestures — touch + mouse handlers in TriageCard, 80px threshold, exit animation
- ✅ Observation textarea — in TriageCard contentSection, auto-expands, max 80px
- ✅ Tag selection — TagRow component (Task 2), pre-populated with ai_tags + static fallback
- ✅ "Add to library" — `updateCapture(id, { verdict:'keep', content, tags })` in doAdd
- ✅ "Skip for now" — advance index only, no DB write (item reappears next session)
- ✅ Voice recording from empty state — mic button → VoiceRecorder → transcribe → saveCaptureWithMedia
- ✅ Progress bar — in action bar, width driven by index/queue.length
- ✅ Dark theme — `#0A0A0A` bg throughout, cream text
- ✅ Safe area insets — `env(safe-area-inset-top/bottom, 0px)` on header and action bar
- ✅ HomeScreen entry point — StepRail row 01 updated (Task 6)
- ✅ Data layer — `getInboxCaptures()` (Task 1)

**Type consistency:** `updateCapture(id: string, data)` — used correctly in doAdd. `saveCaptureWithMedia(data: CaptureInsert, file: File, folder)` — used correctly in onRecordSave with `new File([blob], ...)`. `getInboxCaptures()` returns `Capture[]` — used throughout.

**No placeholders found.**
