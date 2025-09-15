import { Layout } from '@/components/shared/Layout';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Layout>{children}</Layout>;
}
