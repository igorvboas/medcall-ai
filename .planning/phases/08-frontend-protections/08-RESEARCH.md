# Phase 8: Frontend Protections - Research

**Researched:** 2026-03-31
**Domain:** Browser Media APIs, beforeunload event, React hooks
**Confidence:** HIGH

## Summary

Phase 8 is a frontend-only phase adding three protective features for the doctor during active consultations: (1) microphone disconnect detection via `MediaStreamTrack.onended` and `navigator.mediaDevices.ondevicechange`, (2) prolonged silence detection using the existing `VoiceActivityDetector` from `audioUtils.ts`, and (3) `beforeunload` protection to prevent accidental tab closure during recording with a flush of pending transcription data.

All three features rely on well-established browser APIs with excellent cross-browser support. No new libraries are needed. The existing codebase already has the building blocks: `VoiceActivityDetector` for audio level monitoring, `useMediaDevices` with `devicechange` listener already wired, and `MediaStream` references accessible from both capture hooks.

**Primary recommendation:** Implement two reusable hooks (`useMicMonitor` and `useBeforeUnloadProtection`) plus a `MicAlertBanner` component. Wire into both presencial `page.tsx` and `ConsultationRoom.tsx` with minimal changes to existing code.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Listen to `track.onended` event on each `MediaStreamTrack` from the active audio stream. When fired, it means the mic was physically disconnected or the OS revoked access.
- **D-02:** Also listen to `navigator.mediaDevices.ondevicechange` as a fallback -- enumerate devices and check if the active device ID is still present.
- **D-03:** Display a non-dismissible banner at the top of the consultation area (not a toast that auto-hides). Red background, icon + message: "Microfone desconectado -- reconecte o microfone para continuar a gravacao". The banner disappears automatically when a new mic is detected/connected.
- **D-04:** Do NOT stop the recording automatically -- the doctor may reconnect the mic and continue. Just alert visually. Audio capture pauses naturally when the track ends.
- **D-05:** Create a reusable React hook `useMicMonitor(stream: MediaStream | null)` that returns `{ isMicConnected: boolean, isSilent: boolean, silenceDurationMs: number }`. Both online and presencial pages import this hook.
- **D-06:** Use the existing `VoiceActivityDetector.getAudioLevel()` from `audioUtils.ts` to monitor audio level. If audio level stays below the VAD threshold for 30 consecutive seconds, show a warning.
- **D-07:** Display an amber/yellow banner (less urgent than mic disconnect): "Microfone silencioso ha mais de 30 segundos -- verifique se o microfone esta funcionando". Auto-dismisses when voice is detected again.
- **D-08:** The 30-second threshold should be configurable via a constant (e.g., `SILENCE_THRESHOLD_MS = 30000`). Check audio level every 1 second using `setInterval`.
- **D-09:** Silence detection only runs while recording is active -- not during setup or after finalization. Reset the silence counter when recording starts.
- **D-10:** Add a `beforeunload` event listener that fires ONLY during active recording/consultation. When the doctor tries to close/navigate away, the browser shows its native confirmation dialog ("Changes you made may not be saved").
- **D-11:** The `beforeunload` handler should also trigger a final flush of any pending transcription data -- call the existing incremental save endpoint (the atomic append RPC from Phase 5) to ensure the latest text is persisted.
- **D-12:** Register the `beforeunload` listener when recording starts, remove it when recording ends or consultation is finalized. Use `useEffect` cleanup to prevent leaks.
- **D-13:** Apply to both online (`ConsultationRoom.tsx` or its parent page) and presencial (`page.tsx`). The hook should be reusable: `useBeforeUnloadProtection(isRecording: boolean, onFlush?: () => void)`.
- **D-14:** Use simple HTML/CSS banners positioned at the top of the consultation content area (inside the consultation layout, not a global toast system). No new UI library needed -- Tailwind classes are sufficient.
- **D-15:** Alert priority: mic disconnect (red, highest) > silence (amber, medium). If both are active, show both stacked with mic disconnect on top.
- **D-16:** Alerts should be accessible -- include `role="alert"` and `aria-live="assertive"` for screen readers.

### Claude's Discretion
- Exact Tailwind classes and styling for alert banners
- Whether `useMicMonitor` and `useBeforeUnloadProtection` go in `/hooks/` or colocated with consultation pages
- Whether to use `requestAnimationFrame` or `setInterval` for audio level polling
- Icon choice for alerts (emoji vs SVG icon)
- Whether silence detection shares the same `VoiceActivityDetector` instance or creates its own

### Deferred Ideas (OUT OF SCOPE)
- **PLOC-01**: IndexedDB local audio persistence -- v2+ scope, not needed with Phase 5 incremental save.
- Visual audio waveform/meter during recording -- nice-to-have but not required for protection alerts.
- Automatic mic switching when preferred mic disconnects -- too complex, just alert the doctor.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDM-01 | Deteccao de mic desconectado via `track.onended` com alerta visual ao medico | `MediaStreamTrack.onended` + `navigator.mediaDevices.ondevicechange` APIs. Both well-supported. `useMicMonitor` hook returns `isMicConnected`. Red banner component with `role="alert"`. |
| AUDM-02 | Deteccao de mic silencioso prolongado com alerta visual ao medico | Existing `VoiceActivityDetector.getAudioLevel()` already returns 0-1 float. `useMicMonitor` hook tracks `isSilent` and `silenceDurationMs` via 1s `setInterval`. Amber banner auto-dismisses on voice. |
| SESS-03 | Protecao contra tab crash com `beforeunload` handler durante gravacao ativa | `beforeunload` event with `event.preventDefault()` + `event.returnValue = ''`. `useBeforeUnloadProtection` hook registers/unregisters based on `isRecording`. Flush callback triggers incremental save. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x (existing) | Hooks (`useState`, `useEffect`, `useRef`, `useCallback`) | Already in project |
| Web Audio API | Browser native | `VoiceActivityDetector` for silence detection (already exists) | No install needed |
| MediaStream API | Browser native | `track.onended` for disconnect detection | No install needed |
| lucide-react | existing | Icons for alert banners (AlertTriangle, XCircle already imported) | Already in project |

### Supporting
No new libraries needed. All functionality uses browser-native APIs and existing project code.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `setInterval` for silence polling | `requestAnimationFrame` | rAF runs at 60fps -- overkill for 1s checks. setInterval at 1000ms is more efficient and aligns with D-08. |
| Own VAD instance in useMicMonitor | Sharing existing VAD from capture hooks | Creating own instance is simpler (hook is self-contained, no prop-drilling VAD refs). Cost: one extra AudioContext + AnalyserNode. Negligible overhead. **Recommendation: create own instance.** |
| Tailwind banner component | toast/notification library | Decision D-14 locks to simple HTML/CSS banners. No library needed. |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/frontend/src/
  hooks/
    useMicMonitor.ts              # NEW: mic disconnect + silence detection
    useBeforeUnloadProtection.ts  # NEW: beforeunload handler
  components/
    alerts/
      MicAlertBanner.tsx          # NEW: reusable alert banner component
```

### Pattern 1: useMicMonitor Hook
**What:** A self-contained hook that monitors a `MediaStream` for mic disconnect and prolonged silence.
**When to use:** Any page with active audio recording.
**Key design decisions:**
- Accepts `MediaStream | null` and `isRecording: boolean`
- Creates its own `VoiceActivityDetector` instance internally (avoids coupling to capture hooks)
- Returns `{ isMicConnected, isSilent, silenceDurationMs }`
- Cleans up all listeners and intervals on unmount or when stream changes

```typescript
// useMicMonitor.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceActivityDetector, DEFAULT_VAD_CONFIG } from '@/lib/audioUtils';

const SILENCE_THRESHOLD_MS = 30000;
const SILENCE_CHECK_INTERVAL_MS = 1000;

interface MicMonitorResult {
  isMicConnected: boolean;
  isSilent: boolean;
  silenceDurationMs: number;
}

export function useMicMonitor(
  stream: MediaStream | null,
  isRecording: boolean
): MicMonitorResult {
  const [isMicConnected, setIsMicConnected] = useState(true);
  const [silenceDurationMs, setSilenceDurationMs] = useState(0);
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const silenceStartRef = useRef<number | null>(null);

  // Track.onended detection
  useEffect(() => {
    if (!stream) return;
    const tracks = stream.getAudioTracks();

    const handleTrackEnded = () => {
      setIsMicConnected(false);
    };

    tracks.forEach(track => {
      track.addEventListener('ended', handleTrackEnded);
    });

    // Also check readyState on mount
    const allEnded = tracks.every(t => t.readyState === 'ended');
    if (allEnded && tracks.length > 0) setIsMicConnected(false);
    else setIsMicConnected(true);

    return () => {
      tracks.forEach(track => {
        track.removeEventListener('ended', handleTrackEnded);
      });
    };
  }, [stream]);

  // devicechange fallback
  useEffect(() => {
    if (!stream) return;
    const activeTrack = stream.getAudioTracks()[0];
    if (!activeTrack) return;

    const handleDeviceChange = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      const settings = activeTrack.getSettings();
      const stillPresent = audioInputs.some(d => d.deviceId === settings.deviceId);

      if (!stillPresent) {
        setIsMicConnected(false);
      } else if (activeTrack.readyState === 'live') {
        setIsMicConnected(true);
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [stream]);

  // Silence detection (only while recording)
  useEffect(() => {
    if (!stream || !isRecording) {
      setSilenceDurationMs(0);
      silenceStartRef.current = null;
      vadRef.current?.destroy();
      vadRef.current = null;
      return;
    }

    vadRef.current = new VoiceActivityDetector(stream);
    silenceStartRef.current = null;

    const interval = setInterval(() => {
      if (!vadRef.current) return;
      const speaking = vadRef.current.isSpeaking();

      if (speaking) {
        silenceStartRef.current = null;
        setSilenceDurationMs(0);
      } else {
        if (silenceStartRef.current === null) {
          silenceStartRef.current = Date.now();
        }
        setSilenceDurationMs(Date.now() - silenceStartRef.current);
      }
    }, SILENCE_CHECK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      vadRef.current?.destroy();
      vadRef.current = null;
    };
  }, [stream, isRecording]);

  return {
    isMicConnected,
    isSilent: silenceDurationMs >= SILENCE_THRESHOLD_MS,
    silenceDurationMs,
  };
}
```

### Pattern 2: useBeforeUnloadProtection Hook
**What:** Registers/unregisters `beforeunload` listener based on recording state.
**When to use:** Any page with active recording.

```typescript
// useBeforeUnloadProtection.ts
import { useEffect, useRef } from 'react';

export function useBeforeUnloadProtection(
  isRecording: boolean,
  onFlush?: () => void
): void {
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;

  useEffect(() => {
    if (!isRecording) return;

    const handler = (event: BeforeUnloadEvent) => {
      // Trigger flush of pending data
      if (onFlushRef.current) {
        onFlushRef.current();
      }
      // Show native browser dialog
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [isRecording]);
}
```

### Pattern 3: MicAlertBanner Component
**What:** A stackable alert banner for mic issues.
**When to use:** Rendered at the top of consultation content area.

```tsx
// MicAlertBanner.tsx
interface MicAlertBannerProps {
  isMicConnected: boolean;
  isSilent: boolean;
}

export function MicAlertBanner({ isMicConnected, isSilent }: MicAlertBannerProps) {
  return (
    <>
      {!isMicConnected && (
        <div
          role="alert"
          aria-live="assertive"
          className="mic-alert mic-alert-disconnect"
        >
          {/* Red banner - mic disconnect */}
        </div>
      )}
      {isSilent && isMicConnected && (
        <div
          role="alert"
          aria-live="assertive"
          className="mic-alert mic-alert-silence"
        >
          {/* Amber banner - prolonged silence */}
        </div>
      )}
    </>
  );
}
```

### Anti-Patterns to Avoid
- **Creating AudioContext in every render:** AudioContext is expensive. The `useMicMonitor` hook must create it once in `useEffect` and clean up on unmount. Never inside the render body.
- **Forgetting to remove beforeunload listener:** If the listener leaks, every page navigation shows a dialog. The `useEffect` cleanup is critical.
- **Using `navigator.mediaDevices.ondevicechange` as a property setter:** This overwrites any existing handler. Use `addEventListener`/`removeEventListener` instead (the existing `useMediaDevices.ts` already does this correctly).
- **Polling audio level at 100ms for silence detection:** D-08 specifies 1s intervals. 100ms would be wasteful for a 30s threshold check. The existing 100ms polling in capture hooks is for real-time UI level display -- different concern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio level measurement | Custom FFT + RMS calculation | Existing `VoiceActivityDetector.getAudioLevel()` | Already tested and working in production |
| Device enumeration on change | Manual polling of devices | `navigator.mediaDevices.addEventListener('devicechange', ...)` | Browser event is more reliable and efficient |
| Browser exit confirmation | Custom modal on tab close | Native `beforeunload` event | Only the native event can intercept tab close. Custom modals cannot. |

**Key insight:** This phase is almost entirely about wiring browser-native events to React state. The existing codebase has all the audio processing infrastructure. The new code is thin integration glue.

## Common Pitfalls

### Pitfall 1: beforeunload flush is unreliable for async operations
**What goes wrong:** The `onFlush` callback in `beforeunload` cannot reliably do async work (fetch, WebSocket emit). Browsers may kill the page before the async operation completes.
**Why it happens:** `beforeunload` handlers run synchronously. The browser does not wait for promises.
**How to avoid:** Use `navigator.sendBeacon()` for the flush if it needs to be an HTTP call, or rely on Phase 5's incremental save (data is already persisted every few seconds). The `beforeunload` flush is a best-effort last-chance save, not the primary persistence mechanism.
**Warning signs:** Data loss on tab close despite having the handler.

### Pitfall 2: track.onended fires on getUserMedia permission revoke
**What goes wrong:** The `track.onended` event fires not only when a mic is physically disconnected, but also when the browser revokes mic permission (e.g., user clicks "stop sharing" in browser UI). This could confuse the doctor.
**Why it happens:** The `ended` event is generic -- it fires for any reason the track becomes inactive.
**How to avoid:** The behavior is correct -- in both cases the mic is no longer providing audio, and the doctor should be alerted. No special handling needed. The D-03 message ("reconecte o microfone") is appropriate for both cases.
**Warning signs:** False disconnect alerts during normal operation (unlikely in practice).

### Pitfall 3: VoiceActivityDetector needs an active AudioContext
**What goes wrong:** If the AudioContext is in `suspended` state (common on iOS/Safari after page load without user interaction), `getAudioLevel()` returns 0 forever, triggering false silence alerts.
**Why it happens:** Safari auto-suspends AudioContext until user gesture.
**How to avoid:** The `useMicMonitor` hook should only create the VAD after recording starts (D-09 already ensures this). By the time recording starts, the user has already interacted with the page (clicking "Iniciar Consulta"), so AudioContext will be active.
**Warning signs:** Immediate silence alert right after recording starts on Safari.

### Pitfall 4: Multiple AudioContext instances
**What goes wrong:** The capture hooks already create AudioContexts for their VAD. `useMicMonitor` creates another. Browsers limit the number of AudioContexts (typically 6-8 per page).
**Why it happens:** Each VoiceActivityDetector constructor creates `new AudioContext()`.
**How to avoid:** Two contexts (one from capture hook, one from mic monitor) is fine. The limit is per-origin and typically 6+. If needed in the future, refactor VoiceActivityDetector to accept an external AudioContext. For now, the 2-context approach is safe.
**Warning signs:** Console warning "The AudioContext was not allowed to start" or "Maximum number of AudioContexts reached."

### Pitfall 5: Style JSX scoping in presencial page
**What goes wrong:** The presencial `page.tsx` uses `<style jsx>` for scoping CSS. Alert banner styles added inline here will be scoped to that component, but the `MicAlertBanner` is a separate component, so `style jsx` from the parent will NOT reach it.
**Why it happens:** Next.js `styled-jsx` scopes styles to the component where they are defined.
**How to avoid:** Use inline styles or a separate CSS file for the `MicAlertBanner` component. Or use the `style jsx` tag directly inside `MicAlertBanner.tsx`. The simplest approach is inline Tailwind-like classes or a plain CSS module.
**Warning signs:** Banner appears but is unstyled.

## Code Examples

### Integration in Presencial page.tsx
```typescript
// In PresencialConsultationContent component:
import { useMicMonitor } from '@/hooks/useMicMonitor';
import { useBeforeUnloadProtection } from '@/hooks/useBeforeUnloadProtection';
import { MicAlertBanner } from '@/components/alerts/MicAlertBanner';

// Inside the component:
// For single-mic mode, use the single stream ref
// For dual-mic mode, use the doctor stream ref (primary mic to monitor)
const streamToMonitor = micMode === 'single'
  ? /* streamRef from singleCapture - need to expose */ null
  : /* doctorStreamRef from dualCapture - need to expose */ null;

const { isMicConnected, isSilent, silenceDurationMs } = useMicMonitor(
  streamToMonitor,
  activeCapture.isRecording
);

useBeforeUnloadProtection(
  activeCapture.isRecording,
  () => {
    // Best-effort flush: emit any pending data
    // Phase 5 incremental save already persists data every ~5s,
    // so this is a last-chance save for the most recent segment
  }
);

// In JSX, right after the error-banner div:
<MicAlertBanner isMicConnected={isMicConnected} isSilent={isSilent} />
```

### Exposing MediaStream from capture hooks
The capture hooks (`usePresencialSingleMicCapture`, `usePresencialAudioCapture`) store streams in refs but do NOT expose them. The `useMicMonitor` hook needs the `MediaStream`. Two options:

**Option A (recommended): Expose stream from capture hooks**
```typescript
// In usePresencialSingleMicCapture.ts, add to return:
return {
  // ... existing
  stream: streamRef.current, // Add this
};
```
Problem: `streamRef.current` is a ref, not state. Returning it directly means React won't re-render when it changes. Need to also add:
```typescript
const [stream, setStream] = useState<MediaStream | null>(null);
// In startCapture, after getting stream:
setStream(stream);
// In stopCapture:
setStream(null);
```

**Option B: Pass stream to useMicMonitor via a callback/ref pattern**
More complex. Option A is cleaner.

### Integration in ConsultationRoom.tsx (Online)
```typescript
// ConsultationRoom.tsx already has localStreamRef
// Need to expose it as state or pass to useMicMonitor

const { isMicConnected, isSilent } = useMicMonitor(
  localStreamState, // Already exists as state in ConsultationRoom
  isCallActive      // Or isRecordingEnabled, depending on when monitoring should start
);

useBeforeUnloadProtection(
  isCallActive || isRecordingEnabled,
  () => { /* flush callback */ }
);

// Add MicAlertBanner to the consultation room JSX
```

Note: `ConsultationRoom.tsx` already has `localStreamState` as a reactive state variable (line 202), so it can be passed directly to `useMicMonitor` without modification.

### beforeunload cross-browser compatibility
```typescript
// This pattern works in all modern browsers:
const handler = (event: BeforeUnloadEvent) => {
  event.preventDefault();    // Standard (Chrome 119+, Firefox, Safari)
  event.returnValue = '';    // Legacy (Chrome < 119, older browsers)
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `event.returnValue = 'custom message'` | `event.preventDefault()` | Chrome 51 (2016) | Custom messages no longer shown; browser displays its own generic message |
| `navigator.mediaDevices.ondevicechange = fn` | `addEventListener('devicechange', fn)` | Always preferred | Property setter overwrites previous handlers; addEventListener allows multiple |
| Creating AudioContext freely | AudioContext requires user gesture | Safari (always), Chrome 66+ (2018) | Must create after user interaction; recording start satisfies this |

**Deprecated/outdated:**
- Custom `beforeunload` messages: Browsers ignore custom text since 2016. Only the native dialog appears.
- `navigator.mediaDevices.ondevicechange` as property: Works but can be overwritten. Use addEventListener.

## Open Questions

1. **How to trigger flush in beforeunload for presencial mode?**
   - What we know: Phase 5 implements incremental save via atomic append RPC. The presencial flow emits `presencialAudioChunk` via Socket.IO every 5s.
   - What's unclear: What specific "flush" operation should `onFlush` invoke? Socket.IO `emit` in `beforeunload` may not complete. `sendBeacon` only works with HTTP endpoints.
   - Recommendation: Since Phase 5 already saves incrementally every ~5s, the data loss window is minimal. The `onFlush` callback can attempt a synchronous-ish Socket.IO emit, but should NOT be relied upon. The `beforeunload` dialog's primary value is **preventing** the tab close, not guaranteeing a flush. Document this as an acceptable limitation.

2. **Should useMicMonitor monitor BOTH mics in dual-mic mode?**
   - What we know: D-05 says `useMicMonitor(stream)` takes one stream. In dual-mic mode there are two streams.
   - What's unclear: Should we call the hook twice (once per stream)?
   - Recommendation: Call `useMicMonitor` once with the doctor's stream (the doctor's mic disconnect is the critical alert). If needed in the future, the hook can be called twice. For now, monitoring one stream per D-05's single-stream signature is simpler. Alternatively, combine both checks into one hook call by accepting an array -- but this adds complexity for minimal gain.

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** - Direct reading of `audioUtils.ts`, `usePresencialAudioCapture.ts`, `usePresencialSingleMicCapture.ts`, `useMicTransmitter.ts`, `useRecording.ts`, `useMediaDevices.ts`, presencial `page.tsx`, `ConsultationRoom.tsx`
- **MDN Web Docs** - MediaStreamTrack.ended event, beforeunload event, devicechange event (well-established browser APIs, no version-specific concerns)
- **CONTEXT.md** - All 16 implementation decisions locked by user

### Secondary (MEDIUM confidence)
- AudioContext limits per origin (6-8): Based on Chromium source comments and MDN documentation. May vary by browser.

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries; all browser-native APIs well-documented
- Architecture: HIGH - Hook patterns are standard React; code examples derive from direct codebase reading
- Pitfalls: HIGH - All pitfalls are well-known browser behavior documented in MDN

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable browser APIs, no version sensitivity)
