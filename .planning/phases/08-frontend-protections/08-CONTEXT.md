# Phase 8: Frontend Protections - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Frontend-only changes to protect the doctor during active consultations. Three protections: (1) mic disconnect detection with visual alert, (2) prolonged silence detection with visual alert, (3) beforeunload handler to prevent accidental tab closure during recording. Applies to both online (ConsultationRoom) and presencial (page.tsx) consultation flows. No backend changes in this phase.

</domain>

<decisions>
## Implementation Decisions

### Mic Disconnect Detection (AUDM-01)
- **D-01:** Listen to `track.onended` event on each `MediaStreamTrack` from the active audio stream. When fired, it means the mic was physically disconnected or the OS revoked access.
- **D-02:** Also listen to `navigator.mediaDevices.ondevicechange` as a fallback — enumerate devices and check if the active device ID is still present.
- **D-03:** Display a non-dismissible banner at the top of the consultation area (not a toast that auto-hides). Red background, icon + message: "Microfone desconectado — reconecte o microfone para continuar a gravacao". The banner disappears automatically when a new mic is detected/connected.
- **D-04:** Do NOT stop the recording automatically — the doctor may reconnect the mic and continue. Just alert visually. Audio capture pauses naturally when the track ends.
- **D-05:** Create a reusable React hook `useMicMonitor(stream: MediaStream | null)` that returns `{ isMicConnected: boolean, isSilent: boolean, silenceDurationMs: number }`. Both online and presencial pages import this hook.

### Silence Detection (AUDM-02)
- **D-06:** Use the existing `VoiceActivityDetector.getAudioLevel()` from `audioUtils.ts` to monitor audio level. If audio level stays below the VAD threshold for 30 consecutive seconds, show a warning.
- **D-07:** Display an amber/yellow banner (less urgent than mic disconnect): "Microfone silencioso ha mais de 30 segundos — verifique se o microfone esta funcionando". Auto-dismisses when voice is detected again.
- **D-08:** The 30-second threshold should be configurable via a constant (e.g., `SILENCE_THRESHOLD_MS = 30000`). Check audio level every 1 second using `setInterval`.
- **D-09:** Silence detection only runs while recording is active — not during setup or after finalization. Reset the silence counter when recording starts.

### Tab Close Protection (SESS-03)
- **D-10:** Add a `beforeunload` event listener that fires ONLY during active recording/consultation. When the doctor tries to close/navigate away, the browser shows its native confirmation dialog ("Changes you made may not be saved").
- **D-11:** The `beforeunload` handler should also trigger a final flush of any pending transcription data — call the existing incremental save endpoint (the atomic append RPC from Phase 5) to ensure the latest text is persisted.
- **D-12:** Register the `beforeunload` listener when recording starts, remove it when recording ends or consultation is finalized. Use `useEffect` cleanup to prevent leaks.
- **D-13:** Apply to both online (`ConsultationRoom.tsx` or its parent page) and presencial (`page.tsx`). The hook should be reusable: `useBeforeUnloadProtection(isRecording: boolean, onFlush?: () => void)`.

### Alert UI Pattern
- **D-14:** Use simple HTML/CSS banners positioned at the top of the consultation content area (inside the consultation layout, not a global toast system). No new UI library needed — Tailwind classes are sufficient.
- **D-15:** Alert priority: mic disconnect (red, highest) > silence (amber, medium). If both are active, show both stacked with mic disconnect on top.
- **D-16:** Alerts should be accessible — include `role="alert"` and `aria-live="assertive"` for screen readers.

### Claude's Discretion
- Exact Tailwind classes and styling for alert banners
- Whether `useMicMonitor` and `useBeforeUnloadProtection` go in `/hooks/` or colocated with consultation pages
- Whether to use `requestAnimationFrame` or `setInterval` for audio level polling
- Icon choice for alerts (emoji vs SVG icon)
- Whether silence detection shares the same `VoiceActivityDetector` instance or creates its own

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Frontend — Audio Capture & VAD
- `apps/frontend/src/lib/audioUtils.ts` — `VoiceActivityDetector` class with `getAudioLevel()`, `isSpeaking()`, VAD config. Reuse for silence detection.
- `apps/frontend/src/hooks/usePresencialAudioCapture.ts` — Presencial audio capture hook. Integration point for mic monitor.
- `apps/frontend/src/hooks/usePresencialSingleMicCapture.ts` — Single-mic capture variant. Integration point for mic monitor.
- `apps/frontend/src/hooks/useMicTransmitter.ts` — Online consultation mic capture. Integration point for mic monitor.
- `apps/frontend/src/hooks/useRecording.ts` — Recording state management. Integration point for beforeunload.

### Frontend — Consultation Pages
- `apps/frontend/src/components/webrtc/ConsultationRoom.tsx` — Online consultation room component. Add alerts here.
- `apps/frontend/src/app/(consulta)/consulta/presencial/page.tsx` — Presencial consultation page. Add alerts here.
- `apps/frontend/src/app/(consulta)/consulta/online/doctor/page.tsx` — Online doctor page. May need beforeunload.
- `apps/frontend/src/app/(consulta)/consulta/online/patient/page.tsx` — Online patient page (alerts less critical here).

### Frontend — Device Management
- `apps/frontend/src/hooks/useMediaDevices.ts` — Existing hook for media device enumeration. May be extended for `ondevicechange`.

### Systematic Review
- `REVISAO_SISTEMATICA_CONSULTAS.md` — Findings #12 (no mic disconnect detection), #13 (no silence alert), #14 (no beforeunload protection).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VoiceActivityDetector` in `audioUtils.ts` — RMS-based audio level detection. Has `getAudioLevel()` returning 0-1 float, `isSpeaking()` returning boolean based on configurable threshold. Perfect for silence detection.
- `useMediaDevices.ts` — Enumerates audio devices. Can be extended with `ondevicechange` listener for mic disconnect fallback.
- `useConnectionState.ts` — State machine pattern with reconnection states. Good reference for alert state management.
- Tailwind CSS — Fully configured in the project. Use for alert banner styling.

### Established Patterns
- Hooks in `/hooks/` directory following `use*.ts` naming
- Components use TypeScript + functional React
- No existing alert/notification system — banners will be the first
- Audio streams are passed as `MediaStream` objects between hooks and components

### Integration Points
- Online consultation: `ConsultationRoom.tsx` renders the room UI — add alert banners here
- Presencial consultation: `page.tsx` renders the presencial UI — add alert banners here
- Both flows have `isRecording` or equivalent state already available
- Audio streams are available in the capture hooks — pass to `useMicMonitor`

</code_context>

<specifics>
## Specific Ideas

- The `useMicMonitor` hook should accept the `MediaStream` and return real-time status. It internally sets up `track.onended` listeners and the silence polling interval.
- The `beforeunload` handler should use `event.preventDefault()` + `event.returnValue = ''` for cross-browser compatibility.
- For presencial, the audio stream is local. For online, the doctor's local mic stream should be monitored (not the remote peer's audio).
- The silence detection counter should reset not just on voice detection, but also when the user manually acknowledges the alert or when a new mic segment is detected.

</specifics>

<deferred>
## Deferred Ideas

- **PLOC-01**: IndexedDB local audio persistence — v2+ scope, not needed with Phase 5 incremental save.
- Visual audio waveform/meter during recording — nice-to-have but not required for protection alerts.
- Automatic mic switching when preferred mic disconnects — too complex, just alert the doctor.

</deferred>

---

*Phase: 08-frontend-protections*
*Context gathered: 2026-03-31*
