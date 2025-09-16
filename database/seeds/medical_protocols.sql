-- Dados de exemplo para protocolos médicos e knowledge base
-- Este arquivo contém protocolos médicos básicos para o sistema de sugestões de IA

-- Inserir documentos na knowledge base
INSERT INTO kb_documents (id, title, source, specialty, category, subcategory, is_active) VALUES 
-- Protocolos de Clínica Geral
(
    uuid_generate_v4(),
    'Protocolo de Anamnese - Clínica Geral',
    'Manual de Procedimentos Clínicos',
    'clinica_geral',
    'anamnese',
    'geral',
    true
),
(
    uuid_generate_v4(),
    'Perguntas Padronizadas - Dor',
    'Guia de Consulta Clínica',
    'clinica_geral',
    'perguntas',
    'dor',
    true
),
(
    uuid_generate_v4(),
    'Protocolo de Triagem - Sintomas Respiratórios',
    'Manual de Emergência Médica',
    'clinica_geral',
    'triagem',
    'respiratorio',
    true
),
(
    uuid_generate_v4(),
    'Avaliação de Sinais Vitais',
    'Protocolo de Enfermagem',
    'clinica_geral',
    'avaliacao',
    'sinais_vitais',
    true
),

-- Protocolos de Psiquiatria
(
    uuid_generate_v4(),
    'Protocolo de Triagem - Transtornos de Ansiedade',
    'Manual de Procedimentos Psiquiátricos',
    'psiquiatria',
    'triagem',
    'ansiedade',
    true
),
(
    uuid_generate_v4(),
    'Perguntas Padronizadas - Avaliação do Humor',
    'Guia de Consulta Psiquiátrica',
    'psiquiatria',
    'avaliacao',
    'humor',
    true
),
(
    uuid_generate_v4(),
    'Protocolo de Avaliação de Risco Suicida',
    'Manual de Emergência Psiquiátrica',
    'psiquiatria',
    'avaliacao',
    'risco_suicida',
    true
),
(
    uuid_generate_v4(),
    'Avaliação de Uso de Substâncias',
    'Protocolo de Dependência Química',
    'psiquiatria',
    'avaliacao',
    'substancias',
    true
),

-- Protocolos de Cardiologia
(
    uuid_generate_v4(),
    'Protocolo de Avaliação Cardiovascular',
    'Manual de Cardiologia Clínica',
    'cardiologia',
    'avaliacao',
    'cardiovascular',
    true
),
(
    uuid_generate_v4(),
    'Perguntas para Dor Torácica',
    'Guia de Emergência Cardíaca',
    'cardiologia',
    'perguntas',
    'dor_toracica',
    true
),

-- Protocolos de Neurologia
(
    uuid_generate_v4(),
    'Protocolo de Avaliação Neurológica',
    'Manual de Neurologia Clínica',
    'neurologia',
    'avaliacao',
    'neurologica',
    true
),
(
    uuid_generate_v4(),
    'Avaliação de Cefaleia',
    'Guia de Cefaleia',
    'neurologia',
    'avaliacao',
    'cefaleia',
    true
)

ON CONFLICT (id) DO NOTHING;

-- Inserir chunks de conteúdo para os protocolos
-- Estes são exemplos simplificados - em produção, você teria conteúdo mais detalhado

-- Protocolo de Anamnese - Clínica Geral
INSERT INTO kb_chunks (document_id, content, chunk_index, token_count) 
SELECT 
    kd.id,
    'PROTOCOLO DE ANAMNESE - CLÍNICA GERAL

1. IDENTIFICAÇÃO DO PACIENTE
- Nome completo, idade, sexo
- Estado civil, profissão
- Endereço e contato

2. QUEIXA PRINCIPAL
- O que trouxe o paciente à consulta?
- Duração dos sintomas
- Intensidade (escala 0-10)
- Características da dor/sintoma

3. HISTÓRIA DA DOENÇA ATUAL
- Início dos sintomas
- Evolução temporal
- Fatores desencadeantes
- Fatores de melhora/piora
- Tratamentos já realizados

4. SINTOMAS ASSOCIADOS
- Febre, calafrios
- Perda de peso não intencional
- Fadiga, fraqueza
- Alterações do apetite
- Distúrbios do sono

5. HISTÓRIA PATOLÓGICA PREGRESSA
- Doenças anteriores
- Cirurgias realizadas
- Internações hospitalares
- Traumatismos importantes

6. MEDICAÇÕES EM USO
- Medicamentos prescritos
- Medicamentos de uso contínuo
- Suplementos e vitaminas
- Alergias medicamentosas

7. HISTÓRIA FAMILIAR
- Doenças hereditárias
- Câncer na família
- Doenças cardiovasculares
- Diabetes, hipertensão

8. HISTÓRIA SOCIAL
- Tabagismo, etilismo
- Uso de drogas
- Atividade física
- Alimentação
- Condições socioeconômicas',
    1,
    150
FROM kb_documents kd 
WHERE kd.title = 'Protocolo de Anamnese - Clínica Geral' 
AND kd.specialty = 'clinica_geral';

-- Perguntas Padronizadas - Dor
INSERT INTO kb_chunks (document_id, content, chunk_index, token_count) 
SELECT 
    kd.id,
    'PERGUNTAS PADRONIZADAS PARA AVALIAÇÃO DE DOR

1. LOCALIZAÇÃO
- "Onde exatamente você sente a dor?"
- "A dor se espalha para algum lugar?"
- "Você consegue apontar onde dói?"

2. CARACTERÍSTICAS
- "Como você descreveria a dor?" (pontada, queimação, peso, etc.)
- "A dor é constante ou vem e vai?"
- "Você sente formigamento ou dormência?"

3. INTENSIDADE
- "Em uma escala de 0 a 10, sendo 0 sem dor e 10 a pior dor possível, como você classificaria sua dor?"
- "A dor interfere nas suas atividades diárias?"
- "Você consegue dormir normalmente?"

4. DURAÇÃO E EVOLUÇÃO
- "Há quanto tempo você está com essa dor?"
- "A dor começou de repente ou foi aparecendo aos poucos?"
- "A dor tem piorado, melhorado ou está igual?"

5. FATORES DESENCADEANTES
- "O que faz a dor piorar?"
- "O que faz a dor melhorar?"
- "A dor aparece em algum momento específico do dia?"
- "Alguma posição ou movimento piora a dor?"

6. SINTOMAS ASSOCIADOS
- "Você tem febre?"
- "Sente náuseas ou vômitos?"
- "Houve alteração no apetite?"
- "Sente fraqueza ou cansaço?"

7. TRATAMENTOS PRÉVIOS
- "Você já tomou algum remédio para a dor?"
- "Funcionou? Por quanto tempo?"
- "Já fez algum tratamento antes?"
- "Tem alergia a algum medicamento?"',
    1,
    200
FROM kb_documents kd 
WHERE kd.title = 'Perguntas Padronizadas - Dor' 
AND kd.specialty = 'clinica_geral';

-- Protocolo de Triagem - Ansiedade
INSERT INTO kb_chunks (document_id, content, chunk_index, token_count) 
SELECT 
    kd.id,
    'PROTOCOLO DE TRIAGEM - TRANSTORNOS DE ANSIEDADE

1. SINTOMAS PRINCIPAIS DE ANSIEDADE
- Preocupação excessiva e persistente
- Inquietação ou sensação de estar "no limite"
- Fadiga fácil
- Dificuldade de concentração
- Irritabilidade
- Tensão muscular
- Perturbação do sono

2. PERGUNTAS DE TRIAGEM
- "Você tem se preocupado muito ultimamente?"
- "Tem dificuldade para relaxar?"
- "Sente-se inquieto ou nervoso?"
- "Tem medos excessivos ou irracionais?"
- "Evita situações que causam ansiedade?"
- "Tem ataques de pânico?"

3. AVALIAÇÃO DE IMPACTO
- "Como a ansiedade afeta seu trabalho/estudos?"
- "Interfere nos seus relacionamentos?"
- "Limita suas atividades sociais?"
- "Afeta sua qualidade de vida?"

4. HISTÓRIA DE ANSIEDADE
- "Você sempre foi uma pessoa ansiosa?"
- "Quando os sintomas começaram?"
- "Houve algum evento desencadeante?"
- "Já teve crises de ansiedade antes?"

5. COMORBIDADES
- "Você tem depressão?"
- "Usa álcool ou outras substâncias?"
- "Tem problemas de sono?"
- "Tem dores físicas?"

6. HISTÓRIA FAMILIAR
- "Alguém na família tem ansiedade?"
- "Há histórico de transtornos mentais na família?"

7. AVALIAÇÃO DE RISCO
- "Você tem pensamentos de se machucar?"
- "Já tentou se machucar antes?"
- "Tem plano de suicídio?"
- "Tem acesso a meios para se machucar?"

8. ESCALAS DE AVALIAÇÃO
- Escala de Ansiedade de Hamilton (HAM-A)
- Inventário de Ansiedade de Beck (BAI)
- Escala de Ansiedade Generalizada (GAD-7)',
    1,
    180
FROM kb_documents kd 
WHERE kd.title = 'Protocolo de Triagem - Transtornos de Ansiedade' 
AND kd.specialty = 'psiquiatria';

-- Protocolo de Avaliação Cardiovascular
INSERT INTO kb_chunks (document_id, content, chunk_index, token_count) 
SELECT 
    kd.id,
    'PROTOCOLO DE AVALIAÇÃO CARDIOVASCULAR

1. SINTOMAS CARDÍACOS PRINCIPAIS
- Dor torácica
- Falta de ar (dispneia)
- Palpitações
- Síncope/desmaio
- Edema de membros inferiores
- Fadiga

2. PERGUNTAS PARA DOR TORÁCICA
- "Onde exatamente você sente a dor?"
- "A dor se espalha para o braço, pescoço ou mandíbula?"
- "Como você descreveria a dor?" (aperto, queimação, peso)
- "A dor aparece com esforço físico?"
- "Melhora com repouso?"
- "Você sente falta de ar junto com a dor?"

3. AVALIAÇÃO DE DISPNEIA
- "Você sente falta de ar em repouso?"
- "A falta de ar aparece com esforço?"
- "Quantos degraus você consegue subir sem parar?"
- "Você acorda com falta de ar à noite?"
- "Precisa usar mais travesseiros para dormir?"

4. HISTÓRIA CARDIOVASCULAR
- "Você tem pressão alta?"
- "Tem diabetes?"
- "Tem colesterol alto?"
- "Já teve infarto do coração?"
- "Já fez cateterismo ou cirurgia cardíaca?"

5. FATORES DE RISCO
- Tabagismo atual ou passado
- Hipertensão arterial
- Diabetes mellitus
- Dislipidemia
- História familiar de doença cardíaca
- Sedentarismo
- Obesidade
- Estresse

6. MEDICAÇÕES CARDIOVASCULARES
- Anti-hipertensivos
- Estatinas
- Anticoagulantes
- Antiagregantes plaquetários
- Betabloqueadores

7. EXAME FÍSICO CARDIOVASCULAR
- Pressão arterial
- Frequência cardíaca
- Ausculta cardíaca
- Ausculta pulmonar
- Edema de membros inferiores
- Pulso periférico

8. SINAIS DE ALERTA
- Dor torácica súbita e intensa
- Falta de ar em repouso
- Síncope
- Palpitações com desmaio
- Edema súbito',
    1,
    220
FROM kb_documents kd 
WHERE kd.title = 'Protocolo de Avaliação Cardiovascular' 
AND kd.specialty = 'cardiologia';

-- Perguntas para Dor Torácica
INSERT INTO kb_chunks (document_id, content, chunk_index, token_count) 
SELECT 
    kd.id,
    'PERGUNTAS ESPECÍFICAS PARA DOR TORÁCICA

1. CARACTERÍSTICAS DA DOR
- "Onde exatamente você sente a dor?"
- "A dor se espalha para algum lugar?"
- "Como você descreveria a dor?" (aperto, queimação, pontada, peso)
- "A dor é constante ou vem e vai?"

2. INTENSIDADE E DURAÇÃO
- "Em uma escala de 0 a 10, qual a intensidade da dor?"
- "Há quanto tempo você está com essa dor?"
- "A dor começou de repente ou foi aparecendo aos poucos?"

3. FATORES DESENCADEANTES
- "A dor aparece com esforço físico?"
- "Melhora com repouso?"
- "Piora com respiração profunda?"
- "Melhora com mudança de posição?"

4. SINTOMAS ASSOCIADOS
- "Você sente falta de ar?"
- "Tem náuseas ou vômitos?"
- "Sente tontura ou desmaio?"
- "Suou muito?"
- "Sente palpitações?"

5. HISTÓRIA CARDIOVASCULAR
- "Você tem pressão alta?"
- "Tem diabetes?"
- "Fuma ou fumou?"
- "Alguém na família tem problema cardíaco?"
- "Já teve infarto antes?"

6. SINAIS DE ALERTA (RED FLAGS)
- Dor súbita e intensa
- Dor que se espalha para braço esquerdo, pescoço ou mandíbula
- Falta de ar severa
- Sudorese fria
- Náuseas e vômitos
- Síncope ou pré-síncope
- Palpitações com desmaio

7. DIFERENCIAL DIAGNÓSTICO
- Infarto do miocárdio
- Angina instável
- Embolia pulmonar
- Pneumonia
- Pneumotórax
- Pericardite
- Dissecção de aorta
- Refluxo gastroesofágico
- Ansiedade/ataque de pânico',
    1,
    190
FROM kb_documents kd 
WHERE kd.title = 'Perguntas para Dor Torácica' 
AND kd.specialty = 'cardiologia';

-- Comentários finais
COMMENT ON TABLE kb_documents IS 'Documentos da base de conhecimento médico para sugestões de IA';
COMMENT ON TABLE kb_chunks IS 'Chunks de texto com embeddings para busca semântica (RAG)';

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_kb_documents_specialty_category ON kb_documents(specialty, category);
CREATE INDEX IF NOT EXISTS idx_kb_documents_active ON kb_documents(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_kb_chunks_document_id ON kb_chunks(document_id);
