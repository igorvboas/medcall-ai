import { Layout } from '@/components/shared/Layout';

export default function PatientsLayout({
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
