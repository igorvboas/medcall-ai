import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sala de Consulta - MedCall AI',
  description: 'Sistema de consulta online com transcrição em tempo real',
};

export default function CallLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="call-layout">
      {children}
    </div>
  );
}
