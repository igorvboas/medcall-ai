import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Onboarding | AUTON Health',
  description: 'Bem-vindo à AUTON Health. Agende sua sessão de onboarding e comece a transformar seu atendimento.',
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
