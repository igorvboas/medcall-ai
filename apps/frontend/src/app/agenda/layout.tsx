import { Layout } from '@/components/shared/Layout';

export default function AgendaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Layout>
      {children}
    </Layout>
  );
}

