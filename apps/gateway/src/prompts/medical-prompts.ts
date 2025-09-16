/**
 * Prompts médicos estruturados para geração de sugestões de IA
 * Sistema de templates dinâmicos para análise de contexto e sugestões clínicas
 */

export const CONTEXT_ANALYSIS_PROMPT = `
Você é um assistente médico especializado em análise de consultas clínicas em tempo real.

CONTEXTO DA CONSULTA:
- Paciente: {patientName}
- Idade: {patientAge}
- Gênero: {patientGender}
- Duração da consulta: {sessionDuration} minutos
- Tipo de consulta: {consultationType}

TRANSCRIÇÕES RECENTES (últimas 10 falas):
{recentUtterances}

TAREFA:
Analise o contexto atual da consulta e forneça uma análise estruturada.

RESPONDA EM JSON VÁLIDO:
{
  "phase": "anamnese|exame_fisico|diagnostico|tratamento|encerramento",
  "symptoms": ["sintoma1", "sintoma2", "sintoma3"],
  "urgency_level": "baixa|media|alta|critica",
  "next_steps": ["passo1", "passo2", "passo3"],
  "missing_info": ["informacao1", "informacao2"],
  "patient_concerns": ["preocupacao1", "preocupacao2"],
  "doctor_questions_asked": ["pergunta1", "pergunta2"],
  "clinical_notes": "observações importantes sobre o estado do paciente"
}
`;

export const SUGGESTION_GENERATION_PROMPT = `
Você é um médico experiente auxiliando um colega durante uma consulta médica.

CONTEXTO ATUAL DA CONSULTA:
{contextAnalysis}

PROTOCOLOS MÉDICOS RELEVANTES:
{relevantProtocols}

PERGUNTAS JÁ FEITAS PELO MÉDICO:
{alreadyAskedQuestions}

INSTRUÇÕES CRÍTICAS:
- Gere 3-5 perguntas específicas e práticas para o médico fazer ao paciente
- Baseie-se nos protocolos médicos fornecidos
- Considere a fase atual da consulta: {currentPhase}
- Priorize informações críticas para diagnóstico e segurança
- Evite perguntas redundantes ou já feitas
- Considere o nível de urgência: {urgencyLevel}
- Foque em sintomas específicos mencionados: {mentionedSymptoms}

FORMATO DE RESPOSTA (JSON VÁLIDO):
{
  "suggestions": [
    {
      "type": "question|protocol|alert|followup|assessment",
      "content": "Pergunta específica e clara para o médico fazer ao paciente",
      "priority": "low|medium|high|critical",
      "confidence": 0.85,
      "source": "Protocolo específico ou guideline médico",
      "reasoning": "Explicação clara de por que esta pergunta é importante agora",
      "category": "sintomas|historia|exame_fisico|diagnostico|tratamento",
      "follow_up_suggestions": ["sugestao_relacionada1", "sugestao_relacionada2"]
    }
  ],
  "clinical_insights": [
    "insight1 sobre o caso",
    "insight2 sobre próximos passos"
  ],
  "red_flags": [
    "sinal de alerta1 se presente",
    "sinal de alerta2 se presente"
  ]
}
`;

export const EMERGENCY_PROMPT = `
⚠️ PROTOCOLO DE URGÊNCIA MÉDICA ⚠️

SITUAÇÃO CRÍTICA DETECTADA:
- Sintomas críticos: {criticalSymptoms}
- Nível de urgência: CRÍTICO
- Tempo de resposta: IMEDIATO

PROTOCOLO DE URGÊNCIA:
1. Avaliar estabilidade vital imediatamente
2. Perguntar sobre dor torácica, falta de ar, alteração de consciência
3. Verificar sinais vitais básicos
4. Considerar encaminhamento imediato para emergência
5. Documentar tudo para continuidade do cuidado

SUGESTÕES PRIORITÁRIAS (JSON):
{
  "emergency_suggestions": [
    {
      "type": "alert",
      "content": "Avaliar estabilidade vital - verificar pressão arterial, frequência cardíaca e respiratória",
      "priority": "critical",
      "confidence": 1.0,
      "source": "Protocolo de Emergência Médica",
      "reasoning": "Sintomas críticos detectados requerem avaliação imediata",
      "immediate_action": true
    }
  ],
  "immediate_questions": [
    "Você está sentindo dor no peito?",
    "Está com falta de ar?",
    "Está se sentindo tonto ou com alteração da consciência?"
  ],
  "red_flags": [
    "Dor torácica",
    "Dispneia",
    "Alteração de consciência",
    "Hipotensão",
    "Taquicardia"
  ]
}
`;

export const PSYCHIATRY_PROMPT = `
CONSULTA PSIQUIÁTRICA - PROTOCOLO ESPECIALIZADO

CONTEXTO PSIQUIÁTRICO:
- Sintomas psiquiátricos: {psychiatricSymptoms}
- Histórico psiquiátrico: {psychiatricHistory}
- Medicações psiquiátricas: {psychiatricMedications}

FOCO DA AVALIAÇÃO:
1. Escala de humor e ansiedade
2. Sintomas de depressão/mania
3. Histórico psiquiátrico familiar
4. Uso de substâncias
5. Ideação suicida (se relevante)
6. Funcionamento social e ocupacional
7. Qualidade do sono
8. Apetite e peso

SUGESTÕES ESPECÍFICAS (JSON):
{
  "psychiatric_suggestions": [
    {
      "type": "assessment",
      "content": "Como você descreveria seu humor nas últimas 2 semanas?",
      "priority": "high",
      "confidence": 0.9,
      "source": "Protocolo de Avaliação Psiquiátrica",
      "reasoning": "Avaliação do humor é fundamental para diagnóstico psiquiátrico",
      "category": "avaliacao_humor"
    }
  ],
  "screening_questions": [
    "Você tem se sentido triste ou desesperançoso?",
    "Tem dificuldade para dormir ou dorme demais?",
    "Perdeu o interesse em atividades que antes gostava?",
    "Tem pensamentos de morte ou suicídio?"
  ],
  "risk_assessment": [
    "Avaliar risco de suicídio",
    "Verificar uso de substâncias",
    "Avaliar funcionamento social"
  ]
}
`;

export const GENERAL_MEDICINE_PROMPT = `
CLÍNICA GERAL - PROTOCOLO DE AVALIAÇÃO

CONTEXTO CLÍNICO:
- Sintomas principais: {mainSymptoms}
- Duração dos sintomas: {symptomDuration}
- Medicações em uso: {currentMedications}
- Alergias conhecidas: {knownAllergies}

AVALIAÇÃO SISTEMÁTICA:
1. História da doença atual
2. Sintomas sistêmicos (febre, perda de peso, fadiga)
3. Medicações e alergias
4. Histórico familiar de doenças
5. Fatores de risco cardiovascular
6. Exame físico dirigido
7. Sinais vitais

SUGESTÕES CLÍNICAS (JSON):
{
  "general_medicine_suggestions": [
    {
      "type": "question",
      "content": "Há quanto tempo você está com esses sintomas?",
      "priority": "high",
      "confidence": 0.9,
      "source": "Protocolo de Clínica Geral",
      "reasoning": "Duração dos sintomas é fundamental para diagnóstico diferencial",
      "category": "historia_doenca"
    }
  ],
  "systematic_questions": [
    "Você tem febre?",
    "Perdeu peso recentemente?",
    "Tem alguma alergia conhecida?",
    "Alguém na família tem problemas cardíacos?"
  ],
  "vital_signs": [
    "Verificar pressão arterial",
    "Avaliar frequência cardíaca",
    "Medir temperatura",
    "Avaliar saturação de oxigênio"
  ]
}
`;

export const FOLLOW_UP_PROMPT = `
SEGUIMENTO DE SINTOMA ESPECÍFICO

SINTOMA EM FOCO: {focusedSymptom}
CONTEXTO: {symptomContext}

PERGUNTAS DE APROFUNDAMENTO:
1. Duração e evolução temporal
2. Fatores desencadeantes e aliviadores
3. Tratamentos já tentados
4. Impacto na qualidade de vida
5. Sintomas associados
6. Padrão de ocorrência

SUGESTÕES DE SEGUIMENTO (JSON):
{
  "follow_up_suggestions": [
    {
      "type": "followup",
      "content": "Como esse sintoma tem evoluído ao longo do tempo?",
      "priority": "medium",
      "confidence": 0.8,
      "source": "Protocolo de Seguimento",
      "reasoning": "Evolução temporal ajuda no diagnóstico diferencial",
      "category": "evolucao_temporal"
    }
  ],
  "detailed_questions": [
    "O que melhora esse sintoma?",
    "O que piora esse sintoma?",
    "Você já tentou algum tratamento?",
    "Como isso afeta seu dia a dia?"
  ]
}
`;

// Template engine para substituição de variáveis
export class PromptTemplate {
  static replaceVariables(template: string, variables: Record<string, any>): string {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      const replacement = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      result = result.replace(new RegExp(placeholder, 'g'), replacement);
    }
    
    return result;
  }

  static formatUtterances(utterances: any[]): string {
    return utterances
      .slice(-10) // Últimas 10 utterances
      .map(u => `[${u.speaker === 'doctor' ? 'MÉDICO' : 'PACIENTE'}] ${u.text}`)
      .join('\n');
  }

  static formatProtocols(protocols: any[]): string {
    return protocols
      .map(p => `- ${p.title}: ${p.content}`)
      .join('\n');
  }

  static generateContextPrompt(data: {
    patientName: string;
    patientAge?: string;
    patientGender?: string;
    sessionDuration: number;
    consultationType: string;
    utterances: any[];
  }): string {
    return this.replaceVariables(CONTEXT_ANALYSIS_PROMPT, {
      patientName: data.patientName,
      patientAge: data.patientAge || 'Não informado',
      patientGender: data.patientGender || 'Não informado',
      sessionDuration: data.sessionDuration,
      consultationType: data.consultationType,
      recentUtterances: this.formatUtterances(data.utterances)
    });
  }

  static generateSuggestionPrompt(data: {
    contextAnalysis: any;
    relevantProtocols: any[];
    alreadyAskedQuestions: string[];
    currentPhase: string;
    urgencyLevel: string;
    mentionedSymptoms: string[];
  }): string {
    return this.replaceVariables(SUGGESTION_GENERATION_PROMPT, {
      contextAnalysis: JSON.stringify(data.contextAnalysis, null, 2),
      relevantProtocols: this.formatProtocols(data.relevantProtocols),
      alreadyAskedQuestions: data.alreadyAskedQuestions.join(', '),
      currentPhase: data.currentPhase,
      urgencyLevel: data.urgencyLevel,
      mentionedSymptoms: data.mentionedSymptoms.join(', ')
    });
  }

  static generateEmergencyPrompt(data: {
    criticalSymptoms: string[];
  }): string {
    return this.replaceVariables(EMERGENCY_PROMPT, {
      criticalSymptoms: data.criticalSymptoms.join(', ')
    });
  }

  static generateSpecialtyPrompt(specialty: string, data: any): string {
    switch (specialty.toLowerCase()) {
      case 'psychiatry':
      case 'psiquiatria':
        return this.replaceVariables(PSYCHIATRY_PROMPT, data);
      case 'general':
      case 'clinica_geral':
        return this.replaceVariables(GENERAL_MEDICINE_PROMPT, data);
      default:
        return this.replaceVariables(GENERAL_MEDICINE_PROMPT, data);
    }
  }

  static generateFollowUpPrompt(data: {
    focusedSymptom: string;
    symptomContext: string;
  }): string {
    return this.replaceVariables(FOLLOW_UP_PROMPT, data);
  }
}

// Configuração de prompts por versão
export const PROMPT_CONFIG = {
  version: 'v1.0',
  specialties: {
    psychiatry: 'psiquiatria',
    general: 'clinica_geral',
    cardiology: 'cardiologia',
    neurology: 'neurologia',
    pediatrics: 'pediatria'
  },
  emergency: {
    enabled: true,
    threshold: 0.8
  },
  followUp: {
    enabled: true,
    maxDepth: 3
  }
};
