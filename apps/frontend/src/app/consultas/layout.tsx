import { Layout } from '@/components/shared/Layout';

export default function ConsultasLayout({
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
