/**
 * Gerador de Receita PDF - Prescricao de Formula
 * Estilo classico de receita medica/nutricional
 * Uma pagina por item prescrito
 */

import { jsPDF } from 'jspdf';

interface SuplementacaoItem {
  nome?: string;
  objetivo?: string;
  dosagem?: string;
  horario?: string;
  inicio?: string;
  termino?: string;
}

interface SuplementacaoData {
  suplementos: SuplementacaoItem[];
  fitoterapicos: SuplementacaoItem[];
  homeopatia: SuplementacaoItem[];
  florais_bach: SuplementacaoItem[];
}

interface DadosMedico {
  nome: string;
  crm?: string;
  especialidade?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  logo_url?: string;
}

interface DadosPaciente {
  nome: string;
  email?: string;
  telefone?: string;
  data_nascimento?: string;
}

interface ReceitaParams {
  suplementacaoData: SuplementacaoData;
  medico: DadosMedico;
  paciente: DadosPaciente;
  dataConsulta: string;
}

const BLACK: [number, number, number] = [0, 0, 0];
const GRAY: [number, number, number] = [120, 120, 120];
const LINE_COLOR: [number, number, number] = [0, 0, 0];

function drawHr(doc: jsPDF, y: number, x1: number = 25, x2: number = 185) {
  doc.setDrawColor(...LINE_COLOR);
  doc.setLineWidth(0.4);
  doc.line(x1, y, x2, y);
}

function drawThinHr(doc: jsPDF, y: number, x1: number = 25, x2: number = 185) {
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.15);
  doc.line(x1, y, x2, y);
}

function getCategoryLabel(key: string): string {
  const map: Record<string, string> = {
    suplementos: 'SUPLEMENTACAO',
    fitoterapicos: 'FITOTERAPICO',
    homeopatia: 'HOMEOPATIA',
    florais_bach: 'FLORAIS DE BACH',
  };
  return map[key] || key.toUpperCase();
}

export async function gerarReceitaPdf({
  suplementacaoData,
  medico,
  paciente,
  dataConsulta,
}: ReceitaParams) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 25;
  const contentWidth = pageWidth - margin * 2;
  const center = pageWidth / 2;

  // Coletar todos os itens com sua categoria
  const allItems: { item: SuplementacaoItem; category: string }[] = [];

  const categories: { key: keyof SuplementacaoData }[] = [
    { key: 'suplementos' },
    { key: 'fitoterapicos' },
    { key: 'homeopatia' },
    { key: 'florais_bach' },
  ];

  categories.forEach(cat => {
    const items = suplementacaoData[cat.key] || [];
    items.forEach(item => {
      if (item.nome) {
        allItems.push({ item, category: cat.key });
      }
    });
  });

  if (allItems.length === 0) {
    // Pagina vazia se nao tem itens
    doc.setFont('courier', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(...BLACK);
    doc.text('Nenhum item prescrito.', center, 140, { align: 'center' });
    doc.save('Receita_Vazia.pdf');
    return;
  }

  // Carregar logo se disponivel
  if (medico.logo_url) {
    try {
      const response = await fetch(medico.logo_url);
      const blob = await response.blob();
      const logoDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      (doc as any).__logoData = logoDataUrl;
    } catch (e) { console.warn('Erro ao carregar logo:', e); }
  }

  // Gerar uma pagina por item
  allItems.forEach(({ item, category }, idx) => {
    if (idx > 0) doc.addPage();

    let y = 15;

    // LOGO (se disponivel - carregado previamente)
    if ((doc as any).__logoData) {
      try {
        doc.addImage((doc as any).__logoData, 'PNG', center - 25, y, 50, 20, undefined, 'FAST');
        y += 25;
      } catch { y += 5; }
    }

    // TITULO
    doc.setFont('courier', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...BLACK);
    doc.text('PRESCRICAO', center, y, { align: 'center' });
    y += 6;

    // Paciente + data
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(`Paciente: ${paciente.nome || 'N/A'}`, margin, y);
    doc.text(dataConsulta || new Date().toLocaleDateString('pt-BR'), pageWidth - margin, y, { align: 'right' });
    y += 8;

    drawHr(doc, y);
    y += 10;

    // CATEGORIA + NOME (com quebra de linha)
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BLACK);
    const catNome = `${getCategoryLabel(category)} - ${(item.nome || '').toUpperCase()}`;
    const catLines = doc.splitTextToSize(catNome, contentWidth);
    doc.text(catLines, margin, y);
    y += catLines.length * 6 + 6;

    // DOSAGEM (com quebra de linha)
    if (item.dosagem) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...BLACK);
      doc.text('Dosagem:', margin, y);
      y += 5;
      doc.setFont('courier', 'normal');
      const dosLines = doc.splitTextToSize(item.dosagem, contentWidth);
      doc.text(dosLines, margin, y);
      y += dosLines.length * 5 + 6;
    }

    // HORARIO (com quebra de linha)
    if (item.horario) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...BLACK);
      doc.text('Horario:', margin, y);
      y += 5;
      doc.setFont('courier', 'normal');
      const horarioLines = doc.splitTextToSize(item.horario, contentWidth);
      doc.text(horarioLines, margin, y);
      y += horarioLines.length * 5 + 6;
    }

    // OBJETIVO (com quebra de linha)
    if (item.objetivo) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...BLACK);
      doc.text('Objetivo:', margin, y);
      y += 5;
      doc.setFont('courier', 'normal');
      const objLines = doc.splitTextToSize(item.objetivo, contentWidth);
      doc.text(objLines, margin, y);
      y += objLines.length * 5 + 6;
    }

    // PERIODO (com quebra de linha)
    if (item.inicio || item.termino) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...BLACK);
      doc.text('Periodo:', margin, y);
      y += 5;
      doc.setFont('courier', 'normal');
      const periodoText = [
        item.inicio ? `Inicio: ${item.inicio}` : null,
        item.termino ? `Termino: ${item.termino}` : null,
      ].filter(Boolean).join('  |  ');
      const periodoLines = doc.splitTextToSize(periodoText, contentWidth);
      doc.text(periodoLines, margin, y);
      y += periodoLines.length * 5 + 6;
    }

    // ASSINATURA (fixa na parte inferior)
    const sigY = 220;
    drawHr(doc, sigY, center - 50, center + 50);

    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...BLACK);
    doc.text(medico.nome || '', center, sigY + 6, { align: 'center' });

    const sigDetails = [medico.especialidade, medico.crm].filter(Boolean).join(' - ');
    if (sigDetails) {
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text(sigDetails, center, sigY + 11, { align: 'center' });
    }

    // FOOTER
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`Pagina ${idx + 1}/${allItems.length}`, margin, 285);
    const footerName = [medico.nome, medico.crm].filter(Boolean).join(' - ');
    doc.text(footerName, pageWidth - margin, 285, { align: 'right' });
  });

  // Salvar
  const nomeArquivo = `Prescricao_${paciente.nome?.replace(/\s+/g, '_') || 'paciente'}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(nomeArquivo);
}

/**
 * Gerar PDF de prescricao para um unico item
 */
interface ReceitaItemParams {
  item: SuplementacaoItem;
  category: string;
  medico: DadosMedico;
  paciente: DadosPaciente;
}

export async function gerarReceitaItemPdf({
  item,
  category,
  medico,
  paciente,
}: ReceitaItemParams) {
  // Reutilizar a funcao principal com apenas 1 item
  const suplementacaoData: SuplementacaoData = {
    suplementos: [],
    fitoterapicos: [],
    homeopatia: [],
    florais_bach: [],
  };

  // Colocar o item na categoria correta
  const key = category as keyof SuplementacaoData;
  if (key in suplementacaoData) {
    suplementacaoData[key] = [item];
  }

  await gerarReceitaPdf({
    suplementacaoData,
    medico,
    paciente,
    dataConsulta: new Date().toLocaleDateString('pt-BR'),
  });
}
