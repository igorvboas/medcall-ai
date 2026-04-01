'use client';

import { XCircle, AlertTriangle } from 'lucide-react';

interface MicAlertBannerProps {
  isMicConnected: boolean;
  isSilent: boolean;
}

/**
 * Alert banner component for mic disconnect and silence detection.
 *
 * Two stacked banners with priority ordering (D-15):
 * - Red banner (top): Mic disconnected — non-dismissible, auto-dismisses on reconnect
 * - Amber banner (below): Prolonged silence — auto-dismisses when voice detected
 *
 * Both banners are accessible with role="alert" and aria-live="assertive" (D-16).
 */
export function MicAlertBanner({ isMicConnected, isSilent }: MicAlertBannerProps) {
  const showDisconnect = !isMicConnected;
  // No point showing silence alert if mic is disconnected
  const showSilence = isSilent && isMicConnected;

  if (!showDisconnect && !showSilence) {
    return null;
  }

  return (
    <div className="space-y-2">
      {showDisconnect && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-3 px-4 py-3 bg-red-600 text-white rounded-lg mb-2"
        >
          <XCircle className="h-5 w-5 flex-shrink-0" />
          <span>
            Microfone desconectado — reconecte o microfone para continuar a gravacao
          </span>
        </div>
      )}

      {showSilence && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-3 px-4 py-3 bg-amber-500 text-white rounded-lg mb-2"
        >
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span>
            Microfone silencioso ha mais de 30 segundos — verifique se o microfone esta funcionando
          </span>
        </div>
      )}
    </div>
  );
}
