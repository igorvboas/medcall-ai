import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Autenticação - TRIA',
  description: 'Entre ou crie sua conta na plataforma TRIA',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
