import { Layout } from '@/components/shared/Layout';

export default function DocumentosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Layout>{children}</Layout>;
}
