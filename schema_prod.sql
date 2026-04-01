--
-- PostgreSQL database dump
--

\restrict QSD5ZWhSN3amGIWplbxZ2nGegxNHLWiILYYz3V59hduA5hU8o5LxbxsdNxYX9cc

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: ES; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ES" AS ENUM (
    'LTB',
    'MENTALIDADE',
    'ALIMENTACAO',
    'SUPLEMENTACAO',
    'ATIVIDADE_FISICA',
    'HABITOS_DE_VIDA'
);


--
-- Name: TYPE "ES"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public."ES" IS 'Etapas da Solução';


--
-- Name: ETAPAS; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ETAPAS" AS ENUM (
    'ANAMNESE',
    'DIAGNOSTICO',
    'SOLUCAO'
);


--
-- Name: ETAPA_CONSULTA; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ETAPA_CONSULTA" AS ENUM (
    'NOVA',
    'RETORNO',
    'CANCELADO'
);


--
-- Name: auto_resolve_reports(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_resolve_reports() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  report_record RECORD;
  consultation_status TEXT;
  resolved_count INTEGER := 0;
BEGIN
  -- Buscar todos os reports não resolvidos
  FOR report_record IN
    SELECT 
      rc.id as report_id,
      rc.consulta_id,
      rc.patient_name,
      rc.etapa,
      rc.message
    FROM reports_consultas rc
    WHERE rc.resolved = FALSE
  LOOP
    
    -- Verificar o status atual da consulta
    SELECT status::text INTO consultation_status
    FROM consultations
    WHERE id = report_record.consulta_id;
    
    -- Se a consulta saiu de PROCESSING, resolver o report
    IF consultation_status IS NULL OR consultation_status != 'PROCESSING' THEN
      
      UPDATE reports_consultas
      SET 
        resolved = TRUE,
        resolved_at = NOW()
      WHERE id = report_record.report_id;
      
      resolved_count := resolved_count + 1;
      
      RAISE NOTICE '✅ AUTO-RESOLVIDO - Report: %, Consulta: %, Status agora: %',
        report_record.report_id,
        report_record.consulta_id,
        COALESCE(consultation_status, 'DELETED');
    END IF;
    
  END LOOP;
  
  IF resolved_count > 0 THEN
    RAISE NOTICE '✓ Total de reports auto-resolvidos: %', resolved_count;
  ELSE
    RAISE NOTICE '✓ Nenhum report para resolver neste momento';
  END IF;
  
END;
$$;


--
-- Name: calculate_patient_metrics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_patient_metrics() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_equilibrio_sono DECIMAL;
  v_equilibrio_atividade_fisica DECIMAL;
  v_equilibrio_alimentacao DECIMAL;
  v_equilibrio_geral DECIMAL;
BEGIN
  -- Calcular equilíbrio de Sono (média ponderada: qualidade 70%, tempo 30%)
  SELECT 
    COALESCE(
      AVG(sono_qualidade * 0.7 + (sono_tempo_horas / 8.0 * 10) * 0.3),
      0
    )
  INTO v_equilibrio_sono
  FROM public.daily_checkins
  WHERE paciente_id = NEW.paciente_id
    AND data_checkin >= CURRENT_DATE - INTERVAL '7 days';

  -- Calcular equilíbrio de Atividade Física (tempo e intensidade)
  SELECT 
    COALESCE(
      AVG((atividade_tempo_horas / 1.5 * 10 * 0.5) + (atividade_intensidade / 10.0 * 0.5)),
      0
    )
  INTO v_equilibrio_atividade_fisica
  FROM public.daily_checkins
  WHERE paciente_id = NEW.paciente_id
    AND data_checkin >= CURRENT_DATE - INTERVAL '7 days';

  -- Calcular equilíbrio de Alimentação (refeições e água)
  SELECT 
    COALESCE(
      AVG((alimentacao_refeicoes / 4.0 * 10 * 0.5) + (alimentacao_agua_litros / 2.5 * 10 * 0.5)),
      0
    )
  INTO v_equilibrio_alimentacao
  FROM public.daily_checkins
  WHERE paciente_id = NEW.paciente_id
    AND data_checkin >= CURRENT_DATE - INTERVAL '7 days';

  -- Calcular equilíbrio geral (média das 3 dimensões)
  v_equilibrio_geral := (v_equilibrio_sono + v_equilibrio_atividade_fisica + v_equilibrio_alimentacao) / 3.0;

  -- Calcular outras métricas
  INSERT INTO public.patient_metrics (
    paciente_id,
    equilibrio_sono,
    equilibrio_atividade_fisica,
    equilibrio_alimentacao,
    equilibrio_geral,
    qualidade_sono_horas,
    hidratacao_atual_litros,
    hidratacao_meta_litros,
    mental_energia,
    updated_at
  )
  VALUES (
    NEW.paciente_id,
    v_equilibrio_sono,
    v_equilibrio_atividade_fisica,
    v_equilibrio_alimentacao,
    v_equilibrio_geral,
    COALESCE((SELECT AVG(sono_tempo_horas) FROM public.daily_checkins WHERE paciente_id = NEW.paciente_id AND data_checkin >= CURRENT_DATE - INTERVAL '7 days'), 0),
    COALESCE((SELECT AVG(alimentacao_agua_litros) FROM public.daily_checkins WHERE paciente_id = NEW.paciente_id AND data_checkin >= CURRENT_DATE - INTERVAL '7 days'), 0),
    2.4,
    COALESCE((SELECT AVG(sono_qualidade) FROM public.daily_checkins WHERE paciente_id = NEW.paciente_id AND data_checkin >= CURRENT_DATE - INTERVAL '7 days'), 0),
    NOW()
  )
  ON CONFLICT (paciente_id) 
  DO UPDATE SET
    equilibrio_sono = EXCLUDED.equilibrio_sono,
    equilibrio_atividade_fisica = EXCLUDED.equilibrio_atividade_fisica,
    equilibrio_alimentacao = EXCLUDED.equilibrio_alimentacao,
    equilibrio_geral = EXCLUDED.equilibrio_geral,
    qualidade_sono_horas = EXCLUDED.qualidade_sono_horas,
    hidratacao_atual_litros = EXCLUDED.hidratacao_atual_litros,
    mental_energia = EXCLUDED.mental_energia,
    updated_at = NOW();

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION calculate_patient_metrics(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.calculate_patient_metrics() IS 'Calcula métricas do paciente baseado nos check-ins dos últimos 7 dias. Agora considera apenas 3 categorias: Sono, Atividade Física e Alimentação.';


--
-- Name: calculate_patient_metrics(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_patient_metrics(p_paciente_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_periodo_dias INTEGER := 7;
  v_data_inicio DATE;
  v_equilibrio_geral DECIMAL(4,2);
  v_equilibrio_sono DECIMAL(4,2);
  v_equilibrio_atividade DECIMAL(4,2);
  v_equilibrio_alimentacao DECIMAL(4,2);
  v_sono_horas DECIMAL(4,2);
  v_hidratacao DECIMAL(4,2);
  v_mental_energia DECIMAL(4,2);
  v_aderencia DECIMAL(5,2);
  v_total_checkins INTEGER;
BEGIN
  v_data_inicio := CURRENT_DATE - v_periodo_dias;
  
  -- Calcular métricas individuais (apenas com colunas existentes)
  SELECT 
    COALESCE(AVG(sono_qualidade * 0.7 + (sono_tempo_horas / 8 * 10) * 0.3), 0),
    COALESCE(AVG((atividade_tempo_horas / 1.5 * 10 * 0.5) + (atividade_intensidade / 10.0 * 0.5)), 0),
    COALESCE(AVG((alimentacao_refeicoes / 4.0 * 10 * 0.5) + (alimentacao_agua_litros / 2.5 * 10 * 0.5)), 0),
    COALESCE(AVG(sono_tempo_horas), 0),
    COALESCE(AVG(alimentacao_agua_litros), 0),
    COUNT(*)
  INTO 
    v_equilibrio_sono, v_equilibrio_atividade, v_equilibrio_alimentacao,
    v_sono_horas, v_hidratacao, v_total_checkins
  FROM daily_checkins
  WHERE paciente_id = p_paciente_id
    AND data_checkin >= v_data_inicio;
  
  -- Calcular equilíbrio geral (média das 3 dimensões)
  v_equilibrio_geral := (v_equilibrio_sono + v_equilibrio_atividade + v_equilibrio_alimentacao) / 3.0;
  
  -- Mental & Energia (baseado em sono e atividade)
  v_mental_energia := (v_equilibrio_sono * 0.6 + v_equilibrio_atividade * 0.4);
  
  -- Aderência
  v_aderencia := (v_total_checkins::DECIMAL / v_periodo_dias::DECIMAL) * 100;
  IF v_aderencia > 100 THEN
    v_aderencia := 100;
  END IF;
  
  -- LOG para debug
  RAISE NOTICE 'Valores calculados - Sono: %, Atividade: %, Alimentação: %, Geral: %',
    v_equilibrio_sono, v_equilibrio_atividade, v_equilibrio_alimentacao, v_equilibrio_geral;
  
  -- Inserir ou atualizar métricas
  INSERT INTO patient_metrics (
    paciente_id, 
    updated_at,
    equilibrio_geral, 
    equilibrio_geral_variacao,
    qualidade_sono_horas, 
    qualidade_sono_variacao_minutos,
    hidratacao_atual_litros, 
    hidratacao_meta_litros,
    mental_energia, 
    mental_energia_variacao,
    equilibrio_sono, 
    equilibrio_atividade_fisica,
    equilibrio_alimentacao,
    aderencia_protocolo
  )
  VALUES (
    p_paciente_id, 
    NOW(),
    v_equilibrio_geral, 
    0,
    v_sono_horas, 
    0,
    v_hidratacao, 
    2.4,
    v_mental_energia, 
    0,
    v_equilibrio_sono, 
    v_equilibrio_atividade,
    v_equilibrio_alimentacao,
    v_aderencia
  )
  ON CONFLICT (paciente_id) DO UPDATE SET
    updated_at = NOW(),
    equilibrio_geral_variacao = CASE 
      WHEN patient_metrics.equilibrio_geral IS NOT NULL AND patient_metrics.equilibrio_geral != 0
      THEN ((v_equilibrio_geral - patient_metrics.equilibrio_geral) / patient_metrics.equilibrio_geral * 100)
      ELSE 0
    END,
    equilibrio_geral = v_equilibrio_geral,
    qualidade_sono_variacao_minutos = CASE
      WHEN patient_metrics.qualidade_sono_horas IS NOT NULL
      THEN ROUND((v_sono_horas - patient_metrics.qualidade_sono_horas) * 60)
      ELSE 0
    END,
    qualidade_sono_horas = v_sono_horas,
    hidratacao_atual_litros = v_hidratacao,
    mental_energia_variacao = CASE 
      WHEN patient_metrics.mental_energia IS NOT NULL AND patient_metrics.mental_energia != 0
      THEN ((v_mental_energia - patient_metrics.mental_energia) / patient_metrics.mental_energia * 100)
      ELSE 0
    END,
    mental_energia = v_mental_energia,
    equilibrio_sono = v_equilibrio_sono,
    equilibrio_atividade_fisica = v_equilibrio_atividade,
    equilibrio_alimentacao = v_equilibrio_alimentacao,
    aderencia_protocolo = v_aderencia;
    
  RAISE NOTICE 'Métricas atualizadas com sucesso para paciente: %', p_paciente_id;
END;
$$;


--
-- Name: check_stuck_consultations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_stuck_consultations() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  consultation_record RECORD;
  webhook_url TEXT := 'https://triahook.gst.dev.br/webhook/e9b44bff-5c5c-4e19-bfd3-88de49266b5c/:usi-suporte-v2';
  payload JSONB;
  request_id INTEGER;
  error_message TEXT;
  missing_tables TEXT[];
  missing_agents TEXT[];
  v_error_hash TEXT;
  error_already_reported BOOLEAN;
  report_id UUID;
  status_agentes_exists BOOLEAN;
  all_agents_true BOOLEAN;
  table_exists BOOLEAN;
  consulta_id_text TEXT;
  patient_id_text TEXT;
BEGIN
  FOR consultation_record IN
    SELECT 
      c.id,
      c.patient_id,
      c.doctor_id,
      c.patient_name,
      c.status,
      c.etapa::text as etapa,
      c.updated_at,
      c.clinica_id,
      c.env,
      EXTRACT(EPOCH FROM (NOW() - c.updated_at))/60 as minutes_stuck,
      m.name as doctor_name
    FROM public.consultations c
    LEFT JOIN public.medicos m ON m.id = c.doctor_id
    WHERE 
      c.status = 'PROCESSING'
      AND (c.etapa IN ('ANAMNESE', 'DIAGNOSTICO', 'SOLUCAO') OR c.etapa IS NULL)
      AND c.updated_at < (NOW() - INTERVAL '10 minutes')
      AND m.tester IS NULL
  LOOP
    error_message := NULL;
    missing_tables := ARRAY[]::TEXT[];
    missing_agents := ARRAY[]::TEXT[];
    
    -- Converter IDs para TEXT
    consulta_id_text := consultation_record.id::text;
    patient_id_text := consultation_record.patient_id::text;

    IF consultation_record.etapa IS NULL THEN
      error_message := 'Consulta travada há ' || ROUND(consultation_record.minutes_stuck::numeric, 2) || 
                      ' minutos com ETAPA NULL. Possível falha no início do fluxo.';

    -- ============ ANAMNESE (TEXT) ============
    ELSIF consultation_record.etapa = 'ANAMNESE' THEN
      
      SELECT EXISTS (
        SELECT 1 FROM status_agentes 
        WHERE consulta_id = consulta_id_text
      ) INTO status_agentes_exists;

      IF NOT status_agentes_exists THEN
        error_message := 'Linha não criada na tabela status_agentes. Problema possivelmente no webhook inicial.';
      ELSE
        SELECT (
          COALESCE(agente1_cadastro_prontuario, FALSE) AND
          COALESCE(agente2_objetivos_queixas, FALSE) AND
          COALESCE(agente3_sensacao_emocoes_campos_sutis, FALSE) AND
          COALESCE(agente4_ambiente_contexto, FALSE) AND
          COALESCE(agente5_classificacao_reino_miasma, FALSE) AND
          COALESCE(agente6_historia_vida_narrativa, FALSE) AND
          COALESCE(agente7_setenios_eventos_criticos, FALSE) AND
          COALESCE(agente8_preocupacoes_crencas_queixa, FALSE) AND
          COALESCE(agente9_observacao_clinica_laboratorial, FALSE) AND
          COALESCE(agente10_historico_doencas_pregressas_risco, FALSE) AND
          COALESCE(agente11_sintese_analitica, FALSE)
        ) INTO all_agents_true
        FROM status_agentes
        WHERE consulta_id = consulta_id_text;

        IF NOT all_agents_true THEN
          SELECT array_agg(agente_name)
          INTO missing_agents
          FROM (
            SELECT 
              CASE 
                WHEN NOT COALESCE(agente1_cadastro_prontuario, FALSE) THEN 'agente1_cadastro_prontuario'
                WHEN NOT COALESCE(agente2_objetivos_queixas, FALSE) THEN 'agente2_objetivos_queixas'
                WHEN NOT COALESCE(agente3_sensacao_emocoes_campos_sutis, FALSE) THEN 'agente3_sensacao_emocoes_campos_sutis'
                WHEN NOT COALESCE(agente4_ambiente_contexto, FALSE) THEN 'agente4_ambiente_contexto'
                WHEN NOT COALESCE(agente5_classificacao_reino_miasma, FALSE) THEN 'agente5_classificacao_reino_miasma'
                WHEN NOT COALESCE(agente6_historia_vida_narrativa, FALSE) THEN 'agente6_historia_vida_narrativa'
                WHEN NOT COALESCE(agente7_setenios_eventos_criticos, FALSE) THEN 'agente7_setenios_eventos_criticos'
                WHEN NOT COALESCE(agente8_preocupacoes_crencas_queixa, FALSE) THEN 'agente8_preocupacoes_crencas_queixa'
                WHEN NOT COALESCE(agente9_observacao_clinica_laboratorial, FALSE) THEN 'agente9_observacao_clinica_laboratorial'
                WHEN NOT COALESCE(agente10_historico_doencas_pregressas_risco, FALSE) THEN 'agente10_historico_doencas_pregressas_risco'
                WHEN NOT COALESCE(agente11_sintese_analitica, FALSE) THEN 'agente11_sintese_analitica'
              END as agente_name
            FROM status_agentes
            WHERE consulta_id = consulta_id_text
          ) agents
          WHERE agente_name IS NOT NULL;

          error_message := 'Agentes não finalizados (NULL ou FALSE): ' || array_to_string(missing_agents, ', ');
        ELSE
          error_message := 'Consulta travada há ' || ROUND(consultation_record.minutes_stuck::numeric, 2) || 
                          ' minutos. Todos os agentes estão TRUE mas não avançou para próxima etapa.';
        END IF;
      END IF;

    -- ============ DIAGNOSTICO (UUID) ============
    ELSIF consultation_record.etapa = 'DIAGNOSTICO' THEN
      
      SELECT EXISTS (SELECT 1 FROM d_agente_habitos_vida_sistemica WHERE consulta_id = consultation_record.id) INTO table_exists;
      IF NOT table_exists THEN missing_tables := array_append(missing_tables, 'd_agente_habitos_vida_sistemica'); END IF;

      SELECT EXISTS (SELECT 1 FROM d_agente_integracao_diagnostica WHERE consulta_id = consultation_record.id) INTO table_exists;
      IF NOT table_exists THEN missing_tables := array_append(missing_tables, 'd_agente_integracao_diagnostica'); END IF;

      SELECT EXISTS (SELECT 1 FROM d_diagnostico_principal WHERE consulta_id = consultation_record.id) INTO table_exists;
      IF NOT table_exists THEN missing_tables := array_append(missing_tables, 'd_diagnostico_principal'); END IF;

      SELECT EXISTS (SELECT 1 FROM d_estado_fisiologico WHERE consulta_id = consultation_record.id) INTO table_exists;
      IF NOT table_exists THEN missing_tables := array_append(missing_tables, 'd_estado_fisiologico'); END IF;

      SELECT EXISTS (SELECT 1 FROM d_estado_geral WHERE consulta_id = consultation_record.id) INTO table_exists;
      IF NOT table_exists THEN missing_tables := array_append(missing_tables, 'd_estado_geral'); END IF;

      SELECT EXISTS (SELECT 1 FROM d_estado_mental WHERE consulta_id = consultation_record.id) INTO table_exists;
      IF NOT table_exists THEN missing_tables := array_append(missing_tables, 'd_estado_mental'); END IF;

      IF array_length(missing_tables, 1) > 0 THEN
        error_message := 'Tabelas sem registro: ' || array_to_string(missing_tables, ', ');
      ELSE
        error_message := 'Consulta travada há ' || ROUND(consultation_record.minutes_stuck::numeric, 2) || 
                        ' minutos. Todas as tabelas existem mas não avançou para próxima etapa.';
      END IF;

    -- ============ SOLUCAO (MISTO: TEXT e UUID) ============
    ELSIF consultation_record.etapa = 'SOLUCAO' THEN
      
      -- TEXT
      SELECT EXISTS (SELECT 1 FROM s_agente_habitos_de_vida_final WHERE consulta_id = consulta_id_text) INTO table_exists;
      IF NOT table_exists THEN missing_tables := array_append(missing_tables, 's_agente_habitos_de_vida_final'); END IF;

      -- TEXT
      SELECT EXISTS (SELECT 1 FROM s_agente_limpeza_do_terreno_biologico WHERE consulta_id = consulta_id_text) INTO table_exists;
      IF NOT table_exists THEN missing_tables := array_append(missing_tables, 's_agente_limpeza_do_terreno_biologico'); END IF;

      -- TEXT
      SELECT EXISTS (SELECT 1 FROM s_agente_mentalidade_2 WHERE consulta_id = consulta_id_text) INTO table_exists;
      IF NOT table_exists THEN missing_tables := array_append(missing_tables, 's_agente_mentalidade_2'); END IF;

      -- UUID ⚠️
      SELECT EXISTS (SELECT 1 FROM s_exercicios_fisicos WHERE consulta_id = consultation_record.id) INTO table_exists;
      IF NOT table_exists THEN missing_tables := array_append(missing_tables, 's_exercicios_fisicos'); END IF;

      -- TEXT
      SELECT EXISTS (SELECT 1 FROM s_suplementacao2 WHERE consulta_id = consulta_id_text) INTO table_exists;
      IF NOT table_exists THEN missing_tables := array_append(missing_tables, 's_suplementacao2'); END IF;

      -- UUID ⚠️ (usa paciente_id, não consulta_id)
      SELECT EXISTS (SELECT 1 FROM s_gramaturas_alimentares WHERE paciente_id = consultation_record.patient_id) INTO table_exists;
      IF NOT table_exists THEN missing_tables := array_append(missing_tables, 's_gramaturas_alimentares (paciente_id)'); END IF;

      IF array_length(missing_tables, 1) > 0 THEN
        error_message := 'Tabelas sem registro: ' || array_to_string(missing_tables, ', ');
      ELSE
        error_message := 'Consulta travada há ' || ROUND(consultation_record.minutes_stuck::numeric, 2) || 
                        ' minutos. Todas as tabelas existem mas não avançou para próxima etapa.';
      END IF;

    END IF;

    v_error_hash := md5(consulta_id_text || '|' || COALESCE(consultation_record.etapa, 'NULL'));

    SELECT EXISTS (
      SELECT 1 FROM reports_consultas 
      WHERE error_hash = v_error_hash 
        AND resolved = FALSE
    ) INTO error_already_reported;

    IF NOT error_already_reported THEN
      BEGIN
        INSERT INTO reports_consultas (
          consulta_id, clinica_id, paciente_id, doctor_id, doctor_name, patient_name,
          status, etapa, message, minutes_stuck, updated_at, env, error_hash
        ) VALUES (
          consultation_record.id, 
          consultation_record.clinica_id, 
          consultation_record.patient_id,
          consultation_record.doctor_id, 
          consultation_record.doctor_name, 
          consultation_record.patient_name, 
          consultation_record.status, 
          COALESCE(consultation_record.etapa, 'NULL'), 
          error_message, 
          ROUND(consultation_record.minutes_stuck::numeric, 2),
          consultation_record.updated_at, 
          consultation_record.env, 
          v_error_hash
        ) RETURNING id INTO report_id;

        payload := jsonb_build_object(
          'report_id', report_id,
          'clinica_id', consultation_record.clinica_id,
          'consulta_id', consultation_record.id,
          'paciente_id', consultation_record.patient_id,
          'doctor_id', consultation_record.doctor_id,
          'doctor_name', consultation_record.doctor_name,
          'patient_name', consultation_record.patient_name,
          'status', consultation_record.status,
          'etapa', COALESCE(consultation_record.etapa, 'NULL'),
          'message', error_message,
          'minutes_stuck', ROUND(consultation_record.minutes_stuck::numeric, 2),
          'updated_at', consultation_record.updated_at,
          'env', consultation_record.env,
          'timestamp', NOW()
        );

        SELECT net.http_post(
          url := webhook_url,
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := payload
        ) INTO request_id;

        RAISE NOTICE '✉️  ALERTA - Report: %, Consulta: %, Paciente: %',
          report_id, consultation_record.id, consultation_record.patient_name;
          
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ERRO ao criar report: %', SQLERRM;
      END;
    ELSE
      RAISE NOTICE '⏭️  JÁ REPORTADO - Consulta: %', consultation_record.id;
    END IF;

  END LOOP;
END;
$$;


--
-- Name: check_stuck_consultations_debug(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_stuck_consultations_debug() RETURNS TABLE(debug_info text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  consultation_record RECORD;
  webhook_url TEXT := 'https://triahook.gst.dev.br/webhook/e9b44bff-5c5c-4e19-bfd3-88de49266b5c/:usi-suporte-v2';
  payload JSONB;
  request_id INTEGER;
  error_message TEXT;
  v_error_hash TEXT;
  error_already_reported BOOLEAN;
  report_id UUID;
  loop_count INTEGER := 0;
  
  status_agentes_exists BOOLEAN;
  all_agents_true BOOLEAN;
BEGIN
  debug_info := '🔍 INICIANDO FUNÇÃO DE DEBUG'; RETURN NEXT;
  debug_info := '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'; RETURN NEXT;
  
  FOR consultation_record IN
    SELECT 
      c.id,
      c.patient_id,
      c.doctor_id,
      c.patient_name,
      c.status,
      c.etapa::text as etapa,
      c.updated_at,
      c.clinica_id,
      c.env,
      EXTRACT(EPOCH FROM (NOW() - c.updated_at))/60 as minutes_stuck,
      m.name as doctor_name
    FROM public.consultations c
    LEFT JOIN public.medicos m ON m.id = c.doctor_id
    WHERE 
      c.status = 'PROCESSING'
      AND (c.etapa IN ('ANAMNESE', 'DIAGNOSTICO', 'SOLUCAO') OR c.etapa IS NULL)
      AND c.updated_at < (NOW() - INTERVAL '10 minutes')
    LIMIT 5
  LOOP
    loop_count := loop_count + 1;
    debug_info := ''; RETURN NEXT;
    debug_info := '📋 LOOP #' || loop_count; RETURN NEXT;
    debug_info := '   ID: ' || consultation_record.id::text; RETURN NEXT;
    debug_info := '   Nome: ' || consultation_record.patient_name; RETURN NEXT;
    debug_info := '   Etapa: ' || COALESCE(consultation_record.etapa, 'NULL'); RETURN NEXT;
    debug_info := '   Minutos: ' || ROUND(consultation_record.minutes_stuck::numeric, 2)::text; RETURN NEXT;
    
    error_message := NULL;
    
    -- Verificar qual etapa
    IF consultation_record.etapa IS NULL THEN
      error_message := 'Consulta travada com ETAPA NULL';
      debug_info := '   ✓ Error message definida: ETAPA NULL'; RETURN NEXT;
      
    ELSIF consultation_record.etapa = 'ANAMNESE' THEN
      debug_info := '   → Verificando ANAMNESE...'; RETURN NEXT;
      error_message := 'Teste ANAMNESE';
      
    ELSIF consultation_record.etapa = 'DIAGNOSTICO' THEN
      debug_info := '   → Verificando DIAGNOSTICO...'; RETURN NEXT;
      error_message := 'Teste DIAGNOSTICO';
      
    ELSIF consultation_record.etapa = 'SOLUCAO' THEN
      debug_info := '   → Verificando SOLUCAO...'; RETURN NEXT;
      error_message := 'Teste SOLUCAO';
    END IF;
    
    debug_info := '   Error message: ' || COALESCE(error_message, 'NULL'); RETURN NEXT;
    
    -- Calcular hash
    v_error_hash := md5(consultation_record.id::text || '|' || COALESCE(consultation_record.etapa, 'NULL'));
    debug_info := '   Hash: ' || v_error_hash; RETURN NEXT;
    
    -- Verificar se já existe
    SELECT EXISTS (
      SELECT 1 FROM reports_consultas 
      WHERE error_hash = v_error_hash 
        AND resolved = FALSE
    ) INTO error_already_reported;
    
    debug_info := '   Já reportado? ' || CASE WHEN error_already_reported THEN 'SIM' ELSE 'NÃO' END; RETURN NEXT;
    
    IF NOT error_already_reported THEN
      debug_info := '   ✅ TENTANDO INSERIR REPORT...'; RETURN NEXT;
      
      BEGIN
        INSERT INTO reports_consultas (
          consulta_id, clinica_id, paciente_id, doctor_id, doctor_name, patient_name,
          status, etapa, message, minutes_stuck, updated_at, env, error_hash
        ) VALUES (
          consultation_record.id, consultation_record.clinica_id, consultation_record.patient_id,
          consultation_record.doctor_id, consultation_record.doctor_name, consultation_record.patient_name, 
          consultation_record.status, COALESCE(consultation_record.etapa, 'NULL'), error_message, 
          ROUND(consultation_record.minutes_stuck::numeric, 2),
          consultation_record.updated_at, consultation_record.env, v_error_hash
        ) RETURNING id INTO report_id;
        
        debug_info := '   ✅ REPORT CRIADO! ID: ' || report_id::text; RETURN NEXT;
        
      EXCEPTION WHEN OTHERS THEN
        debug_info := '   ❌ ERRO AO INSERIR: ' || SQLERRM; RETURN NEXT;
      END;
      
    ELSE
      debug_info := '   ⏭️  PULANDO (já reportado)'; RETURN NEXT;
    END IF;
    
  END LOOP;
  
  debug_info := ''; RETURN NEXT;
  debug_info := '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'; RETURN NEXT;
  debug_info := '📊 TOTAL DE LOOPS: ' || loop_count::text; RETURN NEXT;
  
  IF loop_count = 0 THEN
    debug_info := '❌ NENHUMA CONSULTA ENCONTRADA NO LOOP!'; RETURN NEXT;
  END IF;
  
END;
$$;


--
-- Name: generate_lgpd_access_report(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_lgpd_access_report(p_patient_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_report JSONB;
BEGIN
    SELECT jsonb_build_object(
        'generated_at', NOW(),
        'patient_id', p_patient_id,
        'total_accesses', (
            SELECT COUNT(*) FROM audit_logs 
            WHERE related_patient_id = p_patient_id
        ),
        'accesses_by_action', (
            SELECT jsonb_object_agg(action, count)
            FROM (
                SELECT action, COUNT(*) as count 
                FROM audit_logs 
                WHERE related_patient_id = p_patient_id
                GROUP BY action
            ) t
        ),
        'accesses_by_resource', (
            SELECT jsonb_object_agg(resource_type, count)
            FROM (
                SELECT resource_type, COUNT(*) as count 
                FROM audit_logs 
                WHERE related_patient_id = p_patient_id
                GROUP BY resource_type
            ) t
        ),
        'unique_users_accessed', (
            SELECT COUNT(DISTINCT user_id) FROM audit_logs 
            WHERE related_patient_id = p_patient_id
        ),
        'first_access', (
            SELECT MIN(created_at) FROM audit_logs 
            WHERE related_patient_id = p_patient_id
        ),
        'last_access', (
            SELECT MAX(created_at) FROM audit_logs 
            WHERE related_patient_id = p_patient_id
        ),
        'sensitive_data_accesses', (
            SELECT COUNT(*) FROM audit_logs 
            WHERE related_patient_id = p_patient_id 
            AND contains_sensitive_data = true
        )
    ) INTO v_report;
    
    RETURN v_report;
END;
$$;


--
-- Name: FUNCTION generate_lgpd_access_report(p_patient_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.generate_lgpd_access_report(p_patient_id uuid) IS 'Gera relatório consolidado de acessos para atender solicitações LGPD';


--
-- Name: get_consultations_pending_sync(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_consultations_pending_sync(medico_uuid uuid) RETURNS TABLE(consultation_id uuid, patient_name character varying, consultation_type character varying, created_at timestamp with time zone, duration integer, sync_status character varying)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.patient_name,
        c.consultation_type,
        c.created_at,
        c.duration,
        c.sync_status
    FROM consultations c
    WHERE c.doctor_id = medico_uuid
    AND c.sync_status IN ('pending', 'error')
    ORDER BY c.created_at DESC;
END;
$$;


--
-- Name: get_medico_google_calendar_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_medico_google_calendar_token(medico_uuid uuid) RETURNS TABLE(token_id uuid, access_token text, refresh_token text, token_expiry timestamp with time zone, calendar_id character varying, is_expired boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gct.id,
        gct.access_token,
        gct.refresh_token,
        gct.token_expiry,
        gct.calendar_id,
        (gct.token_expiry < NOW()) as is_expired
    FROM google_calendar_tokens gct
    WHERE gct.medico_id = medico_uuid
    AND gct.sync_enabled = true;
END;
$$;


--
-- Name: get_patient_consultations(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_patient_consultations(patient_uuid uuid) RETURNS TABLE(consultation_id uuid, consultation_type character varying, status character varying, duration integer, created_at timestamp with time zone, patient_context text, has_transcription boolean, has_audio boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.consultation_type,
        c.status,
        c.duration,
        c.created_at,
        c.patient_context,
        (EXISTS(SELECT 1 FROM transcriptions t WHERE t.consultation_id = c.id)),
        (EXISTS(SELECT 1 FROM audio_files af WHERE af.consultation_id = c.id))
    FROM consultations c
    WHERE c.patient_id = patient_uuid
    ORDER BY c.created_at DESC;
END;
$$;


--
-- Name: get_patient_data_access_logs(uuid, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_patient_data_access_logs(p_patient_id uuid, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(log_id uuid, accessed_by_email character varying, accessed_by_name character varying, accessed_by_role character varying, action character varying, resource_type character varying, data_fields_accessed text[], accessed_at timestamp with time zone, ip_address inet, purpose text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id as log_id,
        al.user_email as accessed_by_email,
        al.user_name as accessed_by_name,
        al.user_role as accessed_by_role,
        al.action,
        al.resource_type,
        al.data_fields_accessed,
        al.created_at as accessed_at,
        al.ip_address,
        al.purpose
    FROM audit_logs al
    WHERE al.related_patient_id = p_patient_id
        AND (p_start_date IS NULL OR al.created_at >= p_start_date)
        AND (p_end_date IS NULL OR al.created_at <= p_end_date)
    ORDER BY al.created_at DESC;
END;
$$;


--
-- Name: FUNCTION get_patient_data_access_logs(p_patient_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_patient_data_access_logs(p_patient_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) IS 'Busca todos os acessos aos dados de um paciente (para atender direito de acesso LGPD)';


--
-- Name: get_patient_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_patient_stats(patient_uuid uuid) RETURNS TABLE(total_consultations bigint, completed_consultations bigint, total_duration bigint, total_transcriptions bigint, total_audio_files bigint, last_consultation_date timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(c.id)::BIGINT,
        COUNT(CASE WHEN c.status = 'COMPLETED' THEN 1 END)::BIGINT,
        COALESCE(SUM(c.duration), 0)::BIGINT,
        COUNT(t.id)::BIGINT,
        COUNT(af.id)::BIGINT,
        MAX(c.created_at)
    FROM patients p
    LEFT JOIN consultations c ON p.id = c.patient_id
    LEFT JOIN transcriptions t ON c.id = t.consultation_id
    LEFT JOIN audio_files af ON c.id = af.consultation_id
    WHERE p.id = patient_uuid
    GROUP BY p.id;
END;
$$;


--
-- Name: get_session_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_session_stats(session_uuid uuid) RETURNS TABLE(total_utterances bigint, doctor_utterances bigint, patient_utterances bigint, total_suggestions bigint, used_suggestions bigint, session_duration_seconds integer, avg_confidence numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(u.id)::BIGINT as total_utterances,
        COUNT(CASE WHEN u.speaker = 'doctor' THEN 1 END)::BIGINT as doctor_utterances,
        COUNT(CASE WHEN u.speaker = 'patient' THEN 1 END)::BIGINT as patient_utterances,
        COUNT(s.id)::BIGINT as total_suggestions,
        COUNT(CASE WHEN s.used = true THEN 1 END)::BIGINT as used_suggestions,
        EXTRACT(EPOCH FROM (cs.ended_at - cs.started_at))::INTEGER as session_duration_seconds,
        AVG(u.confidence) as avg_confidence
    FROM call_sessions cs
    LEFT JOIN utterances u ON cs.id = u.session_id
    LEFT JOIN suggestions s ON cs.id = s.session_id
    WHERE cs.id = session_uuid
    GROUP BY cs.id, cs.started_at, cs.ended_at;
END;
$$;


--
-- Name: get_user_audit_logs(uuid, timestamp with time zone, timestamp with time zone, character varying, character varying, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_audit_logs(p_user_id uuid, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_action character varying DEFAULT NULL::character varying, p_resource_type character varying DEFAULT NULL::character varying, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0) RETURNS TABLE(log_id uuid, action character varying, resource_type character varying, resource_id uuid, resource_description text, created_at timestamp with time zone, ip_address inet, success boolean, changes_summary text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id as log_id,
        al.action,
        al.resource_type,
        al.resource_id,
        al.resource_description,
        al.created_at,
        al.ip_address,
        al.success,
        al.changes_summary
    FROM audit_logs al
    WHERE al.user_id = p_user_id
        AND (p_start_date IS NULL OR al.created_at >= p_start_date)
        AND (p_end_date IS NULL OR al.created_at <= p_end_date)
        AND (p_action IS NULL OR al.action = p_action)
        AND (p_resource_type IS NULL OR al.resource_type = p_resource_type)
    ORDER BY al.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;


--
-- Name: FUNCTION get_user_audit_logs(p_user_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_action character varying, p_resource_type character varying, p_limit integer, p_offset integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_audit_logs(p_user_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_action character varying, p_resource_type character varying, p_limit integer, p_offset integer) IS 'Busca logs de auditoria de um usuário específico';


--
-- Name: log_audit(uuid, character varying, character varying, character varying, character varying, uuid, text, inet, text, character varying, character varying, character varying, character varying, character varying, character varying, text, text[], boolean, jsonb, jsonb, text, boolean, character varying, text, jsonb, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_audit(p_user_id uuid, p_user_email character varying, p_user_role character varying, p_action character varying, p_resource_type character varying, p_resource_id uuid DEFAULT NULL::uuid, p_resource_description text DEFAULT NULL::text, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text, p_session_id character varying DEFAULT NULL::character varying, p_request_id character varying DEFAULT NULL::character varying, p_endpoint character varying DEFAULT NULL::character varying, p_http_method character varying DEFAULT NULL::character varying, p_data_category character varying DEFAULT NULL::character varying, p_legal_basis character varying DEFAULT NULL::character varying, p_purpose text DEFAULT NULL::text, p_data_fields_accessed text[] DEFAULT NULL::text[], p_contains_sensitive_data boolean DEFAULT false, p_data_before jsonb DEFAULT NULL::jsonb, p_data_after jsonb DEFAULT NULL::jsonb, p_changes_summary text DEFAULT NULL::text, p_success boolean DEFAULT true, p_error_code character varying DEFAULT NULL::character varying, p_error_message text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb, p_related_patient_id uuid DEFAULT NULL::uuid, p_related_consultation_id uuid DEFAULT NULL::uuid, p_related_session_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO audit_logs (
        user_id, user_email, user_role,
        action, resource_type, resource_id, resource_description,
        ip_address, user_agent, session_id, request_id, endpoint, http_method,
        data_category, legal_basis, purpose, data_fields_accessed, contains_sensitive_data,
        data_before, data_after, changes_summary,
        success, error_code, error_message,
        metadata, related_patient_id, related_consultation_id, related_session_id
    ) VALUES (
        p_user_id, p_user_email, p_user_role,
        p_action, p_resource_type, p_resource_id, p_resource_description,
        p_ip_address, p_user_agent, p_session_id, p_request_id, p_endpoint, p_http_method,
        p_data_category, p_legal_basis, p_purpose, p_data_fields_accessed, p_contains_sensitive_data,
        p_data_before, p_data_after, p_changes_summary,
        p_success, p_error_code, p_error_message,
        p_metadata, p_related_patient_id, p_related_consultation_id, p_related_session_id
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;


--
-- Name: FUNCTION log_audit(p_user_id uuid, p_user_email character varying, p_user_role character varying, p_action character varying, p_resource_type character varying, p_resource_id uuid, p_resource_description text, p_ip_address inet, p_user_agent text, p_session_id character varying, p_request_id character varying, p_endpoint character varying, p_http_method character varying, p_data_category character varying, p_legal_basis character varying, p_purpose text, p_data_fields_accessed text[], p_contains_sensitive_data boolean, p_data_before jsonb, p_data_after jsonb, p_changes_summary text, p_success boolean, p_error_code character varying, p_error_message text, p_metadata jsonb, p_related_patient_id uuid, p_related_consultation_id uuid, p_related_session_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.log_audit(p_user_id uuid, p_user_email character varying, p_user_role character varying, p_action character varying, p_resource_type character varying, p_resource_id uuid, p_resource_description text, p_ip_address inet, p_user_agent text, p_session_id character varying, p_request_id character varying, p_endpoint character varying, p_http_method character varying, p_data_category character varying, p_legal_basis character varying, p_purpose text, p_data_fields_accessed text[], p_contains_sensitive_data boolean, p_data_before jsonb, p_data_after jsonb, p_changes_summary text, p_success boolean, p_error_code character varying, p_error_message text, p_metadata jsonb, p_related_patient_id uuid, p_related_consultation_id uuid, p_related_session_id uuid) IS 'Função para registrar eventos no log de auditoria';


--
-- Name: match_cid10_db(public.vector, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_cid10_db(query_embedding public.vector, match_count integer DEFAULT NULL::integer, filter jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
    LANGUAGE plpgsql
    AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (cid10_db.embedding <=> query_embedding) as similarity
  from cid10_db
  where metadata @> filter
  order by cid10_db.embedding <=> query_embedding
  limit match_count;
end;
$$;


--
-- Name: match_db_knowledge(public.vector, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_db_knowledge(query_embedding public.vector, match_count integer DEFAULT NULL::integer, filter jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
    LANGUAGE plpgsql
    AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (db_knowledge.embedding <=> query_embedding) as similarity
  from db_knowledge
  where metadata @> filter
  order by db_knowledge.embedding <=> query_embedding
  limit match_count;
end;
$$;


--
-- Name: match_documents(public.vector, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_documents(query_embedding public.vector, match_count integer DEFAULT 10, filter jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_db.id,
    knowledge_db.content,
    knowledge_db.metadata,
    1 - (knowledge_db.embedding <=> query_embedding) AS similarity
  FROM knowledge_db
  WHERE 
    knowledge_db.embedding IS NOT NULL
    AND (
      CASE 
        WHEN filter != '{}'::jsonb THEN knowledge_db.metadata @> filter
        ELSE TRUE
      END
    )
  ORDER BY knowledge_db.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


--
-- Name: match_documents_nutrition(public.vector, jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_documents_nutrition(query_embedding public.vector, filter jsonb DEFAULT '{}'::jsonb, match_count integer DEFAULT 5) RETURNS TABLE(id uuid, content text, metadata jsonb, similarity double precision)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.content,
    n.metadata,
    1 - (n.embedding <=> query_embedding) AS similarity
  FROM knlg_nutrition AS n
  WHERE
    (filter = '{}'::jsonb OR n.metadata @> filter)
  ORDER BY
    n.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


--
-- Name: match_kb_chunks(public.vector, double precision, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_kb_chunks(query_embedding public.vector, similarity_threshold double precision DEFAULT 0.5, match_count integer DEFAULT 5, filter_specialty text DEFAULT NULL::text, filter_category text DEFAULT NULL::text) RETURNS TABLE(id uuid, document_id uuid, content text, similarity double precision, title text, source text, section text, specialty text, category text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        kc.id,
        kc.document_id,
        kc.content,
        (1 - (kc.embedding <=> query_embedding)) as similarity,
        kd.title,
        kd.source,
        kd.section,
        kd.specialty,
        kd.category
    FROM kb_chunks kc
    JOIN kb_documents kd ON kc.document_id = kd.id
    WHERE 
        kd.is_active = true
        AND (1 - (kc.embedding <=> query_embedding)) > similarity_threshold
        AND (filter_specialty IS NULL OR kd.specialty = filter_specialty)
        AND (filter_category IS NULL OR kd.category = filter_category)
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


--
-- Name: match_knlg_mentalidade(public.vector, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_knlg_mentalidade(query_embedding public.vector, match_count integer DEFAULT NULL::integer, filter jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
    LANGUAGE plpgsql
    AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (knlg_mentalidade.embedding <=> query_embedding) as similarity
  from knlg_mentalidade
  where metadata @> filter
  order by knlg_mentalidade.embedding <=> query_embedding
  limit match_count;
end;
$$;


--
-- Name: match_knlg_naturologia(public.vector, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_knlg_naturologia(query_embedding public.vector, match_count integer DEFAULT NULL::integer, filter jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
    LANGUAGE plpgsql
    AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (knlg_naturologia.embedding <=> query_embedding) as similarity
  from knlg_naturologia
  where metadata @> filter
  order by knlg_naturologia.embedding <=> query_embedding
  limit match_count;
end;
$$;


--
-- Name: match_knlg_nutrition(public.vector, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_knlg_nutrition(query_embedding public.vector, match_count integer DEFAULT 5, filter jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(id uuid, content text, metadata jsonb, similarity double precision)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    knlg_nutrition.id,
    knlg_nutrition.content,
    knlg_nutrition.metadata,
    1 - (knlg_nutrition.embedding <=> query_embedding) as similarity
  FROM knlg_nutrition
  WHERE embedding IS NOT NULL
    AND (filter = '{}'::jsonb OR knlg_nutrition.metadata @> filter)
  ORDER BY knlg_nutrition.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


--
-- Name: match_knlg_nutritions(public.vector, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_knlg_nutritions(query_embedding public.vector, match_count integer DEFAULT NULL::integer, filter jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
    LANGUAGE plpgsql
    AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (knlg_nutritions.embedding <=> query_embedding) as similarity
  from knlg_nutritions
  where metadata @> filter
  order by knlg_nutritions.embedding <=> query_embedding
  limit match_count;
end;
$$;


--
-- Name: match_knlg_s_nutrition(public.vector, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_knlg_s_nutrition(query_embedding public.vector, match_count integer DEFAULT NULL::integer, filter jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
    LANGUAGE plpgsql
    AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (knlg_s_nutrition.embedding <=> query_embedding) as similarity
  from knlg_s_nutrition
  where metadata @> filter
  order by knlg_s_nutrition.embedding <=> query_embedding
  limit match_count;
end;
$$;


--
-- Name: match_knowledge_db(public.vector, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_knowledge_db(query_embedding public.vector, match_count integer DEFAULT NULL::integer, filter jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
    LANGUAGE plpgsql
    AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (knowledge_db.embedding <=> query_embedding) as similarity
  from knowledge_db
  where metadata @> filter
  order by knowledge_db.embedding <=> query_embedding
  limit match_count;
end;
$$;


--
-- Name: notify_agente1_finalizado(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_agente1_finalizado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  resp json;
BEGIN
  -- Dispara apenas quando status_final é TRUE no NEW
  IF TG_OP = 'INSERT' THEN
    IF NEW.status_final IS TRUE THEN
      resp := (
        SELECT content::json
        FROM http_post(
          'https://triahook.gst.dev.br/webhook/agentes-1-finalizados',
          json_build_object(
            'id', NEW.id,
            'consulta_id', NEW.consulta_id,
            'agente_1', NEW.agente_1,
            'agente_2', NEW.agente_2,
            'agente_3', NEW.agente_3,
            'status_final', NEW.status_final,
            'created_at', NEW.created_at
          )::text,
          'application/json'
        )
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Dispara quando mudou para TRUE (evita reenvio em updates irrelevantes)
    IF (OLD.status_final IS DISTINCT FROM NEW.status_final) AND NEW.status_final IS TRUE THEN
      resp := (
        SELECT content::json
        FROM http_post(
          'https://triahook.gst.dev.br/webhook/agentes-1-finalizados',
          json_build_object(
            'id', NEW.id,
            'consulta_id', NEW.consulta_id,
            'agente_1', NEW.agente_1,
            'agente_2', NEW.agente_2,
            'agente_3', NEW.agente_3,
            'status_final', NEW.status_final,
            'created_at', NEW.created_at
          )::text,
          'application/json'
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: sync_auth_user_email_to_medicos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_auth_user_email_to_medicos() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.medicos
      SET email = NEW.email,
          updated_at = now()
    WHERE user_auth = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: sync_auth_user_to_medicos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_auth_user_to_medicos() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_name text;
  v_role text;
  v_clinica_id uuid;
BEGIN
  -- Try to resolve a display name from auth metadata
  v_name := COALESCE(
    (NEW.raw_user_meta_data->>'name'),
    (NEW.raw_user_meta_data->>'full_name'),
    split_part(COALESCE(NEW.email, ''), '@', 1)
  );

  -- Get role from metadata (default to 'doctor' if null)
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'doctor');

  -- Logic for Clinic Registration
  IF v_role = 'clinic' THEN
    -- 1. Create entry in 'clinicas' table
    INSERT INTO public.clinicas (user_auth, nome, email, created_at)
    VALUES (NEW.id, v_name, NEW.email, now())
    RETURNING id INTO v_clinica_id;

    -- 2. Create entry in 'medicos' table LINKED to this clinic
    -- The clinic admin is also created as a doctor/user in 'medicos'
    INSERT INTO public.medicos (email, name, user_auth, clinica_id, is_doctor, clinica_admin)
    VALUES (NEW.email, v_name, NEW.id, v_clinica_id, true, true) -- Admin set to true
    ON CONFLICT (email) DO NOTHING;
    
  ELSE
    -- Logic for Independent Doctor (current logic)
    INSERT INTO public.medicos (email, name, user_auth, is_doctor)
    VALUES (NEW.email, v_name, NEW.id, true)
    ON CONFLICT (email) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: trigger_calculate_metrics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_calculate_metrics() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM calculate_patient_metrics(NEW.paciente_id);
  RETURN NEW;
END;
$$;


--
-- Name: update_anamnese_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_anamnese_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_pagamento_criado_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_pagamento_criado_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_recordings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_recordings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: a_ambiente_contexto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.a_ambiente_contexto (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    contexto_familiar_estado_civil text,
    contexto_familiar_filhos text,
    contexto_familiar_dinamica_familiar text,
    contexto_familiar_suporte_familiar text,
    contexto_familiar_relacionamento_conjugal text,
    contexto_familiar_divisao_tarefas_domesticas text,
    contexto_familiar_vida_sexual_ativa text,
    contexto_familiar_dialogo_sobre_sobrecarga text,
    contexto_profissional_area text,
    contexto_profissional_carga_horaria text,
    contexto_profissional_nivel_estresse text,
    contexto_profissional_satisfacao text,
    ambiente_fisico_sedentarismo text,
    ambiente_fisico_exposicao_sol text,
    ambiente_fisico_atividade_fisica_pratica text,
    ambiente_fisico_atividade_fisica_tipo text,
    ambiente_fisico_atividade_fisica_frequencia text,
    ambiente_fisico_atividade_fisica_intensidade text,
    ambiente_fisico_atividade_fisica_tem_acompanhamento_profissiona text,
    habitos_vida_sono text,
    habitos_vida_alimentacao text,
    habitos_vida_lazer text,
    habitos_vida_espiritualidade text,
    suporte_social_tem_rede_apoio text,
    suporte_social_participa_grupos_sociais text,
    suporte_social_tem_com_quem_desabafar text,
    fatores_estressores text,
    fatores_externos_saude text,
    user_id text,
    paciente_id text,
    consulta_id text,
    status boolean DEFAULT false,
    tipo_solicitacao text,
    input_edicao text,
    justificativa_edicao text
);


--
-- Name: a_ambiente_contexto_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.a_ambiente_contexto_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: a_ambiente_contexto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.a_ambiente_contexto_id_seq OWNED BY public.a_ambiente_contexto.id;


--
-- Name: a_cadastro_anamnese; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.a_cadastro_anamnese (
    paciente_id uuid NOT NULL,
    nome_completo text,
    cpf text,
    email text,
    genero text,
    data_nascimento text,
    estado_civil text,
    profissao text,
    altura text,
    peso_atual text,
    peso_antigo text,
    peso_desejado text,
    objetivo_principal text,
    patrica_atividade_fisica text,
    frequencia_deseja_treinar text,
    restricao_movimento text,
    informacoes_importantes text,
    created_at timestamp with time zone DEFAULT now(),
    "NecessidadeEnergeticaDiaria" text,
    proteinas jsonb[],
    carboidratos jsonb[],
    vegetais jsonb[],
    legumes jsonb[],
    leguminosas jsonb[],
    gorduras jsonb[],
    frutas jsonb[],
    status text,
    updated_at timestamp with time zone DEFAULT now(),
    idade text,
    tipo_saguineo text
);


--
-- Name: COLUMN a_cadastro_anamnese.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.a_cadastro_anamnese.status IS 'Status da anamnese: pendente (paciente precisa preencher), preenchida (já foi preenchida), ou NULL (não enviada)';


--
-- Name: a_cadastro_prontuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.a_cadastro_prontuario (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    identificacao_nome_completo text,
    identificacao_nome_social text,
    identificacao_data_nascimento text,
    identificacao_idade_atual text,
    identificacao_sexo_biologico text,
    identificacao_genero text,
    identificacao_naturalidade text,
    identificacao_nacionalidade text,
    dados_sociodemograficos_estado_civil text,
    dados_sociodemograficos_numero_filhos text,
    dados_sociodemograficos_idade_filhos text,
    dados_sociodemograficos_escolaridade text,
    dados_sociodemograficos_profissao text,
    dados_sociodemograficos_exerce_profissao text,
    dados_sociodemograficos_situacao_trabalho text,
    dados_sociodemograficos_carga_horaria_trabalho text,
    dados_sociodemograficos_condicao_social text,
    dados_sociodemograficos_renda_familiar text,
    dados_sociodemograficos_pessoas_residencia text,
    dados_sociodemograficos_responsavel_financeiro text,
    dados_sociodemograficos_seguro_saude text,
    doc_cpf text,
    doc_rg text,
    doc_cns text,
    endereco_logradouro text,
    endereco_numero text,
    endereco_complemento text,
    endereco_bairro text,
    endereco_cidade text,
    endereco_estado text,
    endereco_cep text,
    telefone_celular text,
    telefone_residencial text,
    telefone_recado text,
    email text,
    user_id text,
    paciente_id text,
    consulta_id text,
    status boolean DEFAULT false,
    input_edicao text,
    tipo_solicitacao text,
    justificativa_edicao text
);


--
-- Name: a_cadastro_prontuario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.a_cadastro_prontuario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: a_cadastro_prontuario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.a_cadastro_prontuario_id_seq OWNED BY public.a_cadastro_prontuario.id;


--
-- Name: a_historia_vida; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.a_historia_vida (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    narrativa_sintese text,
    eventos_vida_marcantes text,
    episodios_estresse_extremo_trauma text,
    trilha_do_conflito_concepcao_gestacao text,
    trilha_do_conflito_0_7_anos text,
    trilha_do_conflito_7_14_anos text,
    trilha_do_conflito_14_21_anos text,
    trilha_do_conflito_21_28_anos text,
    trilha_do_conflito_28_mais_anos text,
    pontos_traumaticos text,
    padroes_repetitivos text,
    saude_mae_gestacao text,
    tracos_comportamentos_repetitivos_ao_longo_vida text,
    experiencia_considera_virada text,
    identifica_com_superacao_ou_defesa text,
    conexao_identidade_proposito text,
    algo_infancia_lembra_com_emocao_intensa text,
    user_id text,
    paciente_id text,
    consulta_id text,
    status boolean DEFAULT false,
    tipo_solicitacao text,
    input_edicao text,
    justificativa_edicao text
);


--
-- Name: a_historia_vida_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.a_historia_vida_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: a_historia_vida_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.a_historia_vida_id_seq OWNED BY public.a_historia_vida.id;


--
-- Name: a_historico_risco; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.a_historico_risco (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    doencas_atuais_confirmadas text,
    doencas_infancia_adolescencia text,
    antecedentes_familiares_pai text,
    antecedentes_familiares_mae text,
    antecedentes_familiares_irmaos text,
    antecedentes_familiares_avos_paternos text,
    antecedentes_familiares_avos_maternos text,
    antecedentes_familiares_causas_morte_avos text,
    condicoes_geneticas_conhecidas text,
    cirurgias_procedimentos text,
    medicacoes_atuais text,
    medicacoes_continuas text,
    ja_usou_corticoides text,
    alergias_intolerancias_conhecidas text,
    alergias_intolerancias_suspeitas text,
    exposicao_toxica text,
    historico_peso_variacao_ao_longo_vida text,
    historico_peso_peso_maximo_atingido text,
    historico_peso_peso_minimo_atingido text,
    tentativas_tratamento_anteriores text,
    user_id text,
    paciente_id text,
    consulta_id text,
    status boolean DEFAULT false,
    tipo_solicitacao text,
    input_edicao text,
    justificativa_edicao text
);


--
-- Name: a_historico_risco_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.a_historico_risco_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: a_historico_risco_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.a_historico_risco_id_seq OWNED BY public.a_historico_risco.id;


--
-- Name: a_objetivos_queixas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.a_objetivos_queixas (
    user_id uuid,
    paciente_id uuid NOT NULL,
    consulta_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    saude_geral_percebida_como_descreve_saude text,
    saude_geral_percebida_como_define_bem_estar text,
    saude_geral_percebida_avaliacao_saude_emocional_mental text,
    queixa_principal text,
    sub_queixas text,
    tempo_evolucao_inicio text,
    tempo_evolucao_progressao text,
    tempo_evolucao_evento_desencadeador text,
    impacto_queixas_vida_como_afeta_vida_diaria text,
    impacto_queixas_vida_limitacoes_causadas text,
    impacto_queixas_vida_areas_impactadas text,
    problemas_deseja_resolver text,
    diagnosticos_previos text,
    medicacoes_atuais text,
    tratamentos_anteriores_ja_buscou_tratamentos_similares text,
    tratamentos_anteriores_quais_tratamentos_anteriores text,
    expectativas_tratamento_expectativa_especifica text,
    expectativas_tratamento_duvidas_principais text,
    compreensao_sobre_causa_compreensao_paciente text,
    compreensao_sobre_causa_fatores_externos_influenciando text,
    projeto_de_vida_corporal text,
    projeto_de_vida_espiritual text,
    projeto_de_vida_familiar text,
    projeto_de_vida_profissional text,
    projeto_de_vida_sonhos text,
    nivel_motivacao text,
    prontidao_para_mudanca text,
    mudancas_considera_necessarias text,
    id bigint NOT NULL,
    status boolean DEFAULT false,
    tipo_solicitacao text,
    input_edicao text,
    justificativa_edicao text
);


--
-- Name: a_objetivos_queixas_id_int_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.a_objetivos_queixas_id_int_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: a_objetivos_queixas_id_int_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.a_objetivos_queixas_id_int_seq OWNED BY public.a_objetivos_queixas.id;


--
-- Name: a_observacao_clinica_lab; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.a_observacao_clinica_lab (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    quando_sintomas_comecaram text,
    ha_algum_padrao_temporal text,
    eventos_que_agravaram text,
    intensidade_dor_desconforto text,
    nivel_energia_diaria text,
    sistema_gastrointestinal_intestino text,
    sistema_gastrointestinal_habito_intestinal text,
    sistema_gastrointestinal_disbiose text,
    sistema_gastrointestinal_lingua text,
    sistema_gastrointestinal_digestao text,
    sistema_gastrointestinal_gases text,
    sistema_gastrointestinal_suspeita_disbiose text,
    sistema_musculoesqueletico_dores text,
    sistema_musculoesqueletico_localizacao text,
    sistema_musculoesqueletico_postura text,
    sistema_musculoesqueletico_tono_muscular text,
    sistema_musculoesqueletico_mobilidade text,
    pele_faneros_pele text,
    pele_faneros_cabelo text,
    pele_faneros_unhas text,
    pele_faneros_hidratacao text,
    pele_faneros_ingestao_agua_ml_dia text,
    sistema_neurologico_mental_memoria text,
    sistema_neurologico_mental_concentracao text,
    sistema_neurologico_mental_sono_qualidade text,
    sistema_neurologico_mental_sono_latencia text,
    sistema_neurologico_mental_sono_manutencao text,
    sistema_neurologico_mental_sono_profundidade text,
    sistema_neurologico_mental_sono_duracao_horas text,
    sistema_neurologico_mental_sono_despertar text,
    sistema_neurologico_mental_sono_acorda_quantas_vezes text,
    sistema_neurologico_mental_sono_acorda_para_urinar text,
    sistema_neurologico_mental_energia text,
    sistema_endocrino_tireoide_tsh text,
    sistema_endocrino_tireoide_anti_tpo text,
    sistema_endocrino_tireoide_t3_livre text,
    sistema_endocrino_tireoide_t4_livre text,
    sistema_endocrino_tireoide_suspeita text,
    sistema_endocrino_insulina_valor text,
    sistema_endocrino_insulina_glicemia text,
    sistema_endocrino_insulina_hemoglobina_glicada text,
    sistema_endocrino_insulina_homa_ir text,
    sistema_endocrino_insulina_diagnostico text,
    sistema_endocrino_cortisol text,
    sistema_endocrino_hormonios_sexuais_estrogeno text,
    sistema_endocrino_hormonios_sexuais_progesterona text,
    sistema_endocrino_hormonios_sexuais_testosterona text,
    sistema_endocrino_hormonios_sexuais_impacto text,
    medidas_antropometricas_peso_atual text,
    medidas_antropometricas_altura text,
    medidas_antropometricas_imc text,
    medidas_antropometricas_circunferencias_cintura text,
    medidas_antropometricas_circunferencias_quadril text,
    medidas_antropometricas_circunferencias_pescoco text,
    medidas_antropometricas_relacao_cintura_quadril text,
    medidas_antropometricas_bioimpedancia_gordura_percentual text,
    medidas_antropometricas_bioimpedancia_massa_muscular text,
    medidas_antropometricas_bioimpedancia_agua_corporal text,
    medidas_antropometricas_bioimpedancia_gordura_visceral text,
    medidas_antropometricas_gordura_visceral text,
    medidas_antropometricas_esteatose_hepatica text,
    medidas_antropometricas_pressao_arterial text,
    sinais_vitais_relatados_disposicao_ao_acordar text,
    sinais_vitais_relatados_disposicao_ao_longo_dia text,
    sinais_vitais_relatados_libido text,
    sinais_vitais_relatados_regulacao_termica text,
    habitos_alimentares_recordatorio_24h text,
    habitos_alimentares_frequencia_ultraprocessados text,
    habitos_alimentares_horarios_refeicoes text,
    habitos_alimentares_come_assistindo_tv_trabalhando text,
    user_id text,
    paciente_id text,
    consulta_id text,
    sistema_neurologico_mental_consiencia text,
    status boolean DEFAULT false,
    links_exames text[],
    tipo_solicitacao text,
    input_edicao text,
    justificativa_edicao text
);


--
-- Name: a_observacao_clinica_lab_2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.a_observacao_clinica_lab_2 (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    quando_sintomas_comecaram text,
    ha_algum_padrao_temporal text,
    eventos_que_agravaram text,
    intensidade_dor_desconforto text,
    nivel_energia_diaria text,
    sistema_gastrointestinal_intestino text,
    sistema_gastrointestinal_habito_intestinal text,
    sistema_gastrointestinal_disbiose text,
    sistema_gastrointestinal_lingua text,
    sistema_gastrointestinal_digestao text,
    sistema_gastrointestinal_gases text,
    sistema_gastrointestinal_suspeita_disbiose text,
    sistema_gastrointestinal_calprotectina text,
    sistema_gastrointestinal_lactoferrina text,
    sistema_gastrointestinal_gastrina text,
    sistema_musculoesqueletico_dores text,
    sistema_musculoesqueletico_localizacao text,
    sistema_musculoesqueletico_postura text,
    sistema_musculoesqueletico_tono_muscular text,
    sistema_musculoesqueletico_mobilidade text,
    pele_faneros_pele text,
    pele_faneros_cabelo text,
    pele_faneros_unhas text,
    pele_faneros_hidratacao text,
    pele_faneros_ingestao_agua_ml_dia text,
    sistema_neurologico_mental_memoria text,
    sistema_neurologico_mental_concentracao text,
    sistema_neurologico_mental_consiencia text,
    sistema_neurologico_mental_energia text,
    sistema_neurologico_mental_sono_qualidade text,
    sistema_neurologico_mental_sono_latencia text,
    sistema_neurologico_mental_sono_manutencao text,
    sistema_neurologico_mental_sono_profundidade text,
    sistema_neurologico_mental_sono_duracao_horas text,
    sistema_neurologico_mental_sono_despertar text,
    sistema_neurologico_mental_sono_acorda_quantas_vezes text,
    sistema_neurologico_mental_sono_acorda_para_urinar text,
    sistema_neurologico_mental_marcadores_cerebrais_beta_amiloide_t text,
    sistema_neurologico_mental_marcadores_cerebrais_apolipoproteina text,
    sistema_neurologico_mental_marcadores_cerebrais_s100b text,
    sistema_neurologico_mental_marcadores_cerebrais_neurofilamento_ text,
    sistema_endocrino_tireoide_tsh text,
    sistema_endocrino_tireoide_anti_tpo text,
    sistema_endocrino_tireoide_t3_livre text,
    sistema_endocrino_tireoide_t4_livre text,
    sistema_endocrino_tireoide_suspeita text,
    sistema_endocrino_tireoide_anti_tg text,
    sistema_endocrino_tireoide_t3_reverso text,
    sistema_endocrino_tireoide_relacao_t3_t4 text,
    sistema_endocrino_tireoide_tireoglobulina text,
    sistema_endocrino_tireoide_calcitonina text,
    sistema_endocrino_tireoide_iodo_urinario text,
    sistema_endocrino_insulina_valor text,
    sistema_endocrino_insulina_glicemia text,
    sistema_endocrino_insulina_hemoglobina_glicada text,
    sistema_endocrino_insulina_homa_ir text,
    sistema_endocrino_insulina_diagnostico text,
    sistema_endocrino_insulina_peptideo_c text,
    sistema_endocrino_cortisol text,
    sistema_endocrino_cortisol_serico_acordar text,
    sistema_endocrino_cortisol_salivar_total text,
    sistema_endocrino_cortisol_salivar_despertar text,
    sistema_endocrino_cortisol_salivar_tarde text,
    sistema_endocrino_cortisol_salivar_noite text,
    sistema_endocrino_cortisol_observacao text,
    sistema_endocrino_hormonios_sexuais_estrogeno text,
    sistema_endocrino_hormonios_sexuais_progesterona text,
    sistema_endocrino_hormonios_sexuais_testosterona text,
    sistema_endocrino_hormonios_sexuais_impacto text,
    sistema_endocrino_hormonios_sexuais_estradiol text,
    sistema_endocrino_hormonios_sexuais_estradiol_livre text,
    sistema_endocrino_hormonios_sexuais_estriol text,
    sistema_endocrino_hormonios_sexuais_pregnenolona text,
    sistema_endocrino_hormonios_sexuais_testosterona_total text,
    sistema_endocrino_hormonios_sexuais_testosterona_livre text,
    sistema_endocrino_hormonios_sexuais_dhea text,
    sistema_endocrino_hormonios_sexuais_androstenediona text,
    sistema_endocrino_hormonios_sexuais_shbg text,
    sistema_endocrino_hormonios_sexuais_lh text,
    sistema_endocrino_hormonios_sexuais_fsh text,
    sistema_endocrino_hormonios_sexuais_prolactina text,
    sistema_endocrino_outros_hormonios_leptina text,
    sistema_endocrino_outros_hormonios_adiponectina text,
    sistema_endocrino_outros_hormonios_somatomedina_c text,
    sistema_endocrino_outros_hormonios_adh_vasopressina text,
    sistema_endocrino_outros_hormonios_aldosterona text,
    sistema_endocrino_outros_hormonios_renina text,
    sistema_endocrino_outros_hormonios_angiotensina_ii text,
    medidas_antropometricas_peso_atual text,
    medidas_antropometricas_altura text,
    medidas_antropometricas_imc text,
    medidas_antropometricas_classificacao_imc text,
    medidas_antropometricas_circunferencias_cintura text,
    medidas_antropometricas_circunferencias_quadril text,
    medidas_antropometricas_circunferencias_pescoco text,
    medidas_antropometricas_relacao_cintura_quadril text,
    medidas_antropometricas_interpretacao_rcq text,
    medidas_antropometricas_bioimpedancia_gordura_percentual text,
    medidas_antropometricas_bioimpedancia_massa_muscular text,
    medidas_antropometricas_bioimpedancia_agua_corporal text,
    medidas_antropometricas_bioimpedancia_gordura_visceral text,
    medidas_antropometricas_gordura_visceral text,
    medidas_antropometricas_esteatose_hepatica text,
    medidas_antropometricas_pressao_arterial text,
    sinais_vitais_relatados_disposicao_ao_acordar text,
    sinais_vitais_relatados_disposicao_ao_longo_dia text,
    sinais_vitais_relatados_libido text,
    sinais_vitais_relatados_regulacao_termica text,
    habitos_alimentares_recordatorio_24h text,
    habitos_alimentares_frequencia_ultraprocessados text,
    habitos_alimentares_horarios_refeicoes text,
    habitos_alimentares_come_assistindo_tv_trabalhando text,
    avaliacao_hematologica_hemacias text,
    avaliacao_hematologica_hemoglobina text,
    avaliacao_hematologica_hematocrito text,
    avaliacao_hematologica_relacao_ht_hg text,
    avaliacao_hematologica_vcm text,
    avaliacao_hematologica_hcm text,
    avaliacao_hematologica_chcm text,
    avaliacao_hematologica_rdw text,
    avaliacao_hematologica_plaquetas text,
    avaliacao_hematologica_leucocitos text,
    avaliacao_hematologica_neutrofilos text,
    avaliacao_hematologica_neutrofilos_bastonete text,
    avaliacao_hematologica_linfocitos text,
    avaliacao_hematologica_relacao_neutrofilos_linfocitos text,
    avaliacao_hematologica_eosinofilos text,
    avaliacao_hematologica_monocitos text,
    avaliacao_hematologica_basofilos text,
    hematologia_especifica_homocisteina text,
    hematologia_especifica_ferro_serico text,
    hematologia_especifica_ferritina text,
    hematologia_especifica_saturacao_transferrina text,
    hematologia_especifica_transferrina_livre text,
    hematologia_especifica_tibc text,
    hematologia_especifica_ttpa text,
    hematologia_especifica_fibrinogenio text,
    hematologia_especifica_tfg text,
    hematologia_especifica_cistatina_c text,
    perfil_lipidico_colesterol_total text,
    perfil_lipidico_ldl text,
    perfil_lipidico_ldl_oxidado text,
    perfil_lipidico_hdl text,
    perfil_lipidico_vldl text,
    perfil_lipidico_triglicerides text,
    perfil_lipidico_relacao_tg_hdl text,
    perfil_lipidico_relacao_ldl_hdl text,
    perfil_lipidico_relacao_ct_hdl text,
    perfil_lipidico_apo_a1 text,
    perfil_lipidico_apo_b text,
    perfil_lipidico_relacao_apob_apoa1 text,
    perfil_lipidico_lipoproteina_a text,
    avaliacao_hepatica_tgo text,
    avaliacao_hepatica_tgp text,
    avaliacao_hepatica_relacao_tgo_tgp text,
    avaliacao_hepatica_gama_gt text,
    avaliacao_hepatica_bilirrubina_direta text,
    avaliacao_hepatica_bilirrubina_indireta text,
    avaliacao_hepatica_bilirrubina_total text,
    avaliacao_hepatica_fosfatase_alcalina text,
    avaliacao_hepatica_ldh text,
    avaliacao_hepatica_albumina text,
    avaliacao_hepatica_pre_albumina text,
    avaliacao_hepatica_amilase text,
    avaliacao_hepatica_lipase text,
    avaliacao_hepatica_aldalose text,
    marcadores_inflamatorios_pcr text,
    marcadores_inflamatorios_pcr_ultrassensivel text,
    marcadores_inflamatorios_procalcitonina text,
    avaliacao_nutricional_vitamina_a text,
    avaliacao_nutricional_vitamina_b1 text,
    avaliacao_nutricional_vitamina_b2 text,
    avaliacao_nutricional_vitamina_b3 text,
    avaliacao_nutricional_vitamina_b5 text,
    avaliacao_nutricional_vitamina_b6 text,
    avaliacao_nutricional_vitamina_b7 text,
    avaliacao_nutricional_vitamina_b9 text,
    avaliacao_nutricional_vitamina_b12 text,
    avaliacao_nutricional_acido_metilmalonico text,
    avaliacao_nutricional_vitamina_c text,
    avaliacao_nutricional_caroteno_serico text,
    avaliacao_nutricional_vitamina_d_25oh text,
    avaliacao_nutricional_vitamina_d_1_25oh text,
    avaliacao_nutricional_relacao_25_1_25 text,
    avaliacao_nutricional_pth text,
    avaliacao_nutricional_calcio_ionico text,
    avaliacao_nutricional_calcio_serico text,
    avaliacao_nutricional_calcio_urina text,
    avaliacao_nutricional_relacao_calcio_creatinina text,
    avaliacao_nutricional_magnesio text,
    avaliacao_nutricional_zinco_serico text,
    avaliacao_nutricional_zinco_hemacias text,
    avaliacao_nutricional_zinco_sangue text,
    avaliacao_nutricional_selenio text,
    avaliacao_nutricional_cobre_serico text,
    avaliacao_nutricional_cobre_hemacias text,
    avaliacao_nutricional_ceruplasmina text,
    avaliacao_nutricional_manganes text,
    avaliacao_nutricional_cromo_sangue text,
    avaliacao_nutricional_cromo_urina text,
    avaliacao_nutricional_potassio text,
    avaliacao_nutricional_sodio text,
    avaliacao_metais_pesados_chumbo_urina text,
    avaliacao_metais_pesados_chumbo_sangue text,
    avaliacao_metais_pesados_relacao_chumbo_u_s text,
    avaliacao_metais_pesados_mercurio_urina text,
    avaliacao_metais_pesados_mercurio_sangue text,
    avaliacao_metais_pesados_relacao_mercurio_u_s text,
    avaliacao_metais_pesados_cadmio_urina text,
    avaliacao_metais_pesados_cadmio_sangue text,
    avaliacao_metais_pesados_relacao_cadmio_u_s text,
    avaliacao_metais_pesados_aluminio_urina text,
    avaliacao_metais_pesados_aluminio_soro text,
    avaliacao_metais_pesados_relacao_aluminio_u_s text,
    avaliacao_metais_pesados_arsenico_urina text,
    avaliacao_metais_pesados_arsenico_sangue text,
    avaliacao_metais_pesados_relacao_arsenico_u_s text,
    avaliacao_metais_pesados_fluor_urina text,
    avaliacao_metais_pesados_niquel_urina text,
    avaliacao_metais_pesados_niquel_sangue text,
    avaliacao_metais_pesados_relacao_niquel_u_s text,
    avaliacao_renal_creatinina text,
    avaliacao_renal_ureia text,
    avaliacao_renal_acido_urico text,
    avaliacao_renal_densidade_urinaria text,
    avaliacao_renal_ph_urinario text,
    avaliacao_microbiota_indice_simpson text,
    avaliacao_microbiota_indicador_riqueza text,
    avaliacao_microbiota_razao_firmicutes_bacteroidetes text,
    avaliacao_microbiota_indice_firmicutes_bacteroidetes text,
    avaliacao_microbiota_perfil_agcc text,
    avaliacao_microbiota_perfil_metaboloma_fecal text,
    avaliacao_microbiota_analise_rna_ribossomico text,
    avaliacao_microbiota_indol_escatol text,
    avaliacao_cardiaca_d_dimero text,
    avaliacao_cardiaca_troponina_i text,
    avaliacao_cardiaca_troponina_t text,
    avaliacao_cardiaca_ck_mb text,
    avaliacao_cardiaca_mioglobina text,
    marcadores_tumorais_observacao text,
    marcadores_tumorais_alfafetoproteina text,
    marcadores_tumorais_nse text,
    marcadores_tumorais_nmp22 text,
    marcadores_tumorais_psa text,
    marcadores_tumorais_her2 text,
    marcadores_tumorais_ca_15_3 text,
    marcadores_tumorais_ca_19_9 text,
    marcadores_tumorais_cea text,
    marcadores_tumorais_ca_125 text,
    marcadores_tumorais_beta_hcg text,
    marcadores_tumorais_cromogranina_a text,
    marcadores_tumorais_pd_l1 text,
    marcadores_tumorais_proteina_s100 text,
    marcadores_tumorais_alfa_enolase text,
    marcadores_tumorais_fosfatase_acida_prostatica text,
    marcadores_tumorais_beta_2_microglobulina text,
    avaliacao_intestinal_asca text,
    avaliacao_intestinal_anca text,
    exames_imagem_realizados_ultrassom_abdominal_realizado text,
    exames_imagem_realizados_ultrassom_abdominal_achados text,
    exames_prioritarios_solicitar text,
    user_id text,
    paciente_id text,
    consulta_id text,
    status boolean DEFAULT false,
    links_exames text[],
    tipo_solicitacao text,
    input_edicao text,
    justificativa_edicao text
);


--
-- Name: a_observacao_clinica_lab_2_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.a_observacao_clinica_lab_2_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: a_observacao_clinica_lab_2_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.a_observacao_clinica_lab_2_id_seq OWNED BY public.a_observacao_clinica_lab_2.id;


--
-- Name: a_observacao_clinica_lab_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.a_observacao_clinica_lab_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: a_observacao_clinica_lab_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.a_observacao_clinica_lab_id_seq OWNED BY public.a_observacao_clinica_lab.id;


--
-- Name: a_preocupacoes_crencas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.a_preocupacoes_crencas (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    como_percebe_problema text,
    compreensao_sobre_causa_sintomas text,
    crencas_limitantes text,
    preocupacoes_explicitas text,
    preocupacoes_implicitas text,
    ganhos_secundarios text,
    resistencias_possiveis text,
    condicoes_geneticas_familia text,
    expectativas_irrealistas text,
    nivel_insight_autoconsciencia text,
    abertura_para_mudanca text,
    barreiras_percebidas_tratamento text,
    aspectos_plano_parecem_desafiadores text,
    user_id text,
    paciente_id text,
    consulta_id text,
    status boolean DEFAULT false,
    tipo_solicitacao text,
    input_edicao text,
    justificativa_edicao text
);


--
-- Name: a_preocupacoes_crencas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.a_preocupacoes_crencas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: a_preocupacoes_crencas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.a_preocupacoes_crencas_id_seq OWNED BY public.a_preocupacoes_crencas.id;


--
-- Name: a_reino_miasma; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.a_reino_miasma (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    reino_predominante text,
    caracteristicas_identificadas text,
    analise_detalhada_reino_animal_palavras_usadas text,
    analise_detalhada_reino_animal_descreve_sensacoes_como text,
    implicacoes_terapeuticas_comunicacao text,
    implicacoes_terapeuticas_abordagem text,
    implicacoes_terapeuticas_outras_terapias_alinhadas text,
    padrao_discurso text,
    user_id text,
    paciente_id text,
    consulta_id text,
    status boolean DEFAULT false,
    tipo_solicitacao text,
    input_edicao text,
    justificativa_edicao text,
    analise_miasma_energia character varying(255),
    analise_miasma_luta text,
    justificativa_reino text,
    miasma_principal text,
    justificativa_miasma text
);


--
-- Name: a_reino_miasma_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.a_reino_miasma_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: a_reino_miasma_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.a_reino_miasma_id_seq OWNED BY public.a_reino_miasma.id;


--
-- Name: a_sensacao_emocoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.a_sensacao_emocoes (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    emocoes_predominantes text,
    sensacoes_corporais text,
    palavras_chave_emocionais text,
    intensidade_emocional text,
    consegue_identificar_gatilhos_emocionais text,
    gatilhos_identificados text,
    regulacao_emocional_capacidade_regulacao text,
    regulacao_emocional_forma_expressao text,
    regulacao_emocional_como_gerencia_estresse_ansiedade text,
    memoria_afetiva text,
    sensacoes_especificas_reino_usa_palavras_como text,
    sensacoes_especificas_reino_descreve_sensacoes_como text,
    sensacoes_especificas_reino_padroes_discurso text,
    conexao_corpo_mente_percebe_manifestacoes_corporais_emocoes text,
    conexao_corpo_mente_exemplos text,
    user_id text,
    paciente_id text,
    consulta_id text,
    status boolean DEFAULT false,
    tipo_solicitacao text,
    input_edicao text,
    justificativa_edicao text
);


--
-- Name: a_sensacao_emocoes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.a_sensacao_emocoes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: a_sensacao_emocoes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.a_sensacao_emocoes_id_seq OWNED BY public.a_sensacao_emocoes.id;


--
-- Name: a_setenios_eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.a_setenios_eventos (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    concepcao_gestacao_planejamento text,
    concepcao_gestacao_ambiente_gestacional text,
    concepcao_gestacao_saude_mae_gestacao text,
    concepcao_gestacao_parto text,
    concepcao_gestacao_houve_trauma_parto text,
    concepcao_gestacao_foi_desejada_planejada text,
    concepcao_gestacao_impacto text,
    primeiro_setenio_0_7_ambiente text,
    primeiro_setenio_0_7_figuras_parentais_pai text,
    primeiro_setenio_0_7_figuras_parentais_mae text,
    primeiro_setenio_0_7_aprendizados text,
    primeiro_setenio_0_7_trauma_central text,
    segundo_setenio_7_14_eventos text,
    segundo_setenio_7_14_desenvolvimento text,
    segundo_setenio_7_14_corpo_fisico text,
    segundo_setenio_7_14_impacto text,
    terceiro_setenio_14_21_escolhas text,
    terceiro_setenio_14_21_motivacao text,
    terceiro_setenio_14_21_cumeeira_da_casa text,
    quarto_setenio_21_28_eventos_significativos text,
    quarto_setenio_21_28_formacao_profissional text,
    decenios_28_40_mais_climaterio_menopausa text,
    decenios_28_40_mais_pausas_hormonais text,
    decenios_28_40_mais_acumulacao text,
    decenios_28_40_mais_estado_atual text,
    decenios_28_40_mais_episodios_estresse_extremo text,
    eventos_criticos_identificados text,
    experiencia_considera_virada text,
    diferencas_sazonais_climaticas_sintomas text,
    user_id text,
    paciente_id text,
    consulta_id text,
    status boolean DEFAULT false,
    tipo_solicitacao text,
    input_edicao text,
    justificativa_edicao text
);


--
-- Name: a_setenios_eventos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.a_setenios_eventos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: a_setenios_eventos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.a_setenios_eventos_id_seq OWNED BY public.a_setenios_eventos.id;


--
-- Name: a_sintese_analitica; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.a_sintese_analitica (
    id bigint NOT NULL,
    user_id uuid,
    paciente_id uuid NOT NULL,
    consulta_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    status boolean DEFAULT false,
    sintese text,
    tres_linhas text,
    eixo_causal_principal text,
    perpetuadores text,
    achados_criticos_urgentes text,
    achados_criticos_importantes text,
    psicoemocional text,
    intervencao_imediata text,
    proximas_etapas text,
    exames_faltantes text,
    encaminhar text,
    pontos_atencao text,
    prognostico text,
    complexidade text,
    urgencia text,
    prontidao_mudanca text,
    confiabilidade text,
    campos_analisados integer,
    campos_com_dados integer
);


--
-- Name: a_sintese_analitica_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.a_sintese_analitica_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: a_sintese_analitica_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.a_sintese_analitica_id_seq OWNED BY public.a_sintese_analitica.id;


--
-- Name: ai_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_pricing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    consulta_id text,
    "LLM" text,
    token real,
    price real,
    tester boolean,
    etapa text,
    in_tokens_ia integer,
    out_tokens_ia integer,
    cached_tokens_ia integer,
    tokens_text_in integer,
    tokens_audio_in integer,
    tokens_text_out integer,
    tokens_audio_out integer,
    token_transcription integer,
    response_done jsonb,
    input_audio_transcription_completed jsonb,
    transcricao_da_frase text,
    payload jsonb
);


--
-- Name: alimentos_nutricionais; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alimentos_nutricionais (
    table_id bigint NOT NULL,
    nome text,
    umidade_pct text,
    energia_kcal text,
    energia_kj text,
    proteina_g text,
    lipideos_g text,
    colesterol_mg text,
    carboidrato_g text,
    fibra_alimentar_g text,
    cinzas_g text,
    calcio_mg text,
    magnesio_mg text,
    manganes_mg text,
    fosforo_mg text,
    ferro_mg text,
    sodio_mg text,
    potassio_mg text,
    cobre_mg text,
    zinco_mg text,
    retinol_mcg text,
    re_mcg text,
    rae_mcg text,
    tiamina_mg text,
    riboflavina_mg text,
    piridoxina_mg text,
    niacina_mg text,
    vitamina_c_mg text,
    id text,
    categoria text
);


--
-- Name: alimentos_nutricionais_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.alimentos_nutricionais_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: alimentos_nutricionais_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.alimentos_nutricionais_id_seq OWNED BY public.alimentos_nutricionais.table_id;


--
-- Name: alimentos_nutricionais_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.alimentos_nutricionais ALTER COLUMN table_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.alimentos_nutricionais_id_seq1
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: assinaturas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assinaturas (
    id bigint NOT NULL,
    doctor_id uuid NOT NULL,
    event text,
    customer_id text,
    value numeric,
    subscription_id text,
    cycle text,
    created_at timestamp with time zone DEFAULT now(),
    assinatura_ativa boolean DEFAULT false,
    env text,
    email text
);


--
-- Name: assinaturas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.assinaturas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.assinaturas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    user_email character varying(255),
    user_role character varying(50),
    user_name character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resource_type character varying(100),
    resource_id uuid,
    resource_description text,
    action character varying(50) NOT NULL,
    ip_address inet,
    user_agent text,
    session_id character varying(255),
    request_id character varying(255),
    endpoint character varying(500),
    http_method character varying(10),
    data_category character varying(100),
    legal_basis character varying(100),
    purpose text,
    data_fields_accessed text[],
    contains_sensitive_data boolean DEFAULT false,
    data_before jsonb,
    data_after jsonb,
    changes_summary text,
    success boolean DEFAULT true,
    error_code character varying(50),
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    related_patient_id uuid,
    related_consultation_id uuid,
    related_session_id uuid,
    table_ref text,
    medico_solicitation text,
    CONSTRAINT audit_logs_action_check CHECK (((action)::text = ANY ((ARRAY['CREATE'::character varying, 'READ'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying, 'EXPORT'::character varying, 'DOWNLOAD'::character varying, 'UPLOAD'::character varying, 'LOGIN'::character varying, 'LOGOUT'::character varying, 'LOGIN_FAILED'::character varying, 'PASSWORD_CHANGE'::character varying, 'PERMISSION_CHANGE'::character varying, 'SHARE'::character varying, 'CONSENT_GRANTED'::character varying, 'CONSENT_REVOKED'::character varying, 'DATA_REQUEST'::character varying, 'DATA_PORTABILITY'::character varying, 'DATA_ERASURE'::character varying, 'ANONYMIZATION'::character varying, 'ACCESS_DENIED'::character varying, 'BULK_OPERATION'::character varying, 'SYSTEM_ACTION'::character varying])::text[])))
);


--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_logs IS 'Logs de auditoria detalhados para compliance LGPD - registra todos os acessos e modificações de dados';


--
-- Name: COLUMN audit_logs.resource_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.resource_type IS 'Tipo do recurso acessado (patients, consultations, transcriptions, etc.)';


--
-- Name: COLUMN audit_logs.action; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.action IS 'Tipo de operação realizada (CREATE, READ, UPDATE, DELETE, EXPORT, etc.)';


--
-- Name: COLUMN audit_logs.data_category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.data_category IS 'Categoria do dado conforme LGPD: pessoal, sensivel, anonimizado';


--
-- Name: COLUMN audit_logs.legal_basis; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.legal_basis IS 'Base legal para tratamento: consentimento, contrato, obrigacao_legal, interesse_legitimo, etc.';


--
-- Name: COLUMN audit_logs.contains_sensitive_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_logs.contains_sensitive_data IS 'Indica se a operação envolve dados sensíveis (saúde, biometria, origem racial, etc.)';


--
-- Name: audit_daily_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.audit_daily_summary AS
 SELECT date(created_at) AS date,
    action,
    resource_type,
    count(*) AS total_events,
    count(DISTINCT user_id) AS unique_users,
    count(
        CASE
            WHEN (success = false) THEN 1
            ELSE NULL::integer
        END) AS failed_events,
    count(
        CASE
            WHEN (contains_sensitive_data = true) THEN 1
            ELSE NULL::integer
        END) AS sensitive_data_events
   FROM public.audit_logs
  GROUP BY (date(created_at)), action, resource_type
  ORDER BY (date(created_at)) DESC, action, resource_type;


--
-- Name: call_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.call_sessions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    consultation_id uuid,
    participants jsonb DEFAULT '{}'::jsonb NOT NULL,
    room_name character varying(255),
    room_id character varying(255),
    status character varying(20) DEFAULT 'active'::character varying,
    consent boolean DEFAULT false NOT NULL,
    started_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    session_type text,
    webrtc_active boolean DEFAULT false,
    recording_url text,
    CONSTRAINT call_sessions_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'ended'::character varying, 'error'::character varying])::text[])))
);


--
-- Name: TABLE call_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.call_sessions IS 'Sessões de videochamada em tempo real com IA';


--
-- Name: COLUMN call_sessions.webrtc_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.call_sessions.webrtc_active IS 'Indica se há uma conexão WebRTC peer-to-peer ativa (host + participant conectados com offer/answer)';


--
-- Name: cid10_db; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cid10_db (
    id bigint NOT NULL,
    content text,
    metadata jsonb,
    embedding public.vector(3072)
);


--
-- Name: cid10_db_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cid10_db_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cid10_db_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cid10_db_id_seq OWNED BY public.cid10_db.id;


--
-- Name: clinicas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinicas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cnpj text,
    user_auth uuid,
    nome text,
    email text,
    plano text,
    plano_ativo boolean
);


--
-- Name: conexoes_whatsapp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conexoes_whatsapp (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    doctor_id text,
    instancia_nome text,
    instancia_status text,
    instancia_qrcode text
);


--
-- Name: conexoes_whatsapp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.conexoes_whatsapp ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.conexoes_whatsapp_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: consent_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_records (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    patient_id uuid,
    email character varying(255),
    cpf character varying(14),
    consent_type character varying(100) NOT NULL,
    consent_version character varying(20),
    granted boolean NOT NULL,
    granted_at timestamp with time zone,
    revoked_at timestamp with time zone,
    purpose text NOT NULL,
    legal_basis character varying(100),
    data_categories text[],
    third_parties text[],
    retention_period character varying(100),
    collection_method character varying(50),
    ip_address inet,
    user_agent text,
    consent_document_url text,
    signature_data jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT consent_records_collection_method_check CHECK (((collection_method)::text = ANY ((ARRAY['web_form'::character varying, 'mobile_app'::character varying, 'verbal'::character varying, 'written'::character varying, 'electronic_signature'::character varying, 'api'::character varying])::text[])))
);


--
-- Name: TABLE consent_records; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.consent_records IS 'Registro de consentimentos de tratamento de dados';


--
-- Name: consultations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consultations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    doctor_id uuid,
    patient_id uuid,
    patient_name character varying(255) NOT NULL,
    patient_context text,
    consultation_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'CREATED'::character varying,
    duration integer,
    recording_url text,
    notes text,
    diagnosis text,
    treatment text,
    prescription text,
    next_appointment date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    etapa public."ETAPAS",
    solucao_etapa public."ES",
    transcricao text,
    consulta_inicio timestamp with time zone,
    consulta_fim timestamp with time zone,
    duracao real,
    google_event_id character varying(255),
    google_calendar_id character varying(255),
    sync_status character varying(20) DEFAULT 'local_only'::character varying,
    last_synced_at timestamp with time zone,
    clinica_id uuid,
    env text,
    valor_consulta double precision,
    anamnese_done boolean DEFAULT false,
    exames text[],
    "from" text,
    andamento public."ETAPA_CONSULTA" DEFAULT 'NOVA'::public."ETAPA_CONSULTA",
    consulta_finalizada boolean,
    CONSTRAINT consultations_consultation_type_check CHECK (((consultation_type)::text = ANY ((ARRAY['PRESENCIAL'::character varying, 'TELEMEDICINA'::character varying])::text[]))),
    CONSTRAINT consultations_status_check CHECK (((status)::text = ANY (ARRAY['CREATED'::text, 'AGENDAMENTO'::text, 'RECORDING'::text, 'PROCESSING'::text, 'VALIDATION'::text, 'VALID_ANAMNESE'::text, 'VALID_DIAGNOSTICO'::text, 'VALID_SOLUCAO'::text, 'COMPLETED'::text, 'ERROR'::text, 'CANCELLED'::text]))),
    CONSTRAINT consultations_sync_status_check CHECK (((sync_status)::text = ANY ((ARRAY['synced'::character varying, 'pending'::character varying, 'error'::character varying, 'local_only'::character varying])::text[])))
);


--
-- Name: COLUMN consultations.google_event_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.consultations.google_event_id IS 'ID do evento correspondente no Google Calendar';


--
-- Name: COLUMN consultations.google_calendar_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.consultations.google_calendar_id IS 'ID do calendário Google onde o evento foi criado';


--
-- Name: COLUMN consultations.sync_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.consultations.sync_status IS 'Status de sincronização: synced, pending, error, local_only';


--
-- Name: COLUMN consultations.last_synced_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.consultations.last_synced_at IS 'Timestamp da última sincronização com Google Calendar';


--
-- Name: d_agente_habitos_vida_sistemica; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.d_agente_habitos_vida_sistemica (
    user_id uuid NOT NULL,
    paciente_id uuid NOT NULL,
    consulta_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    pilar1_alimentacao_status_global text,
    pilar1_alimentacao_score_qualidade text,
    pilar1_alimentacao_padrao_atual_tipo text,
    pilar1_alimentacao_padrao_atual_qualidade_global text,
    pilar1_alimentacao_recordatorio_cafe_manha text,
    pilar1_alimentacao_recordatorio_almoco text,
    pilar1_alimentacao_recordatorio_lanche_tarde text,
    pilar1_alimentacao_recordatorio_jantar text,
    pilar1_alimentacao_recordatorio_pos_jantar text,
    pilar1_alimentacao_problemas_identificados text,
    pilar1_frequencia_ultraprocessados text,
    pilar1_frequencia_acucares_refinados text,
    pilar1_frequencia_proteina_qualidade text,
    pilar1_frequencia_gorduras_boas text,
    pilar1_frequencia_vegetais_folhas text,
    pilar1_frequencia_frutas text,
    pilar1_frequencia_cereais_integrais text,
    pilar1_frequencia_leguminosas text,
    pilar1_frequencia_oleaginosas text,
    pilar1_frequencia_probioticos text,
    pilar1_hidratacao_agua_ml_dia text,
    pilar1_hidratacao_cafe_xicaras_dia text,
    pilar1_hidratacao_cha text,
    pilar1_hidratacao_outras_bebidas text,
    pilar1_comportamento_mastigacao text,
    pilar1_comportamento_atencao_plena text,
    pilar1_comportamento_velocidade text,
    pilar1_comportamento_ambiente text,
    pilar1_comportamento_regularidade_horarios text,
    pilar1_comportamento_tamanho_porcoes text,
    pilar1_gatilhos_compulsao_emocional text,
    pilar1_gatilhos_compulsao_situacional text,
    pilar1_gatilhos_compulsao_temporal text,
    pilar1_gatilhos_compulsao_alimentos text,
    pilar1_tentativas_dietas_previas text,
    pilar1_relacao_comida_tipo text,
    pilar1_relacao_comida_culpa text,
    pilar1_relacao_comida_restricao_compensacao text,
    pilar1_relacao_comida_prazer text,
    pilar1_intolerancias_suspeitas_lactose text,
    pilar1_intolerancias_suspeitas_gluten text,
    pilar1_intolerancias_suspeitas_caseina text,
    pilar1_intolerancias_suspeitas_lectinas text,
    pilar1_intolerancias_suspeitas_frutose text,
    pilar1_intolerancias_suspeitas_necessidade text,
    pilar1_impacto_alimentacao_atual text,
    pilar1_necessidades_avaliacao text,
    pilar1_intervencao_requerida_nutricional text,
    pilar1_intervencao_requerida_abordagem text,
    pilar1_intervencao_requerida_comportamental text,
    pilar1_intervencao_requerida_educacional text,
    pilar2_atividade_fisica_status_global text,
    pilar2_atividade_fisica_score text,
    pilar2_padrao_pratica_exercicio text,
    pilar2_padrao_tipo text,
    pilar2_padrao_frequencia text,
    pilar2_padrao_duracao text,
    pilar2_padrao_intensidade text,
    pilar2_padrao_acompanhamento text,
    pilar2_padrao_resultado text,
    pilar2_hipoteses_falha text,
    pilar2_sedentarismo_trabalho text,
    pilar2_sedentarismo_casa text,
    pilar2_sedentarismo_transporte text,
    pilar2_sedentarismo_total_horas_sentada_dia text,
    pilar2_necessidades_avaliacao_detalhamento text,
    pilar2_avaliacao_profissional_necessaria text,
    pilar2_prescricao_fase1_objetivo text,
    pilar2_prescricao_fase1_tipo text,
    pilar2_prescricao_fase1_frequencia text,
    pilar2_prescricao_fase1_duracao text,
    pilar2_prescricao_fase1_intensidade text,
    pilar2_prescricao_fase1_evitar text,
    pilar2_prescricao_fase2_objetivo text,
    pilar2_prescricao_fase2_adicionar text,
    pilar2_prescricao_fase2_manter text,
    pilar2_prescricao_fase2_intensidade text,
    pilar2_prescricao_fase3_objetivo text,
    pilar2_prescricao_fase3_tipo text,
    pilar2_prescricao_fase3_intensidade text,
    pilar2_monitoramento_necessario text,
    pilar2_neat_atual text,
    pilar2_neat_necessidade text,
    pilar2_neat_acoes text,
    pilar3_sono_status_global text,
    pilar3_sono_score text,
    pilar3_padrao_horario_deitar text,
    pilar3_padrao_latencia_sono text,
    pilar3_padrao_horario_dormir_efetivo text,
    pilar3_padrao_despertares_noite text,
    pilar3_padrao_horario_despertar text,
    pilar3_padrao_duracao_total text,
    pilar3_padrao_qualidade_subjetiva text,
    pilar3_padrao_acorda_como text,
    pilar3_arquitetura_sono_n1_n2 text,
    pilar3_arquitetura_sono_n3 text,
    pilar3_arquitetura_sono_rem text,
    pilar3_arquitetura_sono_fragmentacao text,
    pilar3_problemas_insonia_inicial text,
    pilar3_problemas_insonia_manutencao text,
    pilar3_problemas_nocturia text,
    pilar3_problemas_despertar_precoce text,
    pilar3_problemas_sono_nao_reparador text,
    pilar3_problemas_pesadelos text,
    pilar3_problemas_ronco_apneia text,
    pilar3_causas_insonia text,
    pilar3_higiene_sono_score text,
    pilar3_higiene_sono_problemas text,
    pilar3_ambiente_sono_temperatura text,
    pilar3_ambiente_sono_luz text,
    pilar3_ambiente_sono_ruido text,
    pilar3_ambiente_sono_colchao text,
    pilar3_ambiente_sono_travesseiro text,
    pilar3_ambiente_sono_roupa_cama text,
    pilar3_impacto_sono_ruim text,
    pilar3_necessidades_avaliacao text,
    pilar3_intervencao_prioridade text,
    pilar3_higiene_horarios_fixos text,
    pilar3_higiene_rotina_pre_sono text,
    pilar3_higiene_atividades_durante_dia text,
    pilar3_higiene_ajustes_quarto text,
    pilar3_higiene_se_nao_dorme_20min text,
    pilar3_suplementacao_sono text,
    pilar3_fitoterapicos_sono text,
    pilar3_tecnicas_adicionais text,
    pilar3_tratar_causas text,
    pilar4_stress_status_global text,
    pilar4_stress_score text,
    pilar4_stress_nivel_atual text,
    pilar4_stress_cronicidade text,
    pilar4_fontes_stress_profissional text,
    pilar4_fontes_stress_familiar text,
    pilar4_fontes_stress_pessoal text,
    pilar4_fontes_stress_existencial text,
    pilar4_estrategias_coping_funcionais text,
    pilar4_estrategias_coping_disfuncionais text,
    pilar4_estrategias_coping_resultado text,
    pilar4_sintomas_stress_cronico text,
    pilar4_praticas_regulacao_nervosa_atuais text,
    pilar4_intervencao_psicoterapia text,
    pilar4_intervencao_praticas_diarias_obrigatorias text,
    pilar4_intervencao_limites_necessarios text,
    pilar4_intervencao_suporte_social text,
    pilar4_intervencao_lazer_prazer text,
    pilar5_espiritualidade_status_global text,
    pilar5_espiritualidade_score text,
    pilar5_espiritualidade_praticas_atuais text,
    pilar5_aspectos_conexao_proposito text,
    pilar5_aspectos_praticas_contemplativas text,
    pilar5_aspectos_conexao_natureza text,
    pilar5_aspectos_comunidade_pertencimento text,
    pilar5_aspectos_expressao_criativa text,
    pilar5_aspectos_gratidao text,
    pilar5_aspectos_transcendencia text,
    pilar5_impacto_falta_espiritualidade text,
    pilar5_intervencao_explorar_praticas text,
    pilar5_intervencao_reconexao_proposito text,
    pilar5_intervencao_comunidade text,
    pilar5_intervencao_praticas_simples_diarias text,
    habitos_exposicao_sol_atual text,
    habitos_exposicao_sol_impacto text,
    habitos_exposicao_sol_necessidade text,
    habitos_tecnologia_uso_celular text,
    habitos_tecnologia_redes_sociais text,
    habitos_tecnologia_trabalho_digital text,
    habitos_tecnologia_impacto text,
    habitos_tecnologia_necessidade text,
    habitos_trabalho_descanso_atual text,
    habitos_trabalho_descanso_necessidade text,
    ritmo_circadiano_status text,
    ritmo_circadiano_problemas text,
    ritmo_circadiano_impacto text,
    ritmo_circadiano_intervencao_sol_manha text,
    ritmo_circadiano_intervencao_horarios_fixos text,
    ritmo_circadiano_intervencao_escuridao_noite text,
    ritmo_circadiano_intervencao_jejum_noturno text,
    ritmo_circadiano_intervencao_temperatura text,
    ritmo_circadiano_intervencao_exercicio text,
    score_habitos_vida_geral text,
    prioridades_intervencao_habitos text,
    status boolean DEFAULT false,
    threadid text,
    id bigint NOT NULL,
    tipo_solicitacao text,
    input_edicao text,
    justificativa_edicao text,
    pilar3_rotina_sono_horario_dormir_recomendado text,
    pilar3_rotina_sono_horario_acordar_recomendado text,
    pilar3_rotina_sono_duracao_alvo text,
    pilar3_rotina_sono_janela_semana text,
    pilar3_rotina_sono_janela_fds text,
    pilar3_rotina_sono_consistencia_horario text,
    pilar3_rotina_sono_rotina_pre_sono text,
    pilar3_rotina_sono_gatilhos_evitar text,
    pilar3_rotina_sono_progressao_ajuste text,
    pilar3_rotina_sono_observacoes_clinicas text
);


--
-- Name: d_agente_habitos_vida_sistemica_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.d_agente_habitos_vida_sistemica ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.d_agente_habitos_vida_sistemica_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: d_agente_integracao_diagnostica; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.d_agente_integracao_diagnostica (
    user_id uuid NOT NULL,
    paciente_id uuid NOT NULL,
    consulta_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    diagnostico_titulo text,
    diagnostico_cid_primario text,
    diagnostico_cids_associados text,
    diagnostico_sintese_executiva text,
    fundacao_status text,
    fundacao_eventos text,
    fundacao_programacao_epigenetica text,
    fundacao_impacto_adulto text,
    colunas_status text,
    colunas_eventos_trauma_acumulados text,
    colunas_impacto_adulto text,
    cumeeira_status text,
    cumeeira_eventos text,
    cumeeira_impacto text,
    colapso_status text,
    colapso_fases_deterioracao text,
    cascata_psicossomatica_sequencial text,
    circulos_viciosos_autoalimentados text,
    diagnostico_biologico_primario text,
    diagnostico_biologico_sistemas_comprometidos text,
    diagnostico_biologico_gravidade text,
    diagnostico_psicologico_dsm5 text,
    diagnostico_psicologico_aspectos_cognitivos text,
    diagnostico_psicologico_aspectos_emocionais text,
    diagnostico_psicologico_risco_suicidio text,
    diagnostico_psicossomatico_interpretacao text,
    diagnostico_psicossomatico_significado text,
    diagnostico_psicossomatico_ganho_secundario text,
    diagnostico_biopsicossocial_biologico text,
    diagnostico_biopsicossocial_psicologico text,
    diagnostico_biopsicossocial_social text,
    diagnostico_biopsicossocial_espiritual text,
    diagnostico_biopsicossocial_conclusao text,
    eixo_fisiologico_central_primario text,
    eixo_fisiologico_intestino_afeta_tudo text,
    eixo_fisiologico_perpetuador_secundario text,
    eixo_fisiologico_cortisol_alto_cronico_destroi text,
    eixo_fisiologico_interacoes_conectadas text,
    eixo_fisiologico_exemplo_cascata text,
    reino_animal_presa_caracteristicas text,
    reino_animal_presa_origem text,
    reino_animal_presa_implicacao_tratamento text,
    miasma_psorico_definicao text,
    miasma_psorico_manifestacoes text,
    miasma_sifilis_status text,
    miasma_implicacao_homeopatica text,
    fatores_agravantes text,
    fatores_protetores text,
    janela_terapeutica_status text,
    janela_terapeutica_tempo_critico text,
    janela_terapeutica_urgencia text,
    janela_terapeutica_oportunidade text,
    janela_terapeutica_risco_perder text,
    prognostico_sem_intervencao_3m text,
    prognostico_sem_intervencao_6m text,
    prognostico_sem_intervencao_12m text,
    prognostico_sem_intervencao_24m text,
    prognostico_sem_intervencao_5a text,
    prognostico_sem_intervencao_10a text,
    prognostico_com_intervencao_15d text,
    prognostico_com_intervencao_1m text,
    prognostico_com_intervencao_2m text,
    prognostico_com_intervencao_3m text,
    prognostico_com_intervencao_6m text,
    prognostico_com_intervencao_9m text,
    prognostico_com_intervencao_12m text,
    prognostico_com_intervencao_18m text,
    prognostico_com_intervencao_24m text,
    prognostico_fatores_sucesso text,
    prognostico_probabilidades text,
    contradicoes_paradoxos text,
    principais_bloqueios_para_cura text,
    chaves_terapeuticas_prioritarias text,
    fase1_objetivo text,
    fase1_duracao text,
    fase1_foco text,
    fase1_acoes_especificas text,
    fase1_indicadores_sucesso text,
    fase2_objetivo text,
    fase2_duracao text,
    fase2_foco text,
    fase2_acoes_especificas text,
    fase2_indicadores_sucesso text,
    fase3_objetivo text,
    fase3_duracao text,
    fase3_foco text,
    fase3_acoes_especificas text,
    fase3_indicadores_sucesso text,
    fase4_objetivo text,
    fase4_duracao text,
    fase4_foco text,
    fase4_acoes_especificas text,
    fase4_indicadores_sucesso text,
    metricas_bioquimicas text,
    metricas_corporais text,
    metricas_funcionais text,
    metricas_comportamentais text,
    metricas_qualidade_vida text,
    equipe_core_obrigatorios text,
    equipe_suporte_importantes text,
    equipe_complementares_potencializadores text,
    equipe_comunicacao text,
    alertas_equipe_criticos text,
    nivel_confianca_diagnostico text,
    status boolean DEFAULT false,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    threadid text,
    tipo_solicitacao text,
    input_edicao text,
    justificativa_edicao text
);


--
-- Name: d_diagnostico_principal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.d_diagnostico_principal (
    user_id uuid NOT NULL,
    paciente_id uuid NOT NULL,
    consulta_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    cid_principal text,
    diagnosticos_associados_cid text,
    ads_sintese text,
    ads_biologico text,
    ads_psicologico text,
    ads_emocional text,
    ads_social text,
    ads_espiritual text,
    ads_trilha_causal_sintetica text,
    ads_tipo_sindrome text,
    grav_nivel text,
    grav_justificativa text,
    grav_janela_intervencao text,
    grav_risco_iminente text,
    eixos_comprometidos jsonb,
    reino_predominante text,
    reino_caracteristicas text,
    homeo_medicamento_principal text,
    homeo_justificativa text,
    homeo_potencia_inicial text,
    homeo_frequencia text,
    medicamentos_complementares text,
    florais_bach_indicados text,
    formula_floral_sugerida text,
    prognostico_sem_intervencao jsonb,
    prognostico_com_intervencao_ads jsonb,
    prognostico_fatores_favoraveis text,
    prognostico_fatores_desfavoraveis text,
    prob_sucesso_adesao_total text,
    prob_sucesso_adesao_parcial text,
    prob_sucesso_sem_adesao text,
    alertas_criticos text,
    status boolean DEFAULT false,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    threadid text,
    tipo_solicitacao text,
    input_edicao text,
    justificativa_edicao text
);


--
-- Name: d_estado_fisiologico; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.d_estado_fisiologico (
    user_id uuid NOT NULL,
    paciente_id uuid NOT NULL,
    consulta_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    end_tireo_status text,
    end_tireo_tsh text,
    end_tireo_anti_tpo text,
    end_tireo_t4_livre text,
    end_tireo_t3_livre text,
    end_tireo_diagnostico text,
    end_tireo_manifestacoes text,
    end_tireo_impacto_sistemico text,
    end_tireo_necessidade_exames text,
    end_tireo_acao_terapeutica text,
    end_insgl_status text,
    end_insgl_insulina_jejum text,
    end_insgl_glicemia_jejum text,
    end_insgl_hba1c text,
    end_insgl_homa_ir text,
    end_insgl_diagnostico text,
    end_insgl_fisiopatologia text,
    end_insgl_manifestacoes text,
    end_insgl_impacto_sistemico text,
    end_insgl_necessidade_exames text,
    end_insgl_acao_terapeutica text,
    end_hpa_status text,
    end_hpa_achados_presuntivos text,
    end_hpa_padro_cortisol text,
    end_hpa_fisiopatologia text,
    end_hpa_manifestacoes text,
    end_hpa_impacto_sistemico text,
    end_hpa_necessidade_exames text,
    end_hpa_acao_terapeutica text,
    end_sex_status text,
    end_sex_fase text,
    end_sex_achados_presuntivos text,
    end_sex_fisiopatologia text,
    end_sex_manifestacoes text,
    end_sex_impacto_sistemico text,
    end_sex_necessidade_exames text,
    end_sex_acao_terapeutica text,
    gi_int_status text,
    gi_int_habito_intestinal text,
    gi_int_bristol text,
    gi_int_esforco text,
    gi_int_sensacao text,
    gi_int_gases text,
    gi_int_distensao text,
    gi_int_dor_abdominal text,
    gi_int_lingua_diag text,
    gi_int_digestao text,
    gi_int_diagnostico text,
    gi_int_suspeita_patogenos text,
    gi_int_permeabilidade text,
    gi_int_impacto_sistemico text,
    gi_int_necessidade_exames text,
    gi_int_acao_prioritaria text,
    gi_fig_status text,
    gi_fig_achado_imagem text,
    gi_fig_importante text,
    gi_fig_diagnostico text,
    gi_fig_fisiopatologia text,
    gi_fig_fatores_contribuintes text,
    gi_fig_manifestacoes text,
    gi_fig_risco_progressao text,
    gi_fig_necessidade_exames text,
    gi_fig_acao_terapeutica text,
    gi_da_status text,
    gi_da_hipocloridria text,
    gi_da_insuficiencia_enzimatica text,
    gi_da_ma_absorcao text,
    gi_da_manifestacoes text,
    gi_da_acao text,
    cv_status text,
    cv_pressao_arterial text,
    cv_fatores_risco text,
    cv_escore_framingham text,
    cv_necessidade_exames text,
    cv_acao text,
    ms_status text,
    ms_dores_cronicas jsonb,
    ms_postura_avaliacao text,
    ms_postura_alteracoes text,
    ms_tono_global text,
    ms_tono_excepcoes text,
    ms_tono_manifestacao text,
    ms_mob_amplitude text,
    ms_mob_testes text,
    ms_sarcopenia_presente text,
    ms_sarcopenia_causas text,
    ms_sarcopenia_impacto text,
    ms_necessidade_avaliacao text,
    ms_acao text,
    pf_pele_condicao text,
    pf_pele_alteracoes text,
    pf_pele_causa text,
    pf_cabelo_condicao text,
    pf_cabelo_manifestacao text,
    pf_cabelo_causa text,
    pf_unhas_condicao text,
    pf_unhas_causa text,
    pf_hidratacao text,
    pf_acao text,
    neuro_cognicao text,
    neuro_sono_arquitetura text,
    neuro_sono_estadios text,
    neuro_sono_nocturia text,
    neuro_sono_apneia text,
    neuro_sono_necessidade text,
    neuro_dor text,
    imuno_status text,
    imuno_evidencias text,
    imuno_risco text,
    imuno_necessidade_exames text,
    infl_sist_nivel text,
    infl_sist_causas text,
    infl_sist_marcadores_medir text,
    infl_sist_impacto text,
    oxi_nivel text,
    oxi_causas text,
    oxi_marcadores_medir text,
    oxi_impacto text,
    met_status text,
    met_causas text,
    met_marcadores_medir text,
    met_impacto text,
    tox_metais_suspeita text,
    tox_metais_exposicao text,
    tox_metais_avaliacao text,
    tox_metais_impacto text,
    tox_xeno_exposicao text,
    tox_xeno_fontes text,
    tox_xeno_impacto text,
    tox_xeno_avaliacao text,
    tox_xeno_acao text,
    comp_peso text,
    comp_altura text,
    comp_imc text,
    comp_cintura text,
    comp_quadril text,
    comp_rcq text,
    comp_pescoco text,
    comp_braco text,
    comp_bia_gordura_percentual text,
    comp_bia_massa_muscular text,
    comp_bia_agua_corporal text,
    comp_bia_gordura_visceral text,
    comp_distribuicao_gordura text,
    comp_necessidade text,
    sv_pressao_arterial text,
    sv_frequencia_cardiaca text,
    sv_hrv text,
    sv_saturacao_o2 text,
    sv_temperatura_basal text,
    sv_acao text,
    exames_urgente_0_15_dias text,
    exames_alta_prioridade_30_dias text,
    exames_media_prioridade_60_90_dias text,
    status boolean DEFAULT false,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    threadid text,
    tipo_solicitacao text,
    input_edicao text,
    justificativa_edicao text
);


--
-- Name: d_estado_geral; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.d_estado_geral (
    user_id uuid NOT NULL,
    paciente_id uuid NOT NULL,
    consulta_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    avaliacao_estado text,
    avaliacao_score_vitalidade text,
    avaliacao_tendencia text,
    avaliacao_reserva_fisiologica text,
    energia_vital_nivel text,
    energia_vital_descricao text,
    energia_vital_manifestacao text,
    energia_vital_impacto text,
    adapt_stress_nivel text,
    adapt_stress_descricao text,
    adapt_stress_reserva_adaptativa text,
    adapt_stress_manifestacao text,
    resiliencia_nivel text,
    resiliencia_descricao text,
    resiliencia_elasticidade text,
    resiliencia_tempo_recuperacao text,
    obs_facies text,
    obs_postura text,
    obs_marcha text,
    obs_tonus_muscular text,
    obs_aparencia_geral text,
    obs_contato_visual text,
    obs_voz text,
    avd_autocuidado_basico text,
    avd_trabalho_profissional text,
    avd_cuidado_filhos text,
    avd_tarefas_domesticas text,
    avd_lazer_social text,
    avd_autocuidado_ampliado text,
    funcionalidade_score_karnofsky text,
    limitacoes_funcionais_especificas text,
    whoqol_score_geral text,
    whoqol_fisico text,
    whoqol_psicologico text,
    whoqol_social text,
    whoqol_ambiental text,
    whoqol_espiritual text,
    whoqol_satisfacao_vida_global text,
    sinais_alerta_deterioracao text,
    evo_10_anos_atras text,
    evo_5_anos_atras text,
    evo_3_anos_atras text,
    evo_1_ano_atras text,
    evo_atual text,
    projecao_6_meses_sem_intervencao text,
    impacto_profissional text,
    impacto_familiar text,
    impacto_social text,
    impacto_pessoal text,
    impacto_saude text,
    status boolean DEFAULT false,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    threadid text,
    tipo_solicitacao text,
    input_edicao text,
    justificativa_edicao text
);


--
-- Name: d_estado_mental; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.d_estado_mental (
    user_id uuid NOT NULL,
    paciente_id uuid NOT NULL,
    consulta_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    memoria_curto_prazo text,
    memoria_longo_prazo text,
    memoria_de_trabalho text,
    memoria_tipo_falha text,
    memoria_impacto_funcional text,
    memoria_score text,
    atencao_sustentada text,
    atencao_seletiva text,
    atencao_alternada text,
    atencao_dividida text,
    atencao_manifestacao text,
    atencao_score text,
    exec_planejamento text,
    exec_organizacao text,
    exec_iniciativa text,
    exec_tomada_decisao text,
    exec_flexibilidade_cognitiva text,
    exec_controle_inibitorio text,
    exec_score text,
    velocidade_processamento text,
    linguagem text,
    humor_tipo text,
    humor_intensidade text,
    humor_variabilidade text,
    humor_reatividade text,
    humor_diurno text,
    afeto_expressao text,
    afeto_congruencia text,
    afeto_modulacao text,
    ansiedade_nivel text,
    ansiedade_tipo_predominante text,
    ansiedade_manifestacoes_fisicas text,
    ansiedade_manifestacoes_cognitivas text,
    ansiedade_score_gad7_estimado text,
    phq9_humor_deprimido text,
    phq9_anedonia text,
    phq9_alteracao_apetite text,
    phq9_alteracao_sono text,
    phq9_fadiga text,
    phq9_culpa_inutilidade text,
    phq9_dificuldade_concentracao text,
    phq9_agitacao_retardo text,
    phq9_pensamentos_morte_suicidio text,
    phq9_score_estimado text,
    irritabilidade_nivel text,
    irritabilidade_frequencia text,
    irritabilidade_gatilhos text,
    irritabilidade_expressao text,
    irritabilidade_controle text,
    autoestima_global text,
    autopercepcao text,
    autoimagem_corporal text,
    autoeficacia text,
    autocompaixao text,
    pensamento_conteudo_predominante text,
    pensamento_processo text,
    pensamento_velocidade text,
    distorcoes_cognitivas_beck text,
    reg_estrategias_atuais text,
    reg_efetividade text,
    reg_flexibilidade text,
    motiv_nivel_geral text,
    motiv_tipo text,
    motiv_iniciativa text,
    motiv_persistencia text,
    motiv_procrastinacao text,
    tempo_passado text,
    tempo_presente text,
    tempo_futuro text,
    risco_nivel text,
    risco_ideacao text,
    risco_intencao text,
    risco_plano text,
    risco_comportamento_recente text,
    risco_tentativas_previas text,
    risco_fatores_risco text,
    risco_fatores_protecao text,
    risco_acao_requerida text,
    diagnosticos_mentais_dsm5_sugeridos text,
    intervencao_psicoterapia text,
    intervencao_frequencia_inicial text,
    intervencao_psiquiatria text,
    intervencao_grupos_apoio text,
    intervencao_tecnicas_complementares text,
    status boolean DEFAULT false,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    threadid text,
    tipo_solicitacao text,
    input_edicao text,
    justificativa_edicao text
);


--
-- Name: daily_checkins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_checkins (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    paciente_id uuid NOT NULL,
    data_checkin date DEFAULT CURRENT_DATE NOT NULL,
    sono_qualidade integer,
    sono_tempo_horas numeric(4,2),
    atividade_tempo_horas numeric(4,2),
    atividade_intensidade integer,
    alimentacao_refeicoes integer,
    alimentacao_agua_litros numeric(4,2)
);


--
-- Name: daily_checkins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_checkins_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_checkins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_checkins_id_seq OWNED BY public.daily_checkins.id;


--
-- Name: frutas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.frutas (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    nome text,
    proporcao text
);


--
-- Name: frutas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.frutas ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.frutas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: google_calendar_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_calendar_tokens (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    medico_id uuid NOT NULL,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    token_expiry timestamp with time zone NOT NULL,
    calendar_id character varying(255),
    calendar_name character varying(255),
    sync_enabled boolean DEFAULT true,
    last_sync_at timestamp with time zone,
    google_email character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE google_calendar_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.google_calendar_tokens IS 'Armazena tokens OAuth do Google Calendar para cada médico';


--
-- Name: COLUMN google_calendar_tokens.access_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.google_calendar_tokens.access_token IS 'Token de acesso OAuth (criptografado na aplicação)';


--
-- Name: COLUMN google_calendar_tokens.refresh_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.google_calendar_tokens.refresh_token IS 'Token para renovar access_token (criptografado na aplicação)';


--
-- Name: COLUMN google_calendar_tokens.calendar_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.google_calendar_tokens.calendar_id IS 'ID do calendário Google selecionado para sincronização';


--
-- Name: COLUMN google_calendar_tokens.google_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.google_calendar_tokens.google_email IS 'Email da conta Google conectada';


--
-- Name: s_gramaturas_alimentares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.s_gramaturas_alimentares (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    alimento text,
    paciente_id uuid NOT NULL,
    gramatura_por_refeicao real[],
    kcal_por_refeicao real[],
    proporcao_fruta text,
    tipo_de_alimentos text,
    ref1_g real,
    ref2_g real,
    ref3_g real,
    ref4_g real,
    ref1_kcal real,
    ref2_kcal real,
    ref3_kcal real,
    ref4_kcal real,
    no_plano boolean,
    threadid text,
    refeicao_1 jsonb,
    refeicao_2 jsonb,
    refeicao_3 jsonb,
    refeicao_4 jsonb
);


--
-- Name: gramaturas_alimentares_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.s_gramaturas_alimentares ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.gramaturas_alimentares_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: knlg_mentalidade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knlg_mentalidade (
    id bigint NOT NULL,
    content text,
    metadata jsonb,
    embedding public.vector(3072)
);


--
-- Name: knlg_mentalidade_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knlg_mentalidade_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knlg_mentalidade_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knlg_mentalidade_id_seq OWNED BY public.knlg_mentalidade.id;


--
-- Name: knlg_naturologia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knlg_naturologia (
    id bigint NOT NULL,
    content text,
    metadata jsonb,
    embedding public.vector(3072)
);


--
-- Name: knlg_naturologia_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knlg_naturologia_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knlg_naturologia_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knlg_naturologia_id_seq OWNED BY public.knlg_naturologia.id;


--
-- Name: knlg_s_nutrition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knlg_s_nutrition (
    id bigint NOT NULL,
    content text,
    metadata jsonb,
    embedding public.vector(3072)
);


--
-- Name: knlg_s_nutrition_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knlg_s_nutrition_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knlg_s_nutrition_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knlg_s_nutrition_id_seq OWNED BY public.knlg_s_nutrition.id;


--
-- Name: knowledge_db; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_db (
    id bigint NOT NULL,
    content text,
    metadata jsonb,
    embedding public.vector(3072)
);


--
-- Name: knowledge_db_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knowledge_db_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knowledge_db_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knowledge_db_id_seq OWNED BY public.knowledge_db.id;


--
-- Name: lgpd_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lgpd_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    requester_user_id uuid,
    requester_email character varying(255) NOT NULL,
    requester_name character varying(255),
    requester_cpf character varying(14),
    request_type character varying(50) NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying,
    description text,
    scope text[],
    assigned_to uuid,
    processed_at timestamp with time zone,
    processed_by uuid,
    response text,
    rejection_reason text,
    attachments jsonb DEFAULT '[]'::jsonb,
    exported_data_url text,
    deadline_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT lgpd_requests_request_type_check CHECK (((request_type)::text = ANY ((ARRAY['ACCESS'::character varying, 'CORRECTION'::character varying, 'DELETION'::character varying, 'PORTABILITY'::character varying, 'REVOKE_CONSENT'::character varying, 'OBJECTION'::character varying, 'INFORMATION'::character varying])::text[]))),
    CONSTRAINT lgpd_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'awaiting_verification'::character varying, 'completed'::character varying, 'rejected'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: TABLE lgpd_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.lgpd_requests IS 'Solicitações de direitos do titular de dados conforme LGPD (acesso, correção, exclusão, portabilidade)';


--
-- Name: lista_exercicios_fisicos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lista_exercicios_fisicos (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    atividade text,
    grupo_muscular text
);


--
-- Name: lista_exercicios_fisicos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.lista_exercicios_fisicos ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.lista_exercicios_fisicos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: llm_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llm_pricing (
    "Provider" text,
    "Model" text,
    "Category" text,
    "Input_Price" text,
    "Cached_Input_Price" text,
    "Output_Price" text,
    "Unit" text,
    "Notes" text
);


--
-- Name: log_erros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.log_erros (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    payload jsonb,
    motivo text,
    consulta_id text,
    tipo text,
    local text DEFAULT 'CODIGO'::text
);


--
-- Name: log_erros_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.log_erros ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.log_erros_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: medicos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medicos (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(20),
    cpf character varying(14),
    birth_date date,
    is_doctor boolean DEFAULT false,
    specialty character varying(100),
    crm character varying(20),
    subscription_type character varying(20) DEFAULT 'FREE'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_auth uuid,
    profile_pic text,
    tester boolean,
    admin boolean DEFAULT false,
    clinica_id uuid,
    clinica_admin boolean,
    primeiro_acesso boolean,
    medico_deletado boolean,
    asaas_cus_id text,
    asaas_assinatura_id text,
    CONSTRAINT users_subscription_type_check CHECK (((subscription_type)::text = ANY ((ARRAY['FREE'::character varying, 'PRO'::character varying, 'ENTERPRISE'::character varying])::text[])))
);


--
-- Name: TABLE medicos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.medicos IS 'Tabela de médicos - RLS baseado em user_auth = auth.uid()';


--
-- Name: pagamento_criado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagamento_criado (
    id bigint NOT NULL,
    event_id text NOT NULL,
    payment_id text NOT NULL,
    customer_id text NOT NULL,
    value numeric(12,2) NOT NULL,
    net_value numeric(12,2),
    billing_type text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    description text,
    due_date date,
    invoice_url text,
    boleto_url text,
    external_reference text,
    raw_payload jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: pagamento_criado_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pagamento_criado_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pagamento_criado_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pagamento_criado_id_seq OWNED BY public.pagamento_criado.id;


--
-- Name: pagamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagamentos (
    id bigint NOT NULL,
    doctor_id text NOT NULL,
    event text,
    payment_id text,
    customer text,
    subscription_id text,
    value numeric,
    net_value numeric,
    billing_type text,
    invoice_url text,
    invoice_number text,
    transaction_receipt_url text,
    created_at timestamp with time zone DEFAULT now(),
    env text
);


--
-- Name: pagamentos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.pagamentos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.pagamentos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: patient_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_metrics (
    id bigint NOT NULL,
    paciente_id uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    equilibrio_geral numeric(4,2),
    equilibrio_geral_variacao numeric(5,2),
    qualidade_sono_horas numeric(4,2),
    qualidade_sono_variacao_minutos integer,
    hidratacao_atual_litros numeric(4,2),
    hidratacao_meta_litros numeric(4,2) DEFAULT 2.4,
    mental_energia numeric(4,2),
    mental_energia_variacao numeric(5,2),
    equilibrio_sono numeric(4,2),
    equilibrio_atividade_fisica numeric(4,2),
    equilibrio_alimentacao numeric(4,2),
    idade_biologica integer,
    aderencia_protocolo numeric(5,2)
);


--
-- Name: patient_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patient_metrics_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patient_metrics_id_seq OWNED BY public.patient_metrics.id;


--
-- Name: patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patients (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    doctor_id uuid,
    name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(20),
    city character varying(100),
    state character varying(2),
    birth_date date,
    gender character varying(10),
    cpf character varying(14),
    address text,
    emergency_contact character varying(255),
    emergency_phone character varying(20),
    medical_history text,
    allergies text,
    current_medications text,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    medicamento_freq text,
    historico_cirurgico text,
    data_ultima_cirurgia date,
    convenio text,
    convenio_vigencia date,
    profile_pic text,
    user_auth uuid,
    cep character varying(9),
    user_status character varying(20) DEFAULT 'inactive'::character varying,
    documents text[],
    CONSTRAINT patients_gender_check CHECK (((gender)::text = ANY ((ARRAY['M'::character varying, 'F'::character varying, 'O'::character varying])::text[]))),
    CONSTRAINT patients_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT patients_user_status_check CHECK (((user_status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


--
-- Name: COLUMN patients.user_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.patients.user_status IS 'Status do usuário: active (ativo) ou inactive (inativo)';


--
-- Name: recordings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recordings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    consultation_id uuid,
    room_id character varying(255),
    file_path text NOT NULL,
    file_url text,
    file_size bigint DEFAULT 0 NOT NULL,
    duration_seconds integer,
    mime_type character varying(50) DEFAULT 'video/webm'::character varying,
    status character varying(20) DEFAULT 'recording'::character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    details text,
    CONSTRAINT recordings_status_check CHECK (((status)::text = ANY ((ARRAY['recording'::character varying, 'processing'::character varying, 'completed'::character varying, 'error'::character varying])::text[])))
);


--
-- Name: TABLE recordings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.recordings IS 'Armazena metadados das gravações de consultas médicas';


--
-- Name: COLUMN recordings.file_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.recordings.file_path IS 'Caminho do arquivo no Supabase Storage (bucket: consultas)';


--
-- Name: COLUMN recordings.file_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.recordings.file_url IS 'URL pública ou assinada para acesso ao arquivo';


--
-- Name: COLUMN recordings.duration_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.recordings.duration_seconds IS 'Duração da gravação em segundos';


--
-- Name: COLUMN recordings.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.recordings.status IS 'Status: recording (gravando), processing (processando), completed (concluída), error (erro)';


--
-- Name: reports_consultas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports_consultas (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    consulta_id uuid NOT NULL,
    clinica_id uuid,
    paciente_id uuid,
    doctor_id uuid,
    patient_name character varying(255),
    status character varying(20) NOT NULL,
    etapa character varying(50) NOT NULL,
    message text NOT NULL,
    minutes_stuck numeric(10,2),
    updated_at timestamp with time zone,
    env text,
    resolved boolean DEFAULT false,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    error_hash text DEFAULT ''::text NOT NULL,
    doctor_name character varying(255)
);


--
-- Name: TABLE reports_consultas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.reports_consultas IS 'Tabela para armazenar relatórios de consultas travadas/com erro detectadas pelo sistema de monitoramento';


--
-- Name: COLUMN reports_consultas.message; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reports_consultas.message IS 'Mensagem descritiva do erro encontrado';


--
-- Name: COLUMN reports_consultas.minutes_stuck; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reports_consultas.minutes_stuck IS 'Quantos minutos a consulta estava travada quando o erro foi detectado';


--
-- Name: COLUMN reports_consultas.resolved; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reports_consultas.resolved IS 'Indica se o problema foi resolvido';


--
-- Name: COLUMN reports_consultas.resolved_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reports_consultas.resolved_at IS 'Data/hora em que o problema foi marcado como resolvido';


--
-- Name: COLUMN reports_consultas.error_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reports_consultas.error_hash IS 'Hash único do erro (MD5 de consulta_id + etapa + message) para evitar duplicatas';


--
-- Name: s_agente_limpeza_do_terreno_biologico; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.s_agente_limpeza_do_terreno_biologico (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    user_id text,
    paciente_id text,
    consulta_id text,
    objetivo_principal text,
    urgencia text,
    fase1_duracao text,
    fase1_objetivo text,
    hidrocolonterapia_indicacao text,
    hidrocolonterapia_sessoes text,
    hidrocolonterapia_frequencia text,
    hidrocolonterapia_protocolo text,
    hidrocolonterapia_temperatura_agua text,
    hidrocolonterapia_profissional text,
    hidrocolonterapia_preparo_dia text,
    hidrocolonterapia_pos_sessao text,
    ozonioterapia_intestinal_indicacao text,
    ozonioterapia_intestinal_sessoes text,
    ozonioterapia_intestinal_frequencia text,
    ozonioterapia_intestinal_via text,
    ozonioterapia_intestinal_concentracao text,
    ozonioterapia_intestinal_duracao_sessao text,
    ozonioterapia_intestinal_beneficios_caso text,
    ozonioterapia_intestinal_combinar text,
    ozonioterapia_sistemica_indicacao text,
    ozonioterapia_sistemica_tipo text,
    ozonioterapia_sistemica_sessoes text,
    ozonioterapia_sistemica_frequencia text,
    ozonioterapia_sistemica_protocolo text,
    ozonioterapia_sistemica_beneficios_caso text,
    ozonioterapia_sistemica_observacao text,
    fase2_duracao text,
    fase2_objetivo text,
    antiparasitario_protocolo_escolhido text,
    trio_hulda_clark_composicao text,
    trio_hulda_clark_posologia_semana_1 text,
    trio_hulda_clark_posologia_semana_2 text,
    trio_hulda_clark_posologia_semana_3_6 text,
    trio_hulda_clark_posologia_semana_7_8 text,
    trio_hulda_clark_onde_comprar text,
    oleo_oregano_tipo text,
    oleo_oregano_posologia text,
    oleo_oregano_duracao text,
    oleo_oregano_marca_sugerida text,
    suporte_hepatico_obrigatorio_justificativa text,
    suporte_hepatico_obrigatorio_protocolo text,
    antifungico_candida_indicacao text,
    antifungico_candida_duracao text,
    dieta_anticandida_eliminar_totalmente text,
    dieta_anticandida_focar text,
    dieta_anticandida_duracao_rigor text,
    antifungicos_naturais_lista text,
    probiotico_especial_substancia text,
    probiotico_especial_dose text,
    probiotico_especial_justificativa text,
    probiotico_especial_duracao text,
    herxheimer_o_que_e text,
    herxheimer_sintomas_possiveis text,
    herxheimer_quando_ocorre text,
    herxheimer_duracao text,
    herxheimer_e_bom_ou_ruim text,
    herxheimer_como_minimizar text,
    herxheimer_quando_parar text,
    fase3_inicio text,
    fase3_duracao text,
    fase3_objetivo text,
    estrategia_rotacao_principio text,
    probiotico_mes1_2_tipo text,
    probiotico_mes1_2_potencia text,
    probiotico_mes1_2_cepas_prioritarias text,
    probiotico_mes1_2_posologia text,
    probiotico_mes3_4_foco text,
    probiotico_mes3_4_cepas_especificas text,
    probiotico_mes3_4_beneficio_caso text,
    probiotico_mes3_4_produto_exemplo text,
    probiotico_mes5_6_foco text,
    probiotico_mes5_6_cepas_especificas text,
    probiotico_mes5_6_beneficio_caso text,
    probiotico_mes7_manutencao_tipo text,
    probiotico_mes7_manutencao_dosagem text,
    probiotico_mes7_manutencao_duracao text,
    prebioticos_suplementos text,
    prebioticos_alimentos text,
    posbioticos_butirato_o_que_e text,
    posbioticos_butirato_suplemento text,
    posbioticos_butirato_dose text,
    posbioticos_butirato_beneficios text,
    posbioticos_butirato_quando_adicionar text,
    fase4_duracao text,
    fase4_objetivo text,
    reparacao_suplementos_essenciais text,
    fase5_urgencia text,
    fase5_duracao text,
    suporte_hepatico_agressivo text,
    fitoterapicos_detox text,
    monitoramento_hepatico_exames_controle text,
    monitoramento_hepatico_meta text,
    fase6_quando text,
    fase6_se_positivo text,
    quelantes_naturais text,
    suporte_hidrico text,
    quelacao_agressiva_quando_considerar text,
    quelacao_agressiva_tipos text,
    quelacao_agressiva_como text,
    quelacao_agressiva_nao_fazer_sozinha text,
    cronograma_mes1_foco text,
    cronograma_mes1_acoes text,
    cronograma_mes2_foco text,
    cronograma_mes2_acoes text,
    cronograma_mes3_4_foco text,
    cronograma_mes3_4_acoes text,
    cronograma_mes5_6_foco text,
    cronograma_mes5_6_acoes text,
    cronograma_mes7_12_foco text,
    cronograma_mes7_12_acoes text,
    opcao_basica_economica_sem_terapias text,
    opcao_basica_economica_focar text,
    opcao_basica_economica_observacao text,
    sinais_sucesso_mes1 text,
    sinais_sucesso_mes2 text,
    sinais_sucesso_mes3_4 text,
    sinais_sucesso_mes6 text,
    sinais_sucesso_mes12 text,
    alertas_criticos_seguranca text,
    status boolean DEFAULT false,
    threadid text
);


--
-- Name: s_agente_1_limpeza_do_terreno_biologico_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.s_agente_1_limpeza_do_terreno_biologico_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: s_agente_1_limpeza_do_terreno_biologico_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.s_agente_1_limpeza_do_terreno_biologico_id_seq OWNED BY public.s_agente_limpeza_do_terreno_biologico.id;


--
-- Name: s_agente_habitos_de_vida_final; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.s_agente_habitos_de_vida_final (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    user_id text,
    paciente_id text,
    consulta_id text,
    status boolean DEFAULT false,
    mes_1_2_foco text,
    mes_1_2_mudancas_simultaneas_maximo integer DEFAULT 7,
    mes_1_2_meta text,
    mes_3_4_foco text,
    mes_3_4_meta text,
    mes_5_6_foco text,
    mes_5_6_meta text,
    mes_7_9_meta text,
    mes_10_12_meta text,
    dia_util_6h00_6h05 text,
    dia_util_6h05_6h15 text,
    dia_util_6h15_6h30 text,
    dia_util_6h30_7h00 text,
    dia_util_7h00_7h30 text,
    dia_util_7h30_8h00 text,
    dia_util_8h00_9h00 text,
    dia_util_9h00_10h00 text,
    dia_util_10h00_11h00 text,
    dia_util_11h00_12h00 text,
    dia_util_12h00_12h30 text,
    dia_util_12h30_13h00 text,
    dia_util_13h00_14h00 text,
    dia_util_14h00_15h00 text,
    dia_util_15h00_16h00 text,
    dia_util_16h00_17h00 text,
    dia_util_17h00_18h00 text,
    dia_util_18h00_19h00 text,
    dia_util_19h00_20h00 text,
    dia_util_20h00_20h30 text,
    dia_util_20h30_21h00 text,
    dia_util_21h00_21h30 text,
    dia_util_21h30_22h00 text,
    dia_util_22h00_6h00 text,
    sabado_6h00_7h00 text,
    sabado_7h00_8h00 text,
    sabado_8h00_9h00 text,
    sabado_9h00_10h00 text,
    sabado_10h00_11h00 text,
    sabado_11h00_12h00 text,
    sabado_12h00_13h00 text,
    sabado_13h00_14h00 text,
    sabado_14h00_15h00 text,
    sabado_15h00_16h00 text,
    sabado_16h00_17h00 text,
    sabado_17h00_18h00 text,
    sabado_18h00_19h00 text,
    sabado_19h00_20h00 text,
    sabado_20h00_21h00 text,
    sabado_21h00_22h00 text,
    sabado_22h00_6h00 text,
    domingo_6h00_7h00 text,
    domingo_7h00_8h00 text,
    domingo_8h00_9h00 text,
    domingo_9h00_10h00 text,
    domingo_10h00_11h00 text,
    domingo_11h00_12h00 text,
    domingo_12h00_13h00 text,
    domingo_13h00_14h00 text,
    domingo_14h00_15h00 text,
    domingo_15h00_16h00 text,
    domingo_16h00_17h00 text,
    domingo_17h00_18h00 text,
    domingo_18h00_19h00 text,
    domingo_19h00_20h00 text,
    domingo_20h00_21h00 text,
    domingo_21h00_22h00 text,
    domingo_22h00_6h00 text,
    ritual_matinal_sequencia text,
    ritual_matinal_regra text,
    ritual_refeicoes_sequencia text,
    ritual_refeicoes_frequencia text,
    ritual_sono_sequencia text,
    ritual_sono_regra text,
    apps_recomendados text,
    livros text,
    comunidades text,
    profissionais text,
    alertas_importantes text,
    threadid text
);


--
-- Name: TABLE s_agente_habitos_de_vida_final; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.s_agente_habitos_de_vida_final IS 'Tabela para armazenar planos de transformação de hábitos de vida (12 meses)';


--
-- Name: COLUMN s_agente_habitos_de_vida_final.mes_1_2_foco; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.s_agente_habitos_de_vida_final.mes_1_2_foco IS 'Array com focos do mês 1-2 (estabilização)';


--
-- Name: COLUMN s_agente_habitos_de_vida_final.ritual_matinal_sequencia; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.s_agente_habitos_de_vida_final.ritual_matinal_sequencia IS 'Array com sequência fixa do ritual matinal (60-90min)';


--
-- Name: COLUMN s_agente_habitos_de_vida_final.apps_recomendados; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.s_agente_habitos_de_vida_final.apps_recomendados IS 'Array com apps recomendados para suporte';


--
-- Name: s_agente_6_habitos_de_vida_final_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.s_agente_6_habitos_de_vida_final_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: s_agente_6_habitos_de_vida_final_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.s_agente_6_habitos_de_vida_final_id_seq OWNED BY public.s_agente_habitos_de_vida_final.id;


--
-- Name: s_agente_mentalidade_2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.s_agente_mentalidade_2 (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    user_id text,
    paciente_id text,
    consulta_id text,
    status boolean DEFAULT false,
    threadid text,
    resumo_executivo jsonb,
    padrao_01 jsonb,
    padrao_02 jsonb,
    padrao_03 jsonb,
    padrao_04 jsonb,
    padrao_05 jsonb,
    padrao_06 jsonb,
    padrao_07 jsonb,
    padrao_08 jsonb,
    padrao_09 jsonb,
    padrao_10 jsonb,
    entregavel_link text,
    higiene_sono jsonb
);


--
-- Name: s_agente_mentalidade_2_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.s_agente_mentalidade_2_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: s_agente_mentalidade_2_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.s_agente_mentalidade_2_id_seq OWNED BY public.s_agente_mentalidade_2.id;


--
-- Name: s_exercicios_fisicos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.s_exercicios_fisicos (
    created_at timestamp with time zone DEFAULT now(),
    consulta_id uuid NOT NULL,
    paciente_id uuid,
    user_id uuid,
    thread_id text,
    tipo_treino text,
    grupo_muscular text,
    nome_exercicio text,
    series text,
    repeticoes text,
    descanso text,
    observacoes text,
    treino_atual integer,
    proximo_treino integer,
    ultimo_treino boolean DEFAULT false,
    alertas_importantes text,
    nome_treino text,
    id bigint NOT NULL,
    threadid text,
    tipo_solicitacao text,
    input_edicao text,
    justificativa_edicao text,
    CONSTRAINT s_exercicios_fisicos_tipo_treino_check CHECK ((tipo_treino = ANY (ARRAY['Treino de Força'::text, 'Cardiovascular'::text, 'Mobilidade'::text, 'Esportivo'::text, 'Misto'::text])))
);


--
-- Name: s_exercicios_fisicos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.s_exercicios_fisicos ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.s_exercicios_fisicos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: s_refeicao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.s_refeicao (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paciente uuid,
    ref_1 jsonb,
    ref_2 jsonb,
    ref_3 jsonb,
    ref_4 jsonb
);


--
-- Name: s_refeicao_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.s_refeicao ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.s_refeicao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: s_selects_alimentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.s_selects_alimentos (
    id bigint NOT NULL,
    alimento text,
    macronutriente text,
    kcal_1g numeric
);


--
-- Name: s_selects_alimentos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.s_selects_alimentos ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.s_selects_alimentos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: s_suplementacao2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.s_suplementacao2 (
    id bigint NOT NULL,
    suplementos text[],
    fitoterapicos text[],
    homeopatia text[],
    florais_bach text[],
    created_at timestamp with time zone DEFAULT now(),
    user_id text,
    paciente_id text,
    consulta_id text,
    threadid text,
    entregavel_link text
);


--
-- Name: s_suplementacao2_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.s_suplementacao2_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: s_suplementacao2_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.s_suplementacao2_id_seq OWNED BY public.s_suplementacao2.id;


--
-- Name: sensitive_data_access_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.sensitive_data_access_view AS
 SELECT id,
    user_email,
    user_role,
    action,
    resource_type,
    resource_description,
    data_fields_accessed,
    purpose,
    legal_basis,
    created_at,
    ip_address
   FROM public.audit_logs al
  WHERE (contains_sensitive_data = true)
  ORDER BY created_at DESC;


--
-- Name: status_agentes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.status_agentes (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    consulta_id text,
    agente1_cadastro_prontuario boolean DEFAULT true,
    agente2_objetivos_queixas boolean,
    agente3_sensacao_emocoes_campos_sutis boolean,
    agente4_ambiente_contexto boolean,
    agente5_classificacao_reino_miasma boolean,
    agente6_historia_vida_narrativa boolean,
    agente7_setenios_eventos_criticos boolean,
    agente8_preocupacoes_crencas_queixa boolean,
    agente9_observacao_clinica_laboratorial boolean,
    agente10_historico_doencas_pregressas_risco boolean,
    agente11_sintese_analitica boolean
);


--
-- Name: status_agentes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.status_agentes ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.status_agentes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: status_agentes_solucao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.status_agentes_solucao (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    consulta_id text,
    agente1_livro_da_vida boolean,
    agente2_suplementacao boolean,
    agente3_alimentacao boolean,
    agente4_exercicio boolean
);


--
-- Name: status_agentes_solucao_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.status_agentes_solucao ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.status_agentes_solucao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suggestions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    session_id uuid NOT NULL,
    utterance_id uuid,
    type character varying(50) NOT NULL,
    content text NOT NULL,
    source character varying(255),
    source_section character varying(255),
    confidence numeric(4,3),
    priority character varying(10) DEFAULT 'medium'::character varying,
    used boolean DEFAULT false,
    used_at timestamp with time zone,
    used_by character varying(255),
    rag_context jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT suggestions_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT suggestions_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[]))),
    CONSTRAINT suggestions_type_check CHECK (((type)::text = ANY ((ARRAY['question'::character varying, 'insight'::character varying, 'warning'::character varying, 'protocol'::character varying, 'next_steps'::character varying, 'followup'::character varying])::text[])))
);


--
-- Name: TABLE suggestions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.suggestions IS 'Sugestões geradas pela IA durante as calls';


--
-- Name: tabela_alimentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tabela_alimentos (
    numero_do_alimento text,
    alimento text,
    umidade text,
    energia_kcal text,
    energia_kj text,
    proteina text,
    lipideos text,
    colesterol text,
    hidrato text,
    fibra_alimentar text,
    cinzas text,
    calcio text,
    magnesio text,
    numero_do_alimento_2 text,
    manganes text,
    fosforo text,
    ferro text,
    sodio text,
    potassio text,
    cobre text,
    zinco text,
    retinol text,
    re text,
    rae text,
    tiamina text,
    riboflavina text,
    piridoxina text,
    niacina text,
    vitamina_c text
);


--
-- Name: transcriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transcriptions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    consultation_id uuid,
    raw_text text NOT NULL,
    summary text,
    key_points text[],
    diagnosis text,
    treatment text,
    observations text,
    confidence numeric(3,2),
    processing_time numeric(5,2),
    language character varying(10) DEFAULT 'pt-BR'::character varying,
    model_used character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    CONSTRAINT transcriptions_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric)))
);


--
-- Name: transcriptions_med; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transcriptions_med (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    session_id uuid NOT NULL,
    speaker character varying(50) NOT NULL,
    speaker_id character varying(255),
    text text NOT NULL,
    is_final boolean DEFAULT false,
    start_ms bigint NOT NULL,
    end_ms bigint,
    confidence numeric(4,3),
    processing_status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    doctor_name character varying(255),
    CONSTRAINT utterances_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT utterances_processing_status_check CHECK (((processing_status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'error'::character varying])::text[]))),
    CONSTRAINT utterances_speaker_check CHECK (((speaker)::text = ANY ((ARRAY['doctor'::character varying, 'patient'::character varying, 'system'::character varying])::text[])))
);


--
-- Name: TABLE transcriptions_med; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.transcriptions_med IS 'Falas transcritas em tempo real durante as calls';


--
-- Name: COLUMN transcriptions_med.doctor_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.transcriptions_med.doctor_name IS 'Nome do médico responsável pela consulta para facilitar buscas e filtros';


--
-- Name: a_ambiente_contexto id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_ambiente_contexto ALTER COLUMN id SET DEFAULT nextval('public.a_ambiente_contexto_id_seq'::regclass);


--
-- Name: a_cadastro_prontuario id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_cadastro_prontuario ALTER COLUMN id SET DEFAULT nextval('public.a_cadastro_prontuario_id_seq'::regclass);


--
-- Name: a_historia_vida id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_historia_vida ALTER COLUMN id SET DEFAULT nextval('public.a_historia_vida_id_seq'::regclass);


--
-- Name: a_historico_risco id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_historico_risco ALTER COLUMN id SET DEFAULT nextval('public.a_historico_risco_id_seq'::regclass);


--
-- Name: a_objetivos_queixas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_objetivos_queixas ALTER COLUMN id SET DEFAULT nextval('public.a_objetivos_queixas_id_int_seq'::regclass);


--
-- Name: a_observacao_clinica_lab id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_observacao_clinica_lab ALTER COLUMN id SET DEFAULT nextval('public.a_observacao_clinica_lab_id_seq'::regclass);


--
-- Name: a_observacao_clinica_lab_2 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_observacao_clinica_lab_2 ALTER COLUMN id SET DEFAULT nextval('public.a_observacao_clinica_lab_2_id_seq'::regclass);


--
-- Name: a_preocupacoes_crencas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_preocupacoes_crencas ALTER COLUMN id SET DEFAULT nextval('public.a_preocupacoes_crencas_id_seq'::regclass);


--
-- Name: a_reino_miasma id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_reino_miasma ALTER COLUMN id SET DEFAULT nextval('public.a_reino_miasma_id_seq'::regclass);


--
-- Name: a_sensacao_emocoes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_sensacao_emocoes ALTER COLUMN id SET DEFAULT nextval('public.a_sensacao_emocoes_id_seq'::regclass);


--
-- Name: a_setenios_eventos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_setenios_eventos ALTER COLUMN id SET DEFAULT nextval('public.a_setenios_eventos_id_seq'::regclass);


--
-- Name: a_sintese_analitica id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_sintese_analitica ALTER COLUMN id SET DEFAULT nextval('public.a_sintese_analitica_id_seq'::regclass);


--
-- Name: cid10_db id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cid10_db ALTER COLUMN id SET DEFAULT nextval('public.cid10_db_id_seq'::regclass);


--
-- Name: daily_checkins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_checkins ALTER COLUMN id SET DEFAULT nextval('public.daily_checkins_id_seq'::regclass);


--
-- Name: knlg_mentalidade id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knlg_mentalidade ALTER COLUMN id SET DEFAULT nextval('public.knlg_mentalidade_id_seq'::regclass);


--
-- Name: knlg_naturologia id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knlg_naturologia ALTER COLUMN id SET DEFAULT nextval('public.knlg_naturologia_id_seq'::regclass);


--
-- Name: knlg_s_nutrition id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knlg_s_nutrition ALTER COLUMN id SET DEFAULT nextval('public.knlg_s_nutrition_id_seq'::regclass);


--
-- Name: knowledge_db id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_db ALTER COLUMN id SET DEFAULT nextval('public.knowledge_db_id_seq'::regclass);


--
-- Name: pagamento_criado id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagamento_criado ALTER COLUMN id SET DEFAULT nextval('public.pagamento_criado_id_seq'::regclass);


--
-- Name: patient_metrics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_metrics ALTER COLUMN id SET DEFAULT nextval('public.patient_metrics_id_seq'::regclass);


--
-- Name: s_agente_habitos_de_vida_final id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s_agente_habitos_de_vida_final ALTER COLUMN id SET DEFAULT nextval('public.s_agente_6_habitos_de_vida_final_id_seq'::regclass);


--
-- Name: s_agente_limpeza_do_terreno_biologico id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s_agente_limpeza_do_terreno_biologico ALTER COLUMN id SET DEFAULT nextval('public.s_agente_1_limpeza_do_terreno_biologico_id_seq'::regclass);


--
-- Name: s_agente_mentalidade_2 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s_agente_mentalidade_2 ALTER COLUMN id SET DEFAULT nextval('public.s_agente_mentalidade_2_id_seq'::regclass);


--
-- Name: s_suplementacao2 id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s_suplementacao2 ALTER COLUMN id SET DEFAULT nextval('public.s_suplementacao2_id_seq'::regclass);


--
-- Name: a_ambiente_contexto a_ambiente_contexto_consulta_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_ambiente_contexto
    ADD CONSTRAINT a_ambiente_contexto_consulta_id_key UNIQUE (consulta_id);


--
-- Name: a_ambiente_contexto a_ambiente_contexto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_ambiente_contexto
    ADD CONSTRAINT a_ambiente_contexto_pkey PRIMARY KEY (id);


--
-- Name: a_cadastro_anamnese a_cadastro_anamnese_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_cadastro_anamnese
    ADD CONSTRAINT a_cadastro_anamnese_pkey PRIMARY KEY (paciente_id);


--
-- Name: a_cadastro_prontuario a_cadastro_prontuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_cadastro_prontuario
    ADD CONSTRAINT a_cadastro_prontuario_pkey PRIMARY KEY (id);


--
-- Name: a_historia_vida a_historia_vida_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_historia_vida
    ADD CONSTRAINT a_historia_vida_pkey PRIMARY KEY (id);


--
-- Name: a_historico_risco a_historico_risco_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_historico_risco
    ADD CONSTRAINT a_historico_risco_pkey PRIMARY KEY (id);


--
-- Name: a_objetivos_queixas a_objetivos_queixas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_objetivos_queixas
    ADD CONSTRAINT a_objetivos_queixas_pkey PRIMARY KEY (id);


--
-- Name: a_observacao_clinica_lab_2 a_observacao_clinica_lab_2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_observacao_clinica_lab_2
    ADD CONSTRAINT a_observacao_clinica_lab_2_pkey PRIMARY KEY (id);


--
-- Name: a_observacao_clinica_lab a_observacao_clinica_lab_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_observacao_clinica_lab
    ADD CONSTRAINT a_observacao_clinica_lab_pkey PRIMARY KEY (id);


--
-- Name: a_preocupacoes_crencas a_preocupacoes_crencas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_preocupacoes_crencas
    ADD CONSTRAINT a_preocupacoes_crencas_pkey PRIMARY KEY (id);


--
-- Name: a_reino_miasma a_reino_miasma_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_reino_miasma
    ADD CONSTRAINT a_reino_miasma_pkey PRIMARY KEY (id);


--
-- Name: a_sensacao_emocoes a_sensacao_emocoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_sensacao_emocoes
    ADD CONSTRAINT a_sensacao_emocoes_pkey PRIMARY KEY (id);


--
-- Name: a_setenios_eventos a_setenios_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_setenios_eventos
    ADD CONSTRAINT a_setenios_eventos_pkey PRIMARY KEY (id);


--
-- Name: a_sintese_analitica a_sintese_analitica_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_sintese_analitica
    ADD CONSTRAINT a_sintese_analitica_pkey PRIMARY KEY (id);


--
-- Name: ai_pricing ai_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_pricing
    ADD CONSTRAINT ai_pricing_pkey PRIMARY KEY (id);


--
-- Name: alimentos_nutricionais alimentos_nutricionais_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alimentos_nutricionais
    ADD CONSTRAINT alimentos_nutricionais_pkey PRIMARY KEY (table_id);


--
-- Name: assinaturas assinaturas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assinaturas
    ADD CONSTRAINT assinaturas_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: call_sessions call_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_sessions
    ADD CONSTRAINT call_sessions_pkey PRIMARY KEY (id);


--
-- Name: cid10_db cid10_db_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cid10_db
    ADD CONSTRAINT cid10_db_pkey PRIMARY KEY (id);


--
-- Name: clinicas clinicas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinicas
    ADD CONSTRAINT clinicas_pkey PRIMARY KEY (id);


--
-- Name: conexoes_whatsapp conexoes_whatsapp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conexoes_whatsapp
    ADD CONSTRAINT conexoes_whatsapp_pkey PRIMARY KEY (id);


--
-- Name: consent_records consent_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_pkey PRIMARY KEY (id);


--
-- Name: consultations consultations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_pkey PRIMARY KEY (id);


--
-- Name: d_agente_habitos_vida_sistemica d_agente_habitos_vida_sistemica_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.d_agente_habitos_vida_sistemica
    ADD CONSTRAINT d_agente_habitos_vida_sistemica_pkey PRIMARY KEY (id);


--
-- Name: d_agente_integracao_diagnostica d_agente_integracao_diagnostica_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.d_agente_integracao_diagnostica
    ADD CONSTRAINT d_agente_integracao_diagnostica_pkey PRIMARY KEY (id);


--
-- Name: d_diagnostico_principal d_diagnostico_principal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.d_diagnostico_principal
    ADD CONSTRAINT d_diagnostico_principal_pkey PRIMARY KEY (id);


--
-- Name: d_estado_fisiologico d_estado_fisiologico_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.d_estado_fisiologico
    ADD CONSTRAINT d_estado_fisiologico_pkey PRIMARY KEY (id);


--
-- Name: d_estado_geral d_estado_geral_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.d_estado_geral
    ADD CONSTRAINT d_estado_geral_pkey PRIMARY KEY (id);


--
-- Name: d_estado_mental d_estado_mental_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.d_estado_mental
    ADD CONSTRAINT d_estado_mental_pkey1 PRIMARY KEY (id);


--
-- Name: daily_checkins daily_checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_checkins
    ADD CONSTRAINT daily_checkins_pkey PRIMARY KEY (id);


--
-- Name: frutas frutas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.frutas
    ADD CONSTRAINT frutas_pkey PRIMARY KEY (id);


--
-- Name: google_calendar_tokens google_calendar_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_tokens
    ADD CONSTRAINT google_calendar_tokens_pkey PRIMARY KEY (id);


--
-- Name: knlg_mentalidade knlg_mentalidade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knlg_mentalidade
    ADD CONSTRAINT knlg_mentalidade_pkey PRIMARY KEY (id);


--
-- Name: knlg_naturologia knlg_naturologia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knlg_naturologia
    ADD CONSTRAINT knlg_naturologia_pkey PRIMARY KEY (id);


--
-- Name: knlg_s_nutrition knlg_s_nutrition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knlg_s_nutrition
    ADD CONSTRAINT knlg_s_nutrition_pkey PRIMARY KEY (id);


--
-- Name: knowledge_db knowledge_db_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_db
    ADD CONSTRAINT knowledge_db_pkey PRIMARY KEY (id);


--
-- Name: lgpd_requests lgpd_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lgpd_requests
    ADD CONSTRAINT lgpd_requests_pkey PRIMARY KEY (id);


--
-- Name: lista_exercicios_fisicos lista_exercicios_fisicos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lista_exercicios_fisicos
    ADD CONSTRAINT lista_exercicios_fisicos_pkey PRIMARY KEY (id);


--
-- Name: log_erros log_erros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.log_erros
    ADD CONSTRAINT log_erros_pkey PRIMARY KEY (id);


--
-- Name: pagamento_criado pagamento_criado_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagamento_criado
    ADD CONSTRAINT pagamento_criado_event_id_key UNIQUE (event_id);


--
-- Name: pagamento_criado pagamento_criado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagamento_criado
    ADD CONSTRAINT pagamento_criado_pkey PRIMARY KEY (id);


--
-- Name: pagamentos pagamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagamentos
    ADD CONSTRAINT pagamentos_pkey PRIMARY KEY (id);


--
-- Name: patient_metrics patient_metrics_paciente_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_metrics
    ADD CONSTRAINT patient_metrics_paciente_id_key UNIQUE (paciente_id);


--
-- Name: patient_metrics patient_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_metrics
    ADD CONSTRAINT patient_metrics_pkey PRIMARY KEY (id);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: recordings recordings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT recordings_pkey PRIMARY KEY (id);


--
-- Name: reports_consultas reports_consultas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports_consultas
    ADD CONSTRAINT reports_consultas_pkey PRIMARY KEY (id);


--
-- Name: s_agente_limpeza_do_terreno_biologico s_agente_1_limpeza_do_terreno_biologico_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s_agente_limpeza_do_terreno_biologico
    ADD CONSTRAINT s_agente_1_limpeza_do_terreno_biologico_pkey PRIMARY KEY (id);


--
-- Name: s_agente_habitos_de_vida_final s_agente_6_habitos_de_vida_final_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s_agente_habitos_de_vida_final
    ADD CONSTRAINT s_agente_6_habitos_de_vida_final_pkey PRIMARY KEY (id);


--
-- Name: s_agente_mentalidade_2 s_agente_mentalidade_2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s_agente_mentalidade_2
    ADD CONSTRAINT s_agente_mentalidade_2_pkey PRIMARY KEY (id);


--
-- Name: s_exercicios_fisicos s_exercicios_fisicos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s_exercicios_fisicos
    ADD CONSTRAINT s_exercicios_fisicos_pkey PRIMARY KEY (id);


--
-- Name: s_gramaturas_alimentares s_gramaturas_alimentares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s_gramaturas_alimentares
    ADD CONSTRAINT s_gramaturas_alimentares_pkey PRIMARY KEY (id, paciente_id);


--
-- Name: s_refeicao s_refeicao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s_refeicao
    ADD CONSTRAINT s_refeicao_pkey PRIMARY KEY (id);


--
-- Name: s_selects_alimentos s_selects_alimentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s_selects_alimentos
    ADD CONSTRAINT s_selects_alimentos_pkey PRIMARY KEY (id);


--
-- Name: s_suplementacao2 s_suplementacao2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s_suplementacao2
    ADD CONSTRAINT s_suplementacao2_pkey PRIMARY KEY (id);


--
-- Name: status_agentes status_agentes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_agentes
    ADD CONSTRAINT status_agentes_pkey PRIMARY KEY (id);


--
-- Name: status_agentes_solucao status_agentes_solucao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_agentes_solucao
    ADD CONSTRAINT status_agentes_solucao_pkey PRIMARY KEY (id);


--
-- Name: suggestions suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestions
    ADD CONSTRAINT suggestions_pkey PRIMARY KEY (id);


--
-- Name: transcriptions transcriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcriptions
    ADD CONSTRAINT transcriptions_pkey PRIMARY KEY (id);


--
-- Name: a_ambiente_contexto uk_a_ambiente_contexto_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_ambiente_contexto
    ADD CONSTRAINT uk_a_ambiente_contexto_consulta UNIQUE (consulta_id);


--
-- Name: a_cadastro_prontuario uk_a_cadastro_prontuario_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_cadastro_prontuario
    ADD CONSTRAINT uk_a_cadastro_prontuario_consulta UNIQUE (consulta_id);


--
-- Name: a_historia_vida uk_a_historia_vida_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_historia_vida
    ADD CONSTRAINT uk_a_historia_vida_consulta UNIQUE (consulta_id);


--
-- Name: a_historico_risco uk_a_historico_risco_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_historico_risco
    ADD CONSTRAINT uk_a_historico_risco_consulta UNIQUE (consulta_id);


--
-- Name: a_objetivos_queixas uk_a_objetivos_queixas_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_objetivos_queixas
    ADD CONSTRAINT uk_a_objetivos_queixas_consulta UNIQUE (consulta_id);


--
-- Name: a_observacao_clinica_lab_2 uk_a_observacao_clinica_lab_2_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_observacao_clinica_lab_2
    ADD CONSTRAINT uk_a_observacao_clinica_lab_2_consulta UNIQUE (consulta_id);


--
-- Name: a_observacao_clinica_lab uk_a_observacao_clinica_lab_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_observacao_clinica_lab
    ADD CONSTRAINT uk_a_observacao_clinica_lab_consulta UNIQUE (consulta_id);


--
-- Name: a_preocupacoes_crencas uk_a_preocupacoes_crencas_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_preocupacoes_crencas
    ADD CONSTRAINT uk_a_preocupacoes_crencas_consulta UNIQUE (consulta_id);


--
-- Name: a_reino_miasma uk_a_reino_miasma_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_reino_miasma
    ADD CONSTRAINT uk_a_reino_miasma_consulta UNIQUE (consulta_id);


--
-- Name: a_sensacao_emocoes uk_a_sensacao_emocoes_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_sensacao_emocoes
    ADD CONSTRAINT uk_a_sensacao_emocoes_consulta UNIQUE (consulta_id);


--
-- Name: a_setenios_eventos uk_a_setenios_eventos_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_setenios_eventos
    ADD CONSTRAINT uk_a_setenios_eventos_consulta UNIQUE (consulta_id);


--
-- Name: a_sintese_analitica uk_a_sintese_analitica_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.a_sintese_analitica
    ADD CONSTRAINT uk_a_sintese_analitica_consulta UNIQUE (consulta_id);


--
-- Name: d_agente_habitos_vida_sistemica uk_d_agente_habitos_vida_sistemica_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.d_agente_habitos_vida_sistemica
    ADD CONSTRAINT uk_d_agente_habitos_vida_sistemica_consulta UNIQUE (consulta_id);


--
-- Name: d_agente_integracao_diagnostica uk_d_agente_integracao_diagnostica_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.d_agente_integracao_diagnostica
    ADD CONSTRAINT uk_d_agente_integracao_diagnostica_consulta UNIQUE (consulta_id);


--
-- Name: d_diagnostico_principal uk_d_diagnostico_principal_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.d_diagnostico_principal
    ADD CONSTRAINT uk_d_diagnostico_principal_consulta UNIQUE (consulta_id);


--
-- Name: d_estado_fisiologico uk_d_estado_fisiologico_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.d_estado_fisiologico
    ADD CONSTRAINT uk_d_estado_fisiologico_consulta UNIQUE (consulta_id);


--
-- Name: d_estado_geral uk_d_estado_geral_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.d_estado_geral
    ADD CONSTRAINT uk_d_estado_geral_consulta UNIQUE (consulta_id);


--
-- Name: d_estado_mental uk_d_estado_mental_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.d_estado_mental
    ADD CONSTRAINT uk_d_estado_mental_consulta UNIQUE (consulta_id);


--
-- Name: s_agente_habitos_de_vida_final uk_s_agente_habitos_vida_final_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s_agente_habitos_de_vida_final
    ADD CONSTRAINT uk_s_agente_habitos_vida_final_consulta UNIQUE (consulta_id);


--
-- Name: s_agente_limpeza_do_terreno_biologico uk_s_agente_limpeza_terreno_bio_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s_agente_limpeza_do_terreno_biologico
    ADD CONSTRAINT uk_s_agente_limpeza_terreno_bio_consulta UNIQUE (consulta_id);


--
-- Name: s_agente_mentalidade_2 uk_s_agente_mentalidade_2_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s_agente_mentalidade_2
    ADD CONSTRAINT uk_s_agente_mentalidade_2_consulta UNIQUE (consulta_id);


--
-- Name: s_suplementacao2 uk_s_suplementacao2_consulta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s_suplementacao2
    ADD CONSTRAINT uk_s_suplementacao2_consulta UNIQUE (consulta_id);


--
-- Name: daily_checkins unique_checkin_per_day; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_checkins
    ADD CONSTRAINT unique_checkin_per_day UNIQUE (paciente_id, data_checkin);


--
-- Name: google_calendar_tokens unique_medico_google_calendar; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_tokens
    ADD CONSTRAINT unique_medico_google_calendar UNIQUE (medico_id);


--
-- Name: medicos users_cpf_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medicos
    ADD CONSTRAINT users_cpf_key UNIQUE (cpf);


--
-- Name: medicos users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medicos
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: medicos users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medicos
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: transcriptions_med utterances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcriptions_med
    ADD CONSTRAINT utterances_pkey PRIMARY KEY (id);


--
-- Name: agente_hvs_consulta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agente_hvs_consulta_idx ON public.d_agente_habitos_vida_sistemica USING btree (consulta_id);


--
-- Name: agente_hvs_paciente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agente_hvs_paciente_idx ON public.d_agente_habitos_vida_sistemica USING btree (paciente_id);


--
-- Name: agente_integracao_diagnostica_consulta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agente_integracao_diagnostica_consulta_idx ON public.d_agente_integracao_diagnostica USING btree (consulta_id);


--
-- Name: agente_integracao_diagnostica_paciente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agente_integracao_diagnostica_paciente_idx ON public.d_agente_integracao_diagnostica USING btree (paciente_id);


--
-- Name: idx_ai_pricing_consulta_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_pricing_consulta_id ON public.ai_pricing USING btree (consulta_id);


--
-- Name: idx_ai_pricing_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_pricing_created_at ON public.ai_pricing USING btree (created_at DESC);


--
-- Name: idx_anamnese_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anamnese_status ON public.a_cadastro_anamnese USING btree (status);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_contains_sensitive; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_contains_sensitive ON public.audit_logs USING btree (contains_sensitive_data);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_created_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at_desc ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_data_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_data_category ON public.audit_logs USING btree (data_category);


--
-- Name: idx_audit_logs_ip_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_ip_address ON public.audit_logs USING btree (ip_address);


--
-- Name: idx_audit_logs_related_consultation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_related_consultation ON public.audit_logs USING btree (related_consultation_id);


--
-- Name: idx_audit_logs_related_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_related_patient ON public.audit_logs USING btree (related_patient_id);


--
-- Name: idx_audit_logs_resource_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_resource_id ON public.audit_logs USING btree (resource_id);


--
-- Name: idx_audit_logs_resource_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_resource_type ON public.audit_logs USING btree (resource_type);


--
-- Name: idx_audit_logs_success; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_success ON public.audit_logs USING btree (success);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_audit_logs_user_resource_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_resource_time ON public.audit_logs USING btree (user_id, resource_type, created_at DESC);


--
-- Name: idx_call_sessions_consultation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_call_sessions_consultation_id ON public.call_sessions USING btree (consultation_id);


--
-- Name: idx_call_sessions_room_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_call_sessions_room_name ON public.call_sessions USING btree (room_name);


--
-- Name: idx_call_sessions_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_call_sessions_started_at ON public.call_sessions USING btree (started_at);


--
-- Name: idx_call_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_call_sessions_status ON public.call_sessions USING btree (status);


--
-- Name: idx_call_sessions_webrtc_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_call_sessions_webrtc_active ON public.call_sessions USING btree (webrtc_active) WHERE (webrtc_active = true);


--
-- Name: idx_consent_records_consent_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_records_consent_type ON public.consent_records USING btree (consent_type);


--
-- Name: idx_consent_records_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_records_email ON public.consent_records USING btree (email);


--
-- Name: idx_consent_records_granted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_records_granted ON public.consent_records USING btree (granted);


--
-- Name: idx_consent_records_patient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_records_patient_id ON public.consent_records USING btree (patient_id);


--
-- Name: idx_consent_records_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_records_user_id ON public.consent_records USING btree (user_id);


--
-- Name: idx_consultations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultations_created_at ON public.consultations USING btree (created_at);


--
-- Name: idx_consultations_doctor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultations_doctor_id ON public.consultations USING btree (doctor_id);


--
-- Name: idx_consultations_google_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultations_google_event_id ON public.consultations USING btree (google_event_id);


--
-- Name: idx_consultations_patient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultations_patient_id ON public.consultations USING btree (patient_id);


--
-- Name: idx_consultations_patient_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultations_patient_name ON public.consultations USING btree (patient_name);


--
-- Name: idx_consultations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultations_status ON public.consultations USING btree (status);


--
-- Name: idx_consultations_sync_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consultations_sync_status ON public.consultations USING btree (sync_status);


--
-- Name: idx_daily_checkins_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_checkins_data ON public.daily_checkins USING btree (data_checkin DESC);


--
-- Name: idx_daily_checkins_paciente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_checkins_paciente ON public.daily_checkins USING btree (paciente_id);


--
-- Name: idx_google_calendar_tokens_medico_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_google_calendar_tokens_medico_id ON public.google_calendar_tokens USING btree (medico_id);


--
-- Name: idx_google_calendar_tokens_sync_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_google_calendar_tokens_sync_enabled ON public.google_calendar_tokens USING btree (sync_enabled);


--
-- Name: idx_habitos_consulta_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_habitos_consulta_id ON public.s_agente_habitos_de_vida_final USING btree (consulta_id);


--
-- Name: idx_habitos_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_habitos_created_at ON public.s_agente_habitos_de_vida_final USING btree (created_at DESC);


--
-- Name: idx_habitos_paciente_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_habitos_paciente_id ON public.s_agente_habitos_de_vida_final USING btree (paciente_id);


--
-- Name: idx_habitos_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_habitos_status ON public.s_agente_habitos_de_vida_final USING btree (status);


--
-- Name: idx_habitos_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_habitos_user_id ON public.s_agente_habitos_de_vida_final USING btree (user_id);


--
-- Name: idx_lgpd_requests_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lgpd_requests_created_at ON public.lgpd_requests USING btree (created_at);


--
-- Name: idx_lgpd_requests_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lgpd_requests_deadline ON public.lgpd_requests USING btree (deadline_at);


--
-- Name: idx_lgpd_requests_request_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lgpd_requests_request_type ON public.lgpd_requests USING btree (request_type);


--
-- Name: idx_lgpd_requests_requester_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lgpd_requests_requester_email ON public.lgpd_requests USING btree (requester_email);


--
-- Name: idx_lgpd_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lgpd_requests_status ON public.lgpd_requests USING btree (status);


--
-- Name: idx_lista_exercicios_atividade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lista_exercicios_atividade ON public.lista_exercicios_fisicos USING gin (to_tsvector('portuguese'::regconfig, atividade));


--
-- Name: idx_lista_exercicios_atividade_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lista_exercicios_atividade_lower ON public.lista_exercicios_fisicos USING btree (lower(atividade));


--
-- Name: idx_medicos_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medicos_email ON public.medicos USING btree (email);


--
-- Name: idx_medicos_user_auth; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medicos_user_auth ON public.medicos USING btree (user_auth);


--
-- Name: idx_pagamento_criado_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagamento_criado_customer_id ON public.pagamento_criado USING btree (customer_id);


--
-- Name: idx_pagamento_criado_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagamento_criado_due_date ON public.pagamento_criado USING btree (due_date);


--
-- Name: idx_pagamento_criado_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagamento_criado_payment_id ON public.pagamento_criado USING btree (payment_id);


--
-- Name: idx_pagamento_criado_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagamento_criado_status ON public.pagamento_criado USING btree (status);


--
-- Name: idx_patient_metrics_paciente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_metrics_paciente ON public.patient_metrics USING btree (paciente_id);


--
-- Name: idx_patients_doctor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_doctor_id ON public.patients USING btree (doctor_id);


--
-- Name: idx_patients_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_name ON public.patients USING btree (name);


--
-- Name: idx_patients_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_status ON public.patients USING btree (status);


--
-- Name: idx_patients_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_user_status ON public.patients USING btree (user_status);


--
-- Name: idx_recordings_consultation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recordings_consultation_id ON public.recordings USING btree (consultation_id);


--
-- Name: idx_recordings_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recordings_created_at ON public.recordings USING btree (created_at DESC);


--
-- Name: idx_recordings_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recordings_session_id ON public.recordings USING btree (session_id);


--
-- Name: idx_recordings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recordings_status ON public.recordings USING btree (status);


--
-- Name: idx_reports_consultas_clinica_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_consultas_clinica_id ON public.reports_consultas USING btree (clinica_id);


--
-- Name: idx_reports_consultas_consulta_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_consultas_consulta_id ON public.reports_consultas USING btree (consulta_id);


--
-- Name: idx_reports_consultas_consulta_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_consultas_consulta_resolved ON public.reports_consultas USING btree (consulta_id, resolved);


--
-- Name: idx_reports_consultas_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_consultas_created_at ON public.reports_consultas USING btree (created_at DESC);


--
-- Name: idx_reports_consultas_etapa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_consultas_etapa ON public.reports_consultas USING btree (etapa);


--
-- Name: idx_reports_consultas_resolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_consultas_resolved ON public.reports_consultas USING btree (resolved);


--
-- Name: idx_reports_consultas_unique_error; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_reports_consultas_unique_error ON public.reports_consultas USING btree (error_hash, resolved) WHERE (resolved = false);


--
-- Name: idx_suggestions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suggestions_created_at ON public.suggestions USING btree (created_at);


--
-- Name: idx_suggestions_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suggestions_priority ON public.suggestions USING btree (priority);


--
-- Name: idx_suggestions_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suggestions_session_id ON public.suggestions USING btree (session_id);


--
-- Name: idx_suggestions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suggestions_type ON public.suggestions USING btree (type);


--
-- Name: idx_suggestions_used; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suggestions_used ON public.suggestions USING btree (used);


--
-- Name: idx_suggestions_utterance_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suggestions_utterance_id ON public.suggestions USING btree (utterance_id);


--
-- Name: idx_transcriptions_consultation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transcriptions_consultation_id ON public.transcriptions USING btree (consultation_id);


--
-- Name: idx_transcriptions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transcriptions_created_at ON public.transcriptions USING btree (created_at);


--
-- Name: idx_transcriptions_med_doctor_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transcriptions_med_doctor_name ON public.transcriptions_med USING btree (doctor_name);


--
-- Name: idx_utterances_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_utterances_created_at ON public.transcriptions_med USING btree (created_at);


--
-- Name: idx_utterances_is_final; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_utterances_is_final ON public.transcriptions_med USING btree (is_final);


--
-- Name: idx_utterances_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_utterances_session_id ON public.transcriptions_med USING btree (session_id);


--
-- Name: idx_utterances_speaker; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_utterances_speaker ON public.transcriptions_med USING btree (speaker);


--
-- Name: idx_utterances_timing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_utterances_timing ON public.transcriptions_med USING btree (start_ms, end_ms);


--
-- Name: daily_checkins after_checkin_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_checkin_insert AFTER INSERT ON public.daily_checkins FOR EACH ROW EXECUTE FUNCTION public.trigger_calculate_metrics();


--
-- Name: pagamento_criado trg_pagamento_criado_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pagamento_criado_updated_at BEFORE UPDATE ON public.pagamento_criado FOR EACH ROW EXECUTE FUNCTION public.update_pagamento_criado_updated_at();


--
-- Name: recordings trigger_recordings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_recordings_updated_at BEFORE UPDATE ON public.recordings FOR EACH ROW EXECUTE FUNCTION public.update_recordings_updated_at();


--
-- Name: a_cadastro_anamnese trigger_update_anamnese_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_anamnese_updated_at BEFORE UPDATE ON public.a_cadastro_anamnese FOR EACH ROW EXECUTE FUNCTION public.update_anamnese_updated_at();


--
-- Name: call_sessions update_call_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_call_sessions_updated_at BEFORE UPDATE ON public.call_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: consent_records update_consent_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_consent_records_updated_at BEFORE UPDATE ON public.consent_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: consultations update_consultations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_consultations_updated_at BEFORE UPDATE ON public.consultations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: google_calendar_tokens update_google_calendar_tokens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_google_calendar_tokens_updated_at BEFORE UPDATE ON public.google_calendar_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lgpd_requests update_lgpd_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lgpd_requests_updated_at BEFORE UPDATE ON public.lgpd_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: patients update_patients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: medicos update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.medicos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: call_sessions call_sessions_consultation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_sessions
    ADD CONSTRAINT call_sessions_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE SET NULL;


--
-- Name: clinicas clinicas_user_auth_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinicas
    ADD CONSTRAINT clinicas_user_auth_fkey FOREIGN KEY (user_auth) REFERENCES auth.users(id);


--
-- Name: consultations consultations_clinica_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id);


--
-- Name: consultations consultations_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.medicos(id) ON DELETE CASCADE;


--
-- Name: consultations consultations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: google_calendar_tokens google_calendar_tokens_medico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_calendar_tokens
    ADD CONSTRAINT google_calendar_tokens_medico_id_fkey FOREIGN KEY (medico_id) REFERENCES public.medicos(id) ON DELETE CASCADE;


--
-- Name: medicos medicos_clinica_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medicos
    ADD CONSTRAINT medicos_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id);


--
-- Name: medicos medicos_user_auth_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medicos
    ADD CONSTRAINT medicos_user_auth_fkey FOREIGN KEY (user_auth) REFERENCES auth.users(id);


--
-- Name: patients patients_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.medicos(id) ON DELETE CASCADE;


--
-- Name: patients patients_user_auth_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_user_auth_fkey FOREIGN KEY (user_auth) REFERENCES auth.users(id);


--
-- Name: recordings recordings_consultation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT recordings_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE SET NULL;


--
-- Name: recordings recordings_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT recordings_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.call_sessions(id) ON DELETE CASCADE;


--
-- Name: reports_consultas reports_consultas_clinica_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports_consultas
    ADD CONSTRAINT reports_consultas_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES public.clinicas(id) ON DELETE SET NULL;


--
-- Name: reports_consultas reports_consultas_consulta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports_consultas
    ADD CONSTRAINT reports_consultas_consulta_id_fkey FOREIGN KEY (consulta_id) REFERENCES public.consultations(id) ON DELETE CASCADE;


--
-- Name: reports_consultas reports_consultas_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports_consultas
    ADD CONSTRAINT reports_consultas_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.medicos(id) ON DELETE SET NULL;


--
-- Name: reports_consultas reports_consultas_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports_consultas
    ADD CONSTRAINT reports_consultas_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES public.patients(id) ON DELETE SET NULL;


--
-- Name: s_refeicao s_refeicao_paciente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.s_refeicao
    ADD CONSTRAINT s_refeicao_paciente_fkey FOREIGN KEY (paciente) REFERENCES public.patients(id);


--
-- Name: suggestions suggestions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestions
    ADD CONSTRAINT suggestions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.call_sessions(id) ON DELETE CASCADE;


--
-- Name: suggestions suggestions_utterance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggestions
    ADD CONSTRAINT suggestions_utterance_id_fkey FOREIGN KEY (utterance_id) REFERENCES public.transcriptions_med(id) ON DELETE SET NULL;


--
-- Name: transcriptions transcriptions_consultation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcriptions
    ADD CONSTRAINT transcriptions_consultation_id_fkey FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE CASCADE;


--
-- Name: transcriptions_med utterances_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transcriptions_med
    ADD CONSTRAINT utterances_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.call_sessions(id) ON DELETE CASCADE;


--
-- Name: lgpd_requests Admins can manage LGPD requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage LGPD requests" ON public.lgpd_requests USING ((EXISTS ( SELECT 1
   FROM public.medicos
  WHERE ((medicos.user_auth = auth.uid()) AND (medicos.admin = true)))));


--
-- Name: audit_logs Admins can read audit_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read audit_logs" ON public.audit_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.medicos
  WHERE ((medicos.user_auth = auth.uid()) AND (medicos.admin = true)))));


--
-- Name: transcriptions_med Allow inserts for existing sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow inserts for existing sessions" ON public.transcriptions_med FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.call_sessions
  WHERE (call_sessions.id = transcriptions_med.session_id))));


--
-- Name: transcriptions_med Allow selects on transcriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow selects on transcriptions" ON public.transcriptions_med FOR SELECT USING (true);


--
-- Name: transcriptions_med Allow service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow service role full access" ON public.transcriptions_med USING (true) WITH CHECK (true);


--
-- Name: transcriptions_med Allow updates to transcriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow updates to transcriptions" ON public.transcriptions_med FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: consultations Doctors can delete own consultations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can delete own consultations" ON public.consultations FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.medicos
  WHERE ((medicos.id = consultations.doctor_id) AND (medicos.user_auth = auth.uid())))));


--
-- Name: patients Doctors can delete own patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can delete own patients" ON public.patients FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.medicos
  WHERE ((medicos.id = patients.doctor_id) AND (medicos.user_auth = auth.uid())))));


--
-- Name: transcriptions Doctors can delete own transcriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can delete own transcriptions" ON public.transcriptions FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.consultations c
     JOIN public.medicos m ON ((m.id = c.doctor_id)))
  WHERE ((c.id = transcriptions.consultation_id) AND (m.user_auth = auth.uid())))));


--
-- Name: consultations Doctors can insert own consultations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can insert own consultations" ON public.consultations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.medicos
  WHERE ((medicos.id = consultations.doctor_id) AND (medicos.user_auth = auth.uid())))));


--
-- Name: patients Doctors can insert own patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can insert own patients" ON public.patients FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.medicos
  WHERE ((medicos.id = patients.doctor_id) AND (medicos.user_auth = auth.uid())))));


--
-- Name: transcriptions Doctors can insert own transcriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can insert own transcriptions" ON public.transcriptions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.consultations c
     JOIN public.medicos m ON ((m.id = c.doctor_id)))
  WHERE ((c.id = transcriptions.consultation_id) AND (m.user_auth = auth.uid())))));


--
-- Name: consultations Doctors can update own consultations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can update own consultations" ON public.consultations FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.medicos
  WHERE ((medicos.id = consultations.doctor_id) AND (medicos.user_auth = auth.uid())))));


--
-- Name: patients Doctors can update own patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can update own patients" ON public.patients FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.medicos
  WHERE ((medicos.id = patients.doctor_id) AND (medicos.user_auth = auth.uid())))));


--
-- Name: transcriptions Doctors can update own transcriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can update own transcriptions" ON public.transcriptions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.consultations c
     JOIN public.medicos m ON ((m.id = c.doctor_id)))
  WHERE ((c.id = transcriptions.consultation_id) AND (m.user_auth = auth.uid())))));


--
-- Name: consultations Doctors can view own consultations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view own consultations" ON public.consultations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.medicos
  WHERE ((medicos.id = consultations.doctor_id) AND (medicos.user_auth = auth.uid())))));


--
-- Name: patients Doctors can view own patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view own patients" ON public.patients FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.medicos
  WHERE ((medicos.id = patients.doctor_id) AND (medicos.user_auth = auth.uid())))));


--
-- Name: transcriptions Doctors can view own transcriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view own transcriptions" ON public.transcriptions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.consultations c
     JOIN public.medicos m ON ((m.id = c.doctor_id)))
  WHERE ((c.id = transcriptions.consultation_id) AND (m.user_auth = auth.uid())))));


--
-- Name: patients Medicos can create patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Medicos can create patients" ON public.patients FOR INSERT WITH CHECK ((doctor_id IN ( SELECT medicos.id
   FROM public.medicos
  WHERE (medicos.user_auth = auth.uid()))));


--
-- Name: google_calendar_tokens Medicos can delete own google calendar tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Medicos can delete own google calendar tokens" ON public.google_calendar_tokens FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.medicos
  WHERE ((medicos.id = google_calendar_tokens.medico_id) AND (medicos.user_auth = auth.uid())))));


--
-- Name: patients Medicos can delete own patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Medicos can delete own patients" ON public.patients FOR DELETE USING ((doctor_id IN ( SELECT medicos.id
   FROM public.medicos
  WHERE (medicos.user_auth = auth.uid()))));


--
-- Name: google_calendar_tokens Medicos can insert own google calendar tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Medicos can insert own google calendar tokens" ON public.google_calendar_tokens FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.medicos
  WHERE ((medicos.id = google_calendar_tokens.medico_id) AND (medicos.user_auth = auth.uid())))));


--
-- Name: medicos Medicos can insert own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Medicos can insert own record" ON public.medicos FOR INSERT WITH CHECK ((user_auth = auth.uid()));


--
-- Name: google_calendar_tokens Medicos can update own google calendar tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Medicos can update own google calendar tokens" ON public.google_calendar_tokens FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.medicos
  WHERE ((medicos.id = google_calendar_tokens.medico_id) AND (medicos.user_auth = auth.uid())))));


--
-- Name: patients Medicos can update own patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Medicos can update own patients" ON public.patients FOR UPDATE USING ((doctor_id IN ( SELECT medicos.id
   FROM public.medicos
  WHERE (medicos.user_auth = auth.uid()))));


--
-- Name: medicos Medicos can update own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Medicos can update own record" ON public.medicos FOR UPDATE USING ((user_auth = auth.uid()));


--
-- Name: google_calendar_tokens Medicos can view own google calendar tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Medicos can view own google calendar tokens" ON public.google_calendar_tokens FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.medicos
  WHERE ((medicos.id = google_calendar_tokens.medico_id) AND (medicos.user_auth = auth.uid())))));


--
-- Name: patients Medicos can view own patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Medicos can view own patients" ON public.patients FOR SELECT USING ((doctor_id IN ( SELECT medicos.id
   FROM public.medicos
  WHERE (medicos.user_auth = auth.uid()))));


--
-- Name: medicos Medicos can view own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Medicos can view own record" ON public.medicos FOR SELECT USING ((user_auth = auth.uid()));


--
-- Name: s_refeicao Pacientes leem suas refeições; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Pacientes leem suas refeições" ON public.s_refeicao FOR SELECT USING ((paciente IN ( SELECT patients.id
   FROM public.patients
  WHERE (patients.user_auth = auth.uid()))));


--
-- Name: patient_metrics Pacientes podem atualizar métricas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Pacientes podem atualizar métricas" ON public.patient_metrics FOR UPDATE USING ((paciente_id IN ( SELECT patients.id
   FROM public.patients
  WHERE (patients.user_auth = auth.uid())))) WITH CHECK ((paciente_id IN ( SELECT patients.id
   FROM public.patients
  WHERE (patients.user_auth = auth.uid()))));


--
-- Name: daily_checkins Pacientes podem inserir check-ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Pacientes podem inserir check-ins" ON public.daily_checkins FOR INSERT WITH CHECK ((paciente_id IN ( SELECT patients.id
   FROM public.patients
  WHERE (patients.user_auth = auth.uid()))));


--
-- Name: patient_metrics Pacientes podem inserir métricas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Pacientes podem inserir métricas" ON public.patient_metrics FOR INSERT WITH CHECK ((paciente_id IN ( SELECT patients.id
   FROM public.patients
  WHERE (patients.user_auth = auth.uid()))));


--
-- Name: daily_checkins Pacientes podem ver check-ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Pacientes podem ver check-ins" ON public.daily_checkins FOR SELECT USING ((paciente_id IN ( SELECT patients.id
   FROM public.patients
  WHERE (patients.user_auth = auth.uid()))));


--
-- Name: patient_metrics Pacientes podem ver métricas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Pacientes podem ver métricas" ON public.patient_metrics FOR SELECT USING ((paciente_id IN ( SELECT patients.id
   FROM public.patients
  WHERE (patients.user_auth = auth.uid()))));


--
-- Name: a_ambiente_contexto Permitir insert para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir insert para usuarios autenticados" ON public.a_ambiente_contexto FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: a_cadastro_prontuario Permitir insert para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir insert para usuarios autenticados" ON public.a_cadastro_prontuario FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: a_historia_vida Permitir insert para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir insert para usuarios autenticados" ON public.a_historia_vida FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: a_historico_risco Permitir insert para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir insert para usuarios autenticados" ON public.a_historico_risco FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: a_observacao_clinica_lab Permitir insert para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir insert para usuarios autenticados" ON public.a_observacao_clinica_lab FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: a_preocupacoes_crencas Permitir insert para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir insert para usuarios autenticados" ON public.a_preocupacoes_crencas FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: a_reino_miasma Permitir insert para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir insert para usuarios autenticados" ON public.a_reino_miasma FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: a_sensacao_emocoes Permitir insert para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir insert para usuarios autenticados" ON public.a_sensacao_emocoes FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: a_setenios_eventos Permitir insert para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir insert para usuarios autenticados" ON public.a_setenios_eventos FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: a_ambiente_contexto Permitir leitura para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura para usuarios autenticados" ON public.a_ambiente_contexto FOR SELECT TO authenticated USING (true);


--
-- Name: a_cadastro_prontuario Permitir leitura para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura para usuarios autenticados" ON public.a_cadastro_prontuario FOR SELECT TO authenticated USING (true);


--
-- Name: a_historia_vida Permitir leitura para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura para usuarios autenticados" ON public.a_historia_vida FOR SELECT TO authenticated USING (true);


--
-- Name: a_historico_risco Permitir leitura para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura para usuarios autenticados" ON public.a_historico_risco FOR SELECT TO authenticated USING (true);


--
-- Name: a_observacao_clinica_lab Permitir leitura para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura para usuarios autenticados" ON public.a_observacao_clinica_lab FOR SELECT TO authenticated USING (true);


--
-- Name: a_preocupacoes_crencas Permitir leitura para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura para usuarios autenticados" ON public.a_preocupacoes_crencas FOR SELECT TO authenticated USING (true);


--
-- Name: a_reino_miasma Permitir leitura para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura para usuarios autenticados" ON public.a_reino_miasma FOR SELECT TO authenticated USING (true);


--
-- Name: a_sensacao_emocoes Permitir leitura para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura para usuarios autenticados" ON public.a_sensacao_emocoes FOR SELECT TO authenticated USING (true);


--
-- Name: a_setenios_eventos Permitir leitura para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura para usuarios autenticados" ON public.a_setenios_eventos FOR SELECT TO authenticated USING (true);


--
-- Name: a_ambiente_contexto Permitir update para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir update para usuarios autenticados" ON public.a_ambiente_contexto FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: a_cadastro_prontuario Permitir update para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir update para usuarios autenticados" ON public.a_cadastro_prontuario FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: a_historia_vida Permitir update para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir update para usuarios autenticados" ON public.a_historia_vida FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: a_historico_risco Permitir update para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir update para usuarios autenticados" ON public.a_historico_risco FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: a_observacao_clinica_lab Permitir update para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir update para usuarios autenticados" ON public.a_observacao_clinica_lab FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: a_preocupacoes_crencas Permitir update para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir update para usuarios autenticados" ON public.a_preocupacoes_crencas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: a_reino_miasma Permitir update para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir update para usuarios autenticados" ON public.a_reino_miasma FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: a_sensacao_emocoes Permitir update para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir update para usuarios autenticados" ON public.a_sensacao_emocoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: a_setenios_eventos Permitir update para usuarios autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir update para usuarios autenticados" ON public.a_setenios_eventos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: audit_logs Service role can manage audit_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage audit_logs" ON public.audit_logs USING ((auth.role() = 'service_role'::text));


--
-- Name: consent_records Service role can manage consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage consents" ON public.consent_records USING ((auth.role() = 'service_role'::text));


--
-- Name: lgpd_requests Users can create LGPD requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create LGPD requests" ON public.lgpd_requests FOR INSERT WITH CHECK ((requester_user_id = auth.uid()));


--
-- Name: call_sessions Users can insert sessions for their consultations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert sessions for their consultations" ON public.call_sessions FOR INSERT WITH CHECK (((consultation_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.consultations
  WHERE ((consultations.id = call_sessions.consultation_id) AND ((consultations.doctor_id)::text = (auth.uid())::text))))));


--
-- Name: suggestions Users can insert suggestions in their sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert suggestions in their sessions" ON public.suggestions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.call_sessions cs
     LEFT JOIN public.consultations c ON ((cs.consultation_id = c.id)))
  WHERE ((cs.id = suggestions.session_id) AND ((cs.consultation_id IS NULL) OR ((c.doctor_id)::text = (auth.uid())::text))))));


--
-- Name: transcriptions_med Users can insert utterances in their sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert utterances in their sessions" ON public.transcriptions_med FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.call_sessions cs
     LEFT JOIN public.consultations c ON ((cs.consultation_id = c.id)))
  WHERE ((cs.id = transcriptions_med.session_id) AND ((cs.consultation_id IS NULL) OR ((c.doctor_id)::text = (auth.uid())::text))))));


--
-- Name: consent_records Users can manage their own consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own consents" ON public.consent_records USING ((user_id = auth.uid()));


--
-- Name: suggestions Users can update suggestions in their sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update suggestions in their sessions" ON public.suggestions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.call_sessions cs
     LEFT JOIN public.consultations c ON ((cs.consultation_id = c.id)))
  WHERE ((cs.id = suggestions.session_id) AND ((cs.consultation_id IS NULL) OR ((c.doctor_id)::text = (auth.uid())::text))))));


--
-- Name: call_sessions Users can update their sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their sessions" ON public.call_sessions FOR UPDATE USING (((consultation_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.consultations
  WHERE ((consultations.id = call_sessions.consultation_id) AND ((consultations.doctor_id)::text = (auth.uid())::text))))));


--
-- Name: call_sessions Users can view sessions from their consultations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view sessions from their consultations" ON public.call_sessions FOR SELECT USING (((consultation_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.consultations
  WHERE ((consultations.id = call_sessions.consultation_id) AND ((consultations.doctor_id)::text = (auth.uid())::text))))));


--
-- Name: suggestions Users can view suggestions from their sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view suggestions from their sessions" ON public.suggestions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.call_sessions cs
     LEFT JOIN public.consultations c ON ((cs.consultation_id = c.id)))
  WHERE ((cs.id = suggestions.session_id) AND ((cs.consultation_id IS NULL) OR ((c.doctor_id)::text = (auth.uid())::text))))));


--
-- Name: lgpd_requests Users can view their own LGPD requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own LGPD requests" ON public.lgpd_requests FOR SELECT USING ((requester_user_id = auth.uid()));


--
-- Name: consent_records Users can view their own consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own consents" ON public.consent_records FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: transcriptions_med Users can view utterances from their sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view utterances from their sessions" ON public.transcriptions_med FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.call_sessions cs
     LEFT JOIN public.consultations c ON ((cs.consultation_id = c.id)))
  WHERE ((cs.id = transcriptions_med.session_id) AND ((cs.consultation_id IS NULL) OR ((c.doctor_id)::text = (auth.uid())::text))))));


--
-- Name: lista_exercicios_fisicos Usuários autenticados podem ler exercícios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários autenticados podem ler exercícios" ON public.lista_exercicios_fisicos FOR SELECT TO authenticated USING (true);


--
-- Name: clinicas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinicas ENABLE ROW LEVEL SECURITY;

--
-- Name: conexoes_whatsapp; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conexoes_whatsapp ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_checkins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

--
-- Name: frutas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.frutas ENABLE ROW LEVEL SECURITY;

--
-- Name: s_exercicios_fisicos geral; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY geral ON public.s_exercicios_fisicos USING (true) WITH CHECK (true);


--
-- Name: llm_pricing; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.llm_pricing ENABLE ROW LEVEL SECURITY;

--
-- Name: pagamentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: s_refeicao; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.s_refeicao ENABLE ROW LEVEL SECURITY;

--
-- Name: s_selects_alimentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.s_selects_alimentos ENABLE ROW LEVEL SECURITY;

--
-- Name: transcriptions_med; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transcriptions_med ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict QSD5ZWhSN3amGIWplbxZ2nGegxNHLWiILYYz3V59hduA5hU8o5LxbxsdNxYX9cc

