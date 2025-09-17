import { Utterance, Suggestion } from '../config/database';

interface GenerateProtocolInput {
  transcriptText: string;
  utterances: Utterance[];
  suggestions: Suggestion[];
  usedSuggestions: Suggestion[];
  participants: Record<string, any>;
}

interface GeneratedProtocol {
  summary: string;
  key_points: string[];
  full_text: string;
  diagnosis?: string;
  treatment?: string;
  observations?: string;
}

export function generateSimpleProtocol(input: GenerateProtocolInput): GeneratedProtocol {
  const { transcriptText, utterances, suggestions, usedSuggestions, participants } = input;

  const patientName = participants?.patient?.name || 'Paciente';

  // tópicos simples a partir de sugestões usadas
  const keyPoints = usedSuggestions.slice(0, 8).map(s => s.content);

  const summary = `Consulta presencial com ${patientName}. Foram registradas ${utterances.length} falas. ` +
    `${suggestions.length} sugestões foram propostas e ${usedSuggestions.length} utilizadas. ` +
    `Segue abaixo a transcrição consolidada e os principais pontos levantados.`;

  const full = [
    `Resumo: ${summary}`,
    '',
    'Principais Pontos:',
    ...keyPoints.map((p, i) => `${i + 1}. ${p}`),
    '',
    'Sugestões Utilizadas:',
    ...usedSuggestions.map((s, i) => `${i + 1}. [${s.type}] ${s.content} (${s.source || 'Protocolo'})`),
    '',
    'Transcrição Completa:',
    transcriptText,
  ].join('\n');

  return {
    summary,
    key_points: keyPoints,
    full_text: full,
  };
}


