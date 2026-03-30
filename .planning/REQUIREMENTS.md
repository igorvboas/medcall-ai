# Requirements: Auton Health — Consulta Presencial com Microfone Único

**Defined:** 2026-03-30
**Core Value:** Médico consegue realizar consulta presencial com transcrição automática usando apenas 1 microfone, com identificação correta de quem está falando.

## v1.0 Requirements

Requirements for single-mic presencial consultation. Each maps to roadmap phases.

### Validação

- [ ] **VAL-01**: Médico pode executar spike de validação com áudio real de consulta para medir acurácia da diarização nova-2 + pt-BR
- [ ] **VAL-02**: Sistema reporta métricas de acurácia (% de utterances com speaker correto) para decisão go/no-go

### Backend Diarização

- [ ] **DIAR-01**: Servidor acumula chunks de 5s do cliente em batches de 30s+ antes de enviar ao Deepgram
- [ ] **DIAR-02**: Servidor envia `utterances: true` + `diarize: true` ao Deepgram pre-recorded API
- [ ] **DIAR-03**: Servidor extrai `speaker` e `speaker_confidence` de cada utterance do response Deepgram
- [ ] **DIAR-04**: Servidor armazena transcrições com speaker_id atribuído (speaker_0, speaker_1)
- [ ] **DIAR-05**: Servidor usa confidence threshold para decidir auto-assign vs marcar como "incerto"
- [ ] **DIAR-06**: Servidor suporta mapeamento retroativo de speaker (atualizar transcrições quando médico mapeia speakers)

### Frontend Single Mic

- [ ] **FMIC-01**: Médico pode selecionar 1 microfone para a consulta presencial
- [ ] **FMIC-02**: Médico pode alternar entre modo single-mic e dual-mic na UI
- [ ] **FMIC-03**: Médico pode associar speaker_0 a "médico" e speaker_1 a "paciente" via painel de mapping
- [ ] **FMIC-04**: UI exibe indicador visual de quem está falando em tempo real
- [ ] **FMIC-05**: UI exibe transcrições agrupadas por speaker com labels corretos (Médico/Paciente)

### Integração

- [ ] **INTG-01**: Fluxo end-to-end funciona: 1 mic → acumulação → diarização → speaker mapping → transcrição final
- [ ] **INTG-02**: Modo dual-mic existente continua funcionando sem regressão
- [ ] **INTG-03**: Webhook de finalização envia transcrição com speaker attribution correto
- [ ] **INTG-04**: Dados de transcrição salvos no banco são compatíveis com ambos os modos

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhancements

- **ENH-01**: Sistema sugere automaticamente mapping de speaker baseado em padrões de fala (quem fala primeiro = médico)
- **ENH-02**: Médico pode corrigir speaker attribution pós-consulta em UI de revisão
- **ENH-03**: Sistema aprende padrões de voz do médico ao longo de múltiplas consultas
- **ENH-04**: Migração para Nova-3 para melhor acurácia de transcrição pt-BR

## Out of Scope

| Feature | Reason |
|---------|--------|
| Nova-3 migration | Testar separadamente depois — Nova-2 é o baseline atual |
| 3+ speakers no mesmo mic | Foco em consulta 1:1 (médico + paciente) |
| Alterações na consulta remota | Fluxo diferente (WebRTC + streaming), não impactado |
| Word-level speaker correction | Granularidade excessiva — utterance-level é suficiente |
| Streaming API para presencial | Arquitetura atual é pre-recorded; streaming seria rewrite completo |
| Auto-mapping sem confirmação | Risco de liability em contexto médico — mapping manual obrigatório |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VAL-01 | — | Pending |
| VAL-02 | — | Pending |
| DIAR-01 | — | Pending |
| DIAR-02 | — | Pending |
| DIAR-03 | — | Pending |
| DIAR-04 | — | Pending |
| DIAR-05 | — | Pending |
| DIAR-06 | — | Pending |
| FMIC-01 | — | Pending |
| FMIC-02 | — | Pending |
| FMIC-03 | — | Pending |
| FMIC-04 | — | Pending |
| FMIC-05 | — | Pending |
| INTG-01 | — | Pending |
| INTG-02 | — | Pending |
| INTG-03 | — | Pending |
| INTG-04 | — | Pending |

**Coverage:**
- v1.0 requirements: 17 total
- Mapped to phases: 0
- Unmapped: 17 ⚠️

---
*Requirements defined: 2026-03-30*
*Last updated: 2026-03-30 after initial definition*
