import { Layout } from '@/components/shared/Layout';
import Head from 'next/head';

export default function ConsultasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Head>
        <link 
          rel="stylesheet" 
          href="/_next/static/css/consultas.css" 
          as="style"
          onLoad="this.onload=null;this.rel='stylesheet'"
        />
        <noscript>
          <link rel="stylesheet" href="/_next/static/css/consultas.css" />
        </noscript>
      </Head>
      <Layout>
        {children}
      </Layout>
    </>
  );
}
