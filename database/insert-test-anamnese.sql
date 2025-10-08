-- =====================================================
-- DADOS DE TESTE PARA TABELAS DE ANAMNESE
-- =====================================================
-- Este script insere dados de teste para facilitar o desenvolvimento

-- IMPORTANTE: Substitua os valores abaixo:
-- - YOUR_USER_ID: seu user_id do auth.users
-- - YOUR_PATIENT_ID: id de um paciente existente
-- - YOUR_CONSULTATION_ID: id de uma consulta existente

-- Para descobrir seu user_id:
-- SELECT id, email FROM auth.users WHERE email = 'seu-email@example.com';

-- Para descobrir ids de pacientes:
-- SELECT id, nome FROM pacientes LIMIT 5;

-- Para descobrir ids de consultas:
-- SELECT id FROM consultas LIMIT 5;

-- =====================================================
-- VARIÁVEIS (SUBSTITUA COM VALORES REAIS)
-- =====================================================
DO $$
DECLARE
    v_user_id TEXT := 'SEU_USER_ID_AQUI';  -- Substitua pelo seu user_id
    v_paciente_id TEXT := 'ID_PACIENTE_AQUI';  -- Substitua por um paciente_id válido
    v_consulta_id TEXT := 'ID_CONSULTA_AQUI';  -- Substitua por um consulta_id válido
BEGIN

-- 1. a_cadastro_prontuario
INSERT INTO public.a_cadastro_prontuario (
    user_id,
    paciente_id,
    consulta_id,
    identificacao_nome_completo,
    identificacao_data_nascimento,
    identificacao_idade_atual,
    identificacao_sexo_biologico,
    dados_sociodemograficos_profissao,
    telefone_celular,
    email
) VALUES (
    v_user_id,
    v_paciente_id,
    v_consulta_id,
    'João da Silva Teste',
    '1985-03-15',
    39,
    'Masculino',
    'Engenheiro de Software',
    '(11) 98765-4321',
    'joao.teste@email.com'
);

-- 2. a_objetivos_queixas
INSERT INTO public.a_objetivos_queixas (
    user_id,
    paciente_id,
    consulta_id,
    queixa_principal,
    saude_geral_percebida_como_descreve_saude,
    expectativas_tratamento_expectativa_especifica
) VALUES (
    v_user_id,
    v_paciente_id,
    v_consulta_id,
    'Dores de cabeça frequentes e cansaço',
    'Regular, com episódios de fadiga',
    'Melhorar qualidade de sono e reduzir dores'
);

-- 3. a_historico_risco
INSERT INTO public.a_historico_risco (
    user_id,
    paciente_id,
    consulta_id,
    doencas_atuais_confirmadas,
    antecedentes_familiares_pai,
    antecedentes_familiares_mae
) VALUES (
    v_user_id,
    v_paciente_id,
    v_consulta_id,
    ARRAY['Hipertensão leve'],
    ARRAY['Diabetes tipo 2', 'Hipertensão'],
    ARRAY['Enxaqueca', 'Tireoide']
);

-- 4. a_observacao_clinica_lab
INSERT INTO public.a_observacao_clinica_lab (
    user_id,
    paciente_id,
    consulta_id,
    nivel_energia_diaria,
    sistema_neurologico_mental_sono_qualidade,
    medidas_antropometricas_peso_atual,
    medidas_antropometricas_altura
) VALUES (
    v_user_id,
    v_paciente_id,
    v_consulta_id,
    'Baixo no período da tarde',
    'Ruim - dificuldade para adormecer',
    75,
    '1.75'
);

-- 5. a_historia_vida
INSERT INTO public.a_historia_vida (
    user_id,
    paciente_id,
    consulta_id,
    narrativa_sintese,
    eventos_vida_marcantes
) VALUES (
    v_user_id,
    v_paciente_id,
    v_consulta_id,
    'Paciente relata infância tranquila, adolescência com pressão acadêmica.',
    ARRAY['Formatura universitária', 'Casamento', 'Mudança de cidade']
);

-- 6. a_setenios_eventos
INSERT INTO public.a_setenios_eventos (
    user_id,
    paciente_id,
    consulta_id,
    primeiro_setenio_0_7_ambiente,
    segundo_setenio_7_14_desenvolvimento,
    terceiro_setenio_14_21_motivacao
) VALUES (
    v_user_id,
    v_paciente_id,
    v_consulta_id,
    'Ambiente familiar estável, pais presentes',
    'Desenvolvimento normal, bom desempenho escolar',
    'Pressão para escolha de carreira'
);

-- 7. a_ambiente_contexto
INSERT INTO public.a_ambiente_contexto (
    user_id,
    paciente_id,
    consulta_id,
    contexto_familiar_estado_civil,
    contexto_profissional_area,
    ambiente_fisico_atividade_fisica_pratica,
    habitos_vida_sono
) VALUES (
    v_user_id,
    v_paciente_id,
    v_consulta_id,
    'Casado',
    'Tecnologia',
    'Caminhada ocasional',
    '6h por noite, sono fragmentado'
);

-- 8. a_sensacao_emocoes
INSERT INTO public.a_sensacao_emocoes (
    user_id,
    paciente_id,
    consulta_id,
    emocoes_predominantes,
    sensacoes_corporais,
    intensidade_emocional
) VALUES (
    v_user_id,
    v_paciente_id,
    v_consulta_id,
    ARRAY['Ansiedade', 'Preocupação', 'Cansaço'],
    ARRAY['Tensão no pescoço', 'Dor de cabeça', 'Aperto no peito'],
    'Moderada a alta'
);

-- 9. a_preocupacoes_crencas
INSERT INTO public.a_preocupacoes_crencas (
    user_id,
    paciente_id,
    consulta_id,
    como_percebe_problema,
    preocupacoes_explicitas,
    nivel_insight_autoconsciencia
) VALUES (
    v_user_id,
    v_paciente_id,
    v_consulta_id,
    'Acredita que o estresse do trabalho está afetando sua saúde',
    ARRAY['Saúde cardiovascular', 'Produtividade no trabalho', 'Relacionamento familiar'],
    'Alto - reconhece padrões e busca mudança'
);

-- 10. a_reino_miasma
INSERT INTO public.a_reino_miasma (
    user_id,
    paciente_id,
    consulta_id,
    reino_predominante,
    caracteristicas_identificadas,
    padrao_discurso
) VALUES (
    v_user_id,
    v_paciente_id,
    v_consulta_id,
    'Mineral',
    ARRAY['Estruturado', 'Racional', 'Perfeccionista'],
    'Objetivo e detalhista'
);

RAISE NOTICE '✅ Dados de teste inseridos com sucesso!';
RAISE NOTICE '🔍 Consulta ID: %', v_consulta_id;

END $$;

