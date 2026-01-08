'use client';

import { ThemeProvider } from './ThemeProvider';
import { NotificationProvider } from '@/components/shared/NotificationSystem';
import { FirstAccessGuard } from '@/components/auth/FirstAccessGuard';

interface ProvidersWrapperProps {
  children: React.ReactNode;
}

export function ProvidersWrapper({ children }: ProvidersWrapperProps) {
  return (
    <div suppressHydrationWarning>
      <ThemeProvider>
        <NotificationProvider>
          <FirstAccessGuard>
            {children}
          </FirstAccessGuard>
        </NotificationProvider>
      </ThemeProvider>
    </div>
  );
}

