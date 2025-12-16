import type { Metadata } from 'next';
import '../globals.css';
import './landing.css';

export const metadata: Metadata = {
  title: 'Auton Health - Plataforma de Consultas Médicas com IA',
  description: 'Revolucione suas consultas médicas com transcrição em tempo real, sugestões clínicas inteligentes e documentação automática.',
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
