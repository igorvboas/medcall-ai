import CadastroTabContent from './CadastroTabContent';

const VALID_TABS = ['pacientes', 'refeicoes', 'treinos', 'suplementos', 'fitoterapicos', 'clinica'];

export function generateStaticParams() {
  return VALID_TABS.map((tab) => ({ tab }));
}

export default function CadastroTabPage({ params }: { params: { tab: string } }) {
  return <CadastroTabContent />;
}
