'use client';

import { ThemeProvider } from './ThemeProvider';
import { NotificationProvider } from '@/components/shared/NotificationSystem';

interface ProvidersWrapperProps {
  children: React.ReactNode;
}

export function ProvidersWrapper({ children }: ProvidersWrapperProps) {
  return (
    <div suppressHydrationWarning>
      <ThemeProvider>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </ThemeProvider>
    </div>
  );
}

