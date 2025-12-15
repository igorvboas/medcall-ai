import { Layout } from '@/components/shared/Layout';

export default function AdministracaoLayout({
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


