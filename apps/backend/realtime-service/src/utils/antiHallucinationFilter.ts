/**
 * Módulo centralizado de filtragem anti-alucinação para Whisper
 *
 * O Whisper tende a "alucinar" texto quando recebe áudio silencioso,
 * com muito ruído, ou de baixa qualidade. As alucinações típicas incluem:
 * - Frases de YouTube/redes sociais (subscribe, like, etc.)
 * - Clickbait de fitness/saúde
 * - Legendas de filmes/séries
 * - Frases religiosas ou musicais genéricas
 * - Repetições de "obrigado", "tchau", etc.
 */

/**
 * Resultado da análise de segmentos do Whisper (verbose_json)
 */
export interface WhisperSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

export interface WhisperVerboseResponse {
  text: string;
  segments?: WhisperSegment[];
  language?: string;
  duration?: number;
}

/**
 * Thresholds para filtragem baseada em métricas do Whisper
 */
const WHISPER_THRESHOLDS = {
  /** Probabilidade máxima de "não-fala" aceitável (0.0 a 1.0) */
  MAX_NO_SPEECH_PROB: 0.5,
  /** Log-probabilidade média mínima aceitável (valores mais negativos = menor confiança) */
  MIN_AVG_LOGPROB: -1.0,
  /** Ratio de compressão máximo (textos repetitivos têm ratio alto) */
  MAX_COMPRESSION_RATIO: 2.4,
  /** Confiança mínima calculada para aceitar transcrição */
  MIN_CONFIDENCE: 0.45,
};

/**
 * Padrões de texto que indicam alucinação do Whisper
 * Organizados por categoria para manutenção
 */
const HALLUCINATION_PATTERNS: RegExp[] = [
  // === YouTube / Redes Sociais ===
  /se inscreva/i,
  /inscreva-se/i,
  /se inscrevam/i,
  /no nosso canal/i,
  /no canal/i,
  /curtam o v[íi]deo/i,
  /deixe seu like/i,
  /compartilhe/i,
  /subscribe/i,
  /youtube/i,
  /canal do youtube/i,
  /like and subscribe/i,
  /hit the bell/i,
  /ative o sininho/i,
  /link na descri[çc][ãa]o/i,
  /comente aqui/i,

  // === Legendas / Subtítulos ===
  /sous-?titres/i,
  /amara\.org/i,
  /s[úu]bricas/i,
  /subtitles by/i,
  /translated by/i,
  /unara\.org/i,
  /legendas por/i,
  /legenda:/i,

  // === Fitness / Saúde Clickbait ===
  /aumentar os gl[úu]teos/i,
  /ganhar.*(bumbum|muscul)/i,
  /exerc[íi]cios em casa/i,
  /emagrecer r[áa]pido/i,
  /perder barriga/i,
  /dieta milagr/i,
  /resultado incr[íi]vel/i,
  /corpo dos sonhos/i,
  /queimar gordura/i,
  /ficar magr[ao]/i,

  // === Música / Entretenimento ===
  /[♪♫🎵🎶]/,
  /m[úu]sica de fundo/i,
  /trilha sonora/i,
  /aplausos/i,

  // === Frases genéricas de alucinação em PT ===
  /obrigad[oa] por assistir/i,
  /obrigad[oa] pela aten[çc][ãa]o/i,
  /at[ée] a pr[óo]xima/i,
  /at[ée] mais/i,
  /tchau.*tchau/i,
  /oi.*tudo bem.*tchau/i,
  /n[ãa]o se esque[çc]a de/i,
  /fique ligado/i,
  /continue assistindo/i,

  // === Propaganda / Comercial ===
  /compre agora/i,
  /aproveite.*promo[çc][ãa]o/i,
  /ligue agora/i,
  /acesse.*site/i,
  /desconto especial/i,

  // === Religioso genérico (fora de contexto médico) ===
  /gl[óo]ria a deus/i,
  /aleluia/i,
  /am[ée]m.*am[ée]m/i,

  // === Echo do prompt do Whisper (alucinação mais comum!) ===
  // Quando Whisper recebe silêncio, ele repete o prompt de volta
  /use terminologia m[ée]dica/i,
  /n[ãa]o transcreva ru[íi]do/i,
  /n[ãa]o invente palavras/i,
  /n[ãa]o adicione conte[úu]do/i,
  /transcreva apenas o que foi/i,
  /consulta m[ée]dica profissional/i,
  /portugu[êe]s brasileiro/i,
  /palavras comuns:.*doutor/i,
  /evite alucina[çc][õo]es/i,

  // === Frases repetitivas típicas de alucinação ===
  /^\.+$/,                    // Apenas pontos
  /^[?.!,\s]+$/,              // Apenas pontuação
  /aguarde um momento\.?$/i,  // Frase padrão de Whisper em silêncio
];

/**
 * Frases exatas que são alucinações conhecidas do Whisper
 */
const HALLUCINATION_EXACT_PHRASES: string[] = [
  'Sous-titres',
  'Amara.org',
  'Obrigado.',
  'Súbricas',
  'Subtitles by',
  'Translated by',
  'Unara.org',
  'Aguarde um momento.',
  '...',
  '.',
  'Obrigado por assistir.',
  'Tchau.',
  'Até mais.',
  'Fim.',
  'Legendas pela comunidade',
];

/**
 * Verifica se os segmentos do Whisper indicam alucinação
 * baseado em métricas numéricas (no_speech_prob, avg_logprob, compression_ratio)
 *
 * @returns objeto com resultado e motivo da rejeição
 */
export function checkSegmentMetrics(segments: WhisperSegment[]): {
  isValid: boolean;
  reason?: string;
  avgNoSpeechProb?: number;
  avgLogprob?: number;
} {
  if (!segments || segments.length === 0) {
    // Sem segmentos = não temos métricas para validar
    // O filtro de texto (isValidTranscriptionText) será a única barreira
    console.warn(`⚠️ [ANTI-HALLUCINATION] Resposta sem segmentos - dependendo apenas do filtro de texto`);
    return { isValid: true };
  }

  // Calcular médias
  let totalNoSpeechProb = 0;
  let totalAvgLogprob = 0;
  let totalCompressionRatio = 0;
  let highNoSpeechCount = 0;

  for (const segment of segments) {
    const noSpeechProb = segment.no_speech_prob ?? 0;
    const avgLogprob = segment.avg_logprob ?? 0;
    const compressionRatio = segment.compression_ratio ?? 1;

    totalNoSpeechProb += noSpeechProb;
    totalAvgLogprob += avgLogprob;
    totalCompressionRatio += compressionRatio;

    if (noSpeechProb > WHISPER_THRESHOLDS.MAX_NO_SPEECH_PROB) {
      highNoSpeechCount++;
    }
  }

  const avgNoSpeechProb = totalNoSpeechProb / segments.length;
  const avgLogprob = totalAvgLogprob / segments.length;
  const avgCompressionRatio = totalCompressionRatio / segments.length;

  // Regra 1: Se a maioria dos segmentos tem alta prob de não-fala, descartar
  if (highNoSpeechCount > segments.length * 0.5) {
    return {
      isValid: false,
      reason: `no_speech_prob alto em ${highNoSpeechCount}/${segments.length} segmentos (avg: ${avgNoSpeechProb.toFixed(3)})`,
      avgNoSpeechProb,
      avgLogprob,
    };
  }

  // Regra 2: Se avg_logprob é muito baixo, a transcrição é pouco confiável
  if (avgLogprob < WHISPER_THRESHOLDS.MIN_AVG_LOGPROB) {
    return {
      isValid: false,
      reason: `avg_logprob muito baixo: ${avgLogprob.toFixed(3)} (mín: ${WHISPER_THRESHOLDS.MIN_AVG_LOGPROB})`,
      avgNoSpeechProb,
      avgLogprob,
    };
  }

  // Regra 3: Se compression_ratio é muito alto, texto é repetitivo (alucinação)
  if (avgCompressionRatio > WHISPER_THRESHOLDS.MAX_COMPRESSION_RATIO) {
    return {
      isValid: false,
      reason: `compression_ratio alto: ${avgCompressionRatio.toFixed(2)} (máx: ${WHISPER_THRESHOLDS.MAX_COMPRESSION_RATIO})`,
      avgNoSpeechProb,
      avgLogprob,
    };
  }

  return { isValid: true, avgNoSpeechProb, avgLogprob };
}

/**
 * Verifica se o texto transcrito é uma alucinação conhecida
 * baseado em padrões de texto
 *
 * @returns true se o texto é válido (não é alucinação), false se deve ser descartado
 */
export function isValidTranscriptionText(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false;
  }

  const trimmedText = text.trim();

  // Verificar frases exatas
  if (HALLUCINATION_EXACT_PHRASES.some(phrase => trimmedText === phrase)) {
    console.warn(`🛡️ [ANTI-HALLUCINATION] Frase exata descartada: "${trimmedText}"`);
    return false;
  }

  // Verificar padrões regex
  for (const pattern of HALLUCINATION_PATTERNS) {
    if (pattern.test(trimmedText)) {
      console.warn(`🛡️ [ANTI-HALLUCINATION] Padrão detectado (${pattern}): "${trimmedText}"`);
      return false;
    }
  }

  // Verificar texto muito curto (exceto palavras comuns em consultas)
  const VALID_SHORT_WORDS = ['Oi', 'Sim', 'Não', 'Ok', 'Bem', 'Certo', 'Bom'];
  if (trimmedText.length < 3 && !VALID_SHORT_WORDS.includes(trimmedText)) {
    console.warn(`🛡️ [ANTI-HALLUCINATION] Texto muito curto descartado: "${trimmedText}"`);
    return false;
  }

  // Detecção genérica de echo do prompt:
  // Se o texto contém trechos que parecem instruções (padrão de prompt), descartar
  if (/^(NÃO|NAO|Não|Use|Transcreva|Esta é uma)\s/i.test(trimmedText) && trimmedText.length < 80) {
    // Frases curtas que começam com instruções são quase certamente echo do prompt
    console.warn(`🛡️ [ANTI-HALLUCINATION] Possível echo de prompt descartado: "${trimmedText}"`);
    return false;
  }

  return true;
}

/**
 * Filtro completo: combina verificação de segmentos + texto
 * Usar este método como ponto de entrada principal
 *
 * @returns objeto com resultado e detalhes
 */
export function filterWhisperResponse(response: WhisperVerboseResponse): {
  isValid: boolean;
  reason?: string;
  text: string;
} {
  const text = (response.text || '').trim();

  if (!text) {
    return { isValid: false, reason: 'Texto vazio', text: '' };
  }

  // 1. Verificar métricas dos segmentos (filtro primário - mais confiável)
  if (response.segments && response.segments.length > 0) {
    const segmentCheck = checkSegmentMetrics(response.segments);
    if (!segmentCheck.isValid) {
      console.warn(`🛡️ [ANTI-HALLUCINATION] Descartado por métricas: ${segmentCheck.reason} | Texto: "${text.substring(0, 60)}..."`);
      return { isValid: false, reason: segmentCheck.reason, text };
    }
  }

  // 2. Verificar padrões de texto (filtro secundário - backup)
  if (!isValidTranscriptionText(text)) {
    return { isValid: false, reason: 'Padrão de alucinação detectado no texto', text };
  }

  return { isValid: true, text };
}

/**
 * Calcula confiança baseada nas métricas do Whisper
 */
export function calculateConfidence(response: WhisperVerboseResponse): number {
  if (!response.segments || response.segments.length === 0) {
    // Sem segmentos, usar heurística baseada no texto
    const textLength = (response.text || '').trim().length;
    if (textLength > 50) return 0.7;
    if (textLength > 20) return 0.6;
    return 0.5;
  }

  const avgLogprob = response.segments.reduce((sum, s) => sum + (s.avg_logprob || -0.5), 0) / response.segments.length;
  const avgNoSpeechProb = response.segments.reduce((sum, s) => sum + (s.no_speech_prob || 0), 0) / response.segments.length;

  // Converter logprob para probabilidade (aproximada)
  let confidence = Math.max(0.2, Math.min(0.95, Math.exp(avgLogprob)));

  // Penalizar por alta probabilidade de não-fala
  confidence *= (1 - avgNoSpeechProb * 0.5);

  // Penalizar texto repetitivo
  const words = (response.text || '').toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  if (words.length > 2) {
    const repetitionRatio = uniqueWords.size / words.length;
    if (repetitionRatio < 0.5) confidence *= 0.7;
  }

  return Math.max(0.1, Math.min(0.95, confidence));
}

/** Exportar thresholds para uso externo se necessário */
export { WHISPER_THRESHOLDS };
