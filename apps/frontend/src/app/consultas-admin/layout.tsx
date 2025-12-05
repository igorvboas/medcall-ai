import { Layout } from '@/components/shared/Layout';

export default function ConsultasAdminLayout({
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
