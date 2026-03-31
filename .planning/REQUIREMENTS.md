# Requirements: Auton Health — Consulta Presencial com Microfone Unico

**Defined:** 2026-03-30
**Core Value:** Medico consegue realizar consulta presencial com transcricao automatica usando apenas 1 microfone, com identificacao correta de quem esta falando.

## v1.0 Requirements

Requirements for single-mic presencial consultation. Each maps to roadmap phases.

### Validacao

- [ ] **VAL-01**: Medico pode executar spike de validacao com audio real de consulta para medir acuracia da diarizacao nova-2 + pt-BR
- [ ] **VAL-02**: Sistema reporta metricas de acuracia (% de utterances com speaker correto) para decisao go/no-go

### Backend Diarizacao

- [x] **DIAR-01**: Servidor acumula chunks de 5s do cliente em batches de 30s+ antes de enviar ao Deepgram
- [x] **DIAR-02**: Servidor envia `utterances: true` + `diarize: true` ao Deepgram pre-recorded API
- [x] **DIAR-03**: Servidor extrai `speaker` e `speaker_confidence` de cada utterance do response Deepgram
- [x] **DIAR-04**: Servidor armazena transcricoes com speaker_id atribuido (speaker_0, speaker_1)
- [x] **DIAR-05**: Servidor usa confidence threshold para decidir auto-assign vs marcar como "incerto"
- [x] **DIAR-06**: Servidor suporta mapeamento retroativo de speaker (atualizar transcricoes quando medico mapeia speakers)

### Frontend Single Mic

- [ ] **FMIC-01**: Medico pode selecionar 1 microfone para a consulta presencial
- [ ] **FMIC-02**: Medico pode alternar entre modo single-mic e dual-mic na UI
- [ ] **FMIC-03**: Medico pode associar speaker_0 a "medico" e speaker_1 a "paciente" via painel de mapping
- [ ] **FMIC-04**: UI exibe indicador visual de quem esta falando em tempo real
- [ ] **FMIC-05**: UI exibe transcricoes agrupadas por speaker com labels corretos (Medico/Paciente)

### Integracao

- [ ] **INTG-01**: Fluxo end-to-end funciona: 1 mic → acumulacao → diarizacao → speaker mapping → transcricao final
- [ ] **INTG-02**: Modo dual-mic existente continua funcionando sem regressao
- [ ] **INTG-03**: Webhook de finalizacao envia transcricao com speaker attribution correto
- [ ] **INTG-04**: Dados de transcricao salvos no banco sao compativeis com ambos os modos

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhancements

- **ENH-01**: Sistema sugere automaticamente mapping de speaker baseado em padroes de fala (quem fala primeiro = medico)
- **ENH-02**: Medico pode corrigir speaker attribution pos-consulta em UI de revisao
- **ENH-03**: Sistema aprende padroes de voz do medico ao longo de multiplas consultas
- **ENH-04**: Migracao para Nova-3 para melhor acuracia de transcricao pt-BR

## Out of Scope

| Feature | Reason |
|---------|--------|
| Nova-3 migration | Testar separadamente depois — Nova-2 e o baseline atual |
| 3+ speakers no mesmo mic | Foco em consulta 1:1 (medico + paciente) |
| Alteracoes na consulta remota | Fluxo diferente (WebRTC + streaming), nao impactado |
| Word-level speaker correction | Granularidade excessiva — utterance-level e suficiente |
| Streaming API para presencial | Arquitetura atual e pre-recorded; streaming seria rewrite completo |
| Auto-mapping sem confirmacao | Risco de liability em contexto medico — mapping manual obrigatorio |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VAL-01 | Phase 1 | Pending |
| VAL-02 | Phase 1 | Pending |
| DIAR-01 | Phase 2 | Complete |
| DIAR-02 | Phase 2 | Complete |
| DIAR-03 | Phase 2 | Complete |
| DIAR-04 | Phase 2 | Complete |
| DIAR-05 | Phase 2 | Complete |
| DIAR-06 | Phase 2 | Complete |
| FMIC-01 | Phase 3 | Pending |
| FMIC-02 | Phase 3 | Pending |
| FMIC-03 | Phase 3 | Pending |
| FMIC-04 | Phase 3 | Pending |
| FMIC-05 | Phase 3 | Pending |
| INTG-01 | Phase 4 | Pending |
| INTG-02 | Phase 4 | Pending |
| INTG-03 | Phase 4 | Pending |
| INTG-04 | Phase 4 | Pending |

**Coverage:**
- v1.0 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-03-30*
*Last updated: 2026-03-30 after roadmap creation*
