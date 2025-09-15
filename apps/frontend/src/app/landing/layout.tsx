import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';
import './landing.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TRIA - Plataforma de Consultas Médicas com IA',
  description: 'Revolucione suas consultas médicas com transcrição em tempo real, sugestões clínicas inteligentes e documentação automática.',
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
