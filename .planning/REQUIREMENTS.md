# Requirements: Auton Health — Robustez da Consulta Online

**Defined:** 2026-03-31
**Core Value:** Nenhum dado de consulta médica pode ser perdido — transcrição, gravação e prontuário devem ser resilientes a falhas.

## v2.0 Requirements

Requirements para milestone v2.0. Cada um mapeia para fases do roadmap.

### Transcrição (Prioridade Máxima)

- [x] **TRNS-01**: Transcrição salva incrementalmente em `transcriptions.raw_text` durante a consulta (não apenas no final)
- [x] **TRNS-02**: Transcrição consolidada salva em `consultations.transcricao` na finalização da consulta
- [x] **TRNS-03**: Operação de save de transcrição é atômica (eliminar race condition read-modify-write no banco)
- [x] **TRNS-04**: Usar tabela `transcriptions` como fonte primária (não `transcriptions_med`)

### Webhook (Prioridade Máxima)

- [x] **WBHK-01**: Webhook disparado para N8N com payload correto (consultationId, doctorId, patientId, transcription, env)
- [x] **WBHK-02**: URL do webhook determinada por `NODE_ENV` (homolog/production/localhost), centralizada em um único local
- [ ] **WBHK-03**: Registro de entregas de webhook em tabela `webhook_deliveries` (outbox pattern)
- [ ] **WBHK-04**: Retry automático com backoff exponencial em caso de falha do webhook

### Finalização

- [ ] **FINL-01**: Guard contra finalização duplicada (mutex/flag `isFinalizing` por room)
- [ ] **FINL-02**: Guard de status transition (não regredir COMPLETED para PROCESSING)
- [ ] **FINL-03**: Room não deletada da memória se DB write falhou
- [ ] **FINL-04**: Finalização idempotente (retry seguro sem duplicar dados)

### Sessão e Conexão

- [ ] **SESS-01**: Sessões órfãs limpas automaticamente após timeout de inatividade no disconnect WebSocket
- [ ] **SESS-02**: Reconexão WebSocket com rejoin automático de sala (manter transcrição fluindo)
- [ ] **SESS-03**: Proteção contra tab crash com `beforeunload` handler durante gravação ativa

### Áudio e Microfone

- [ ] **AUDM-01**: Detecção de mic desconectado via `track.onended` com alerta visual ao médico
- [ ] **AUDM-02**: Detecção de mic silencioso prolongado com alerta visual ao médico

### Banco de Dados

- [ ] **DBAS-01**: Transações na finalização (atomicidade multi-table writes via RPC PostgreSQL)
- [ ] **DBAS-02**: `consultation_id` NOT NULL em tabela `transcriptions`

## v2+ Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Persistência Local

- **PLOC-01**: Persistência local de áudio em IndexedDB como buffer contra tab crash
- **PLOC-02**: Streaming de áudio completo para servidor (substituir mensagem WebSocket gigante)

### Observabilidade

- **OBSV-01**: Dashboard de monitoramento de webhooks falhados
- **OBSV-02**: Alertas automáticos para sessões órfãs prolongadas

## Out of Scope

| Feature | Reason |
|---------|--------|
| Migração para `transcriptions_med` como tabela primária | Continuar usando `transcriptions` como fonte de verdade |
| Refactor completo do schema de banco | Foco apenas nas correções críticas, não redesign |
| Testes E2E automatizados | Importante mas escopo separado |
| Alterações na consulta presencial | Milestone v1.0 trata disso separadamente |
| Reconexão automática do Deepgram | Melhoria futura, não crítico agora |
| Migration para `transcriptions_med` | Tabela não será criada/migrada, usar `transcriptions` |
| Migration para `recordings` | Não faz parte deste milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRNS-01 | Phase 5 | Complete |
| TRNS-02 | Phase 5 | Complete |
| TRNS-03 | Phase 5 | Complete |
| TRNS-04 | Phase 5 | Complete |
| WBHK-01 | Phase 5 | Complete |
| WBHK-02 | Phase 5 | Complete |
| WBHK-03 | Phase 6 | Pending |
| WBHK-04 | Phase 6 | Pending |
| FINL-01 | Phase 6 | Pending |
| FINL-02 | Phase 6 | Pending |
| FINL-03 | Phase 6 | Pending |
| FINL-04 | Phase 6 | Pending |
| SESS-01 | Phase 7 | Pending |
| SESS-02 | Phase 7 | Pending |
| SESS-03 | Phase 8 | Pending |
| AUDM-01 | Phase 8 | Pending |
| AUDM-02 | Phase 8 | Pending |
| DBAS-01 | Phase 7 | Pending |
| DBAS-02 | Phase 7 | Pending |

**Coverage:**
- v2.0 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after roadmap creation*
