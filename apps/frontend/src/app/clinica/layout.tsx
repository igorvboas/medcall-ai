import { Layout } from '@/components/shared/Layout';

export default function ClinicaLayout({
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
