# Photo Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake photo capture UI with a real camera-first file input that uploads to Supabase Storage and saves a `media_url` on the capture.

**Architecture:** Three targeted changes: (1) extend `onNext` callback type to carry an optional `File`, (2) replace the fake tap-to-gradient in `MediaCapture` with a hidden `<input type="file" capture="environment">` that auto-triggers on mount, shows a real image preview, and passes the file to `onNext`, (3) update `CaptureProvider` to call `saveCaptureWithMedia` when `mediaFile` is present. No new files needed — all changes are in existing files.

**Tech Stack:** React file input (`capture="environment"`), `URL.createObjectURL` for preview, existing `src/lib/captures.ts#saveCaptureWithMedia`, existing `src/lib/storage.ts#uploadMedia`, Supabase Storage bucket `capture-media`.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/capture/CaptureScreen.tsx` | Modify | Extend `onNext` type + replace fake photo UI with real camera input |
| `src/components/capture/CaptureProvider.tsx` | Modify | Call `saveCaptureWithMedia` when `mediaFile` is present |

---

## Task 1: Extend `onNext` type and wire real camera input in `MediaCapture`

**Files:**
- Modify: `src/components/capture/CaptureScreen.tsx`

### Current state (lines 12–16)

```typescript
interface CaptureScreenProps {
  type: CaptureType
  onBack: () => void
  onNext: (data: { content: string; ruleVerb?: RuleVerb; ruleDomain?: string; verdict?: Verdict }) => void
}
```

### Current `MediaCapture` state (lines 186–314)

The component uses fake state (`mediaReady`, a gradient placeholder) and never captures a real file.

---

- [ ] **Step 1: Extend `CaptureScreenProps.onNext` to accept `mediaFile`**

In `src/components/capture/CaptureScreen.tsx`, replace lines 12–16:

```typescript
interface CaptureScreenProps {
  type: CaptureType
  onBack: () => void
  onNext: (data: { content: string; mediaFile?: File; ruleVerb?: RuleVerb; ruleDomain?: string; verdict?: Verdict }) => void
}
```

- [ ] **Step 2: Rewrite the `MediaCapture` component (photo branch only)**

Replace the entire `MediaCapture` function (lines 186–314) with the following. This only changes the photo/collection branch — the voice branch is left as-is:

```typescript
function MediaCapture({ type, onBack, onNext }: { type: 'photo' | 'voice' | 'collection'; onBack: () => void; onNext: CaptureScreenProps['onNext'] }) {
  const [content, setContent] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const typeInfo = CAPTURE_TYPES.find(t => t.id === type)!

  // Auto-open camera on mount for photo/collection
  useEffect(() => {
    if (type !== 'voice') {
      inputRef.current?.click()
    }
  }, [type])

  // Cleanup object URL on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setMediaFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  // ── Voice mock (unchanged) ─────────────────────────────────
  const VOICE_SAMPLES = [
    'The way the light pools on the—',
    'The way the light pools on the concrete here — that warmth shouldn\'t work against the cold material, but it does.',
    'The way the light pools on the concrete here — that warmth shouldn\'t work against the cold material, but it does. This is what earned contrast feels like.',
  ]

  useEffect(() => {
    if (!recording) return
    let step = 0
    const iv = setInterval(() => {
      step++
      const sample = VOICE_SAMPLES[Math.min(step - 1, VOICE_SAMPLES.length - 1)]
      setTranscript(sample)
      setContent(sample)
      if (step >= VOICE_SAMPLES.length) { clearInterval(iv); setRecording(false) }
    }, 1400)
    return () => clearInterval(iv)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording])

  const canProceed = type === 'voice' ? transcript.length > 0 : (mediaFile != null || content.length > 0)

  return (
    <div className="screen-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--cream)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--line-soft)' }}>
        <button onClick={onBack} style={{ background: 'none', color: 'var(--ink-soft)', cursor: 'pointer', padding: 4 }}>
          <Ic.back width={20} height={20} />
        </button>
        <span className="label">{typeInfo.label}</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {type === 'voice' ? (
          /* ── Voice (unchanged mock) ── */
          <div style={{ margin: 16, borderRadius: 12, background: 'var(--panel)', padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, border: '1.5px solid var(--line-soft)' }}>
            <Wave active={recording} />
            <button
              onClick={() => { if (recording) { setRecording(false) } else { setRecording(true); setTranscript(''); setContent('') } }}
              style={{
                width: 64, height: 64, borderRadius: 32,
                background: recording ? 'var(--red)' : 'var(--violet)',
                color: '#fff', border: 'none', display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                animation: recording ? 'pulse 1.2s infinite' : 'none',
                boxShadow: `0 6px 20px ${recording ? 'rgba(158,52,66,0.4)' : 'rgba(74,61,176,0.35)'}`,
              }}
            >
              <Ic.mic width={26} height={26} />
            </button>
            <span style={{ fontSize: 11, color: recording ? 'var(--red)' : 'var(--ink-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {recording ? '● Recording…' : transcript ? 'Tap to re-record' : 'Tap to record'}
            </span>
          </div>
        ) : (
          /* ── Photo / Collection ── */
          <div style={{ position: 'relative', margin: 16, borderRadius: 12, overflow: 'hidden', border: '1.5px solid var(--line-soft)' }}>
            {/* Hidden camera input — triggers native camera immediately */}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {/* Tap area: shows preview if photo taken, otherwise camera icon */}
            <div
              onClick={() => inputRef.current?.click()}
              style={{
                aspectRatio: type === 'collection' ? '3/2' : '4/3',
                background: previewUrl ? 'var(--ink)' : 'var(--panel)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                flexDirection: 'column', gap: 10,
                position: 'relative', overflow: 'hidden',
              }}
            >
              {previewUrl ? (
                /* Photo preview */
                <>
                  <img
                    src={previewUrl}
                    alt="Captured photo"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* Retake button overlay */}
                  <div style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 2 }}>
                    <button
                      onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
                      style={{
                        padding: '6px 12px', borderRadius: 20,
                        background: 'rgba(20,18,16,0.7)', backdropFilter: 'blur(6px)',
                        color: '#fff', fontSize: 11, letterSpacing: '0.04em',
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      Retake
                    </button>
                  </div>
                </>
              ) : (
                /* Empty state */
                <>
                  <Ic.camera width={36} height={36} style={{ color: 'var(--ink-faint)' }} />
                  <span style={{ fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.04em' }}>Tap to capture</span>
                </>
              )}
            </div>
          </div>
        )}

        <div style={{ padding: '4px 16px 12px' }}>
          <div className="label" style={{ marginBottom: 6 }}>{transcript ? 'Transcript' : 'Annotation'}</div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={previewUrl ? 'Add a note about this photo…' : 'Type an observation…'}
            rows={3}
            style={{ width: '100%', resize: 'none', background: 'var(--cream-2)', border: '1.5px solid var(--line-soft)', borderRadius: 8, color: 'var(--ink)', fontSize: 13, padding: '10px 12px', lineHeight: 1.55 }}
          />
        </div>
      </div>

      <div style={{ padding: '10px 16px 14px' }}>
        <button
          onClick={() => onNext({ content, mediaFile: mediaFile ?? undefined })}
          disabled={!canProceed}
          style={{
            width: '100%', padding: '15px',
            background: canProceed ? 'var(--violet)' : 'var(--panel)',
            borderRadius: 10,
            color: canProceed ? '#fff' : 'var(--ink-faint)',
            fontSize: 13, letterSpacing: '0.04em', cursor: canProceed ? 'pointer' : 'default',
            transition: 'background .2s, color .2s',
          }}
        >
          Add context →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/Users/saulsuaza/Documents/CLAUDE CODE PROJECTS/Taste App/taste" && pnpm build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` — no type errors about `mediaFile` or `onNext`.

- [ ] **Step 4: Commit**

```bash
git add src/components/capture/CaptureScreen.tsx
git commit -m "feat(photo): real camera input with preview in MediaCapture"
```

---

## Task 2: Update `CaptureProvider` to upload photo when `mediaFile` is present

**Files:**
- Modify: `src/components/capture/CaptureProvider.tsx`

### Current state (lines 57–59)

```typescript
function onCaptureNext(data: { content: string; ruleVerb?: RuleVerb; ruleDomain?: string; verdict?: Verdict }) {
  flowData.current = { ...flowData.current, ...data }
```

### Current `persistAndDone` (lines 75–100)

```typescript
async function persistAndDone(ctx?: ContextData) {
  // ...
  const saved = await saveCapture(insert)
```

---

- [ ] **Step 1: Extend `flowData` ref type to include `mediaFile`**

In `src/components/capture/CaptureProvider.tsx`, find the `flowData` ref declaration (around line 30–40). It will look something like:

```typescript
const flowData = useRef<{
  type?: CaptureType
  content?: string
  ruleVerb?: RuleVerb
  // ... etc
}>({})
```

Add `mediaFile` to the type:

```typescript
const flowData = useRef<{
  type?: CaptureType
  content?: string
  mediaFile?: File
  ruleVerb?: RuleVerb
  ruleDomain?: string
  verdict?: Verdict
}>({})
```

- [ ] **Step 2: Update `onCaptureNext` signature to accept `mediaFile`**

Find `onCaptureNext` (around line 57) and update its parameter type:

```typescript
function onCaptureNext(data: { content: string; mediaFile?: File; ruleVerb?: RuleVerb; ruleDomain?: string; verdict?: Verdict }) {
  flowData.current = { ...flowData.current, ...data }
  const { type, verdict } = flowData.current

  // Reaction with verdict: skip context step, save immediately
  if (type === 'reaction' && verdict != null) {
    void persistAndDone()
    return
  }
  setStep('context')
}
```

- [ ] **Step 3: Import `saveCaptureWithMedia` in `CaptureProvider`**

At the top of `src/components/capture/CaptureProvider.tsx`, update the import from `captures`:

```typescript
import { saveCapture, saveCaptureWithMedia, flushOfflineQueue } from '@/lib/captures'
```

- [ ] **Step 4: Update `persistAndDone` to call `saveCaptureWithMedia` when file present**

Find `persistAndDone` (around line 75) and replace the `saveCapture` call:

```typescript
async function persistAndDone(ctx?: ContextData) {
  const { type, content, ruleVerb, verdict, mediaFile } = flowData.current

  // Ensure anon session exists (best-effort; saveCapture handles offline)
  let session = null
  try { session = await getOrCreateAnonSession() } catch { /* offline — queue will handle */ }
  await flushOfflineQueue()

  const insert: CaptureInsert = {
    type: type!,
    content: content ?? '',
    verdict: verdict ?? null,
    rule_verb: ruleVerb,
    tags: ctx?.tags,
    domains: ctx?.domain ? [ctx.domain] : undefined,
    context_ids: [],
  }

  // Upload photo if present, otherwise plain save
  const saved = mediaFile
    ? await saveCaptureWithMedia(insert, mediaFile, 'photos')
    : await saveCapture(insert)

  if (saved && session?.user?.id) {
    void triggerAgent(saved.id, session.user.id)
  }
  setSavedEntry({ type: type!, content: content ?? '', verdict: verdict ?? null, domain: ctx?.domain ?? '', tags: ctx?.tags ?? [] })
  setStep('done')
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "/Users/saulsuaza/Documents/CLAUDE CODE PROJECTS/Taste App/taste" && pnpm build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` — no errors about `saveCaptureWithMedia`, `mediaFile`, or type mismatches.

- [ ] **Step 6: Commit**

```bash
git add src/components/capture/CaptureProvider.tsx
git commit -m "feat(photo): upload to Supabase Storage via saveCaptureWithMedia"
```

---

## Task 3: Manual end-to-end verification

**Files:** None (testing only)

- [ ] **Step 1: Start dev server**

```bash
cd "/Users/saulsuaza/Documents/CLAUDE CODE PROJECTS/Taste App/taste" && pnpm dev
```

- [ ] **Step 2: Test in mobile Chrome (DevTools)**

1. Open http://localhost:3000 in Chrome
2. Open DevTools → toggle mobile view (iPhone, any size)
3. Tap the FAB → select "Photo"
4. A file picker / camera dialog should open immediately on mount
5. Select any image from your library (or take a photo if on device)
6. Image should appear as a preview in the capture area
7. Tap "Retake" — file picker should open again
8. Add an annotation (optional)
9. Tap "Add context →" — should proceed to ContextStep
10. Complete the flow → tap Save

Expected: Capture saved, appears in Feed with a photo thumbnail.

- [ ] **Step 3: Verify `media_url` saved in Supabase**

Open Supabase dashboard → Table Editor → `captures` table → find the most recent row.

Expected: `media_url` column contains a storage path like `<user-id>/photos/1234567890.jpg` (not null).

- [ ] **Step 4: Verify image in Supabase Storage**

Open Supabase dashboard → Storage → `capture-media` bucket → navigate to `<user-id>/photos/`.

Expected: The uploaded image file is present.

- [ ] **Step 5: Push to GitHub**

```bash
cd "/Users/saulsuaza/Documents/CLAUDE CODE PROJECTS/Taste App/taste" && git push origin main
```

Expected: Push succeeds, 2 commits pushed.
