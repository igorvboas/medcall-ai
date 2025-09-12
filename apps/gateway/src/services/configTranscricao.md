🔍 ANÁLISE - POR QUE AINDA 2 TRANSCRIÇÕES?
Mesmo com todas as proteções, ainda aparecem 2 cards. Vou explicar as variáveis que você pode ajustar para resolver definitivamente:

⚙️ VARIÁVEIS PARA AJUSTAR:
🎯 1. TIMING DE SILÊNCIO (Mais Provável)
📍 Localização: apps/gateway/src/services/audioProcessor.ts
🔧 O que fazer:
AUMENTAR phraseEndSilenceMs para 8000-10000ms (8-10 segundos)
AUMENTAR silenceThresholdMs para 12000ms (12 segundos)
💡 Por quê:
6 segundos pode não ser suficiente para garantir fim real da frase
Duas condições diferentes podem estar triggerando simultaneamente


🎯 2. PROTEÇÃO TEMPORAL (Muito Importante)
📍 Localização: apps/gateway/src/services/audioProcessor.ts
🔧 O que fazer:
AUMENTAR para 10000ms (10 segundos)
AUMENTAR para 15000ms (15 segundos) se necessário
💡 Por quê:
5 segundos pode não ser suficiente entre processamentos
Debounce mais agressivo evita calls duplicadas


🎯 3. DURAÇÃO MÍNIMA DE FRASE
📍 Localização: apps/gateway/src/services/audioProcessor.ts
🔧 O que fazer:
AUMENTAR para 3000-4000ms (3-4 segundos)
💡 Por quê:
Frases muito curtas podem estar sendo processadas multiple vezes
Filtrar melhor o que constitui uma frase válida


🎯 4. CHUNKS CONSECUTIVOS (Sensibilidade)
📍 Localização: apps/gateway/src/services/audioProcessor.ts
🔧 O que fazer:
AUMENTAR para 3-5 chunks
Tornar detecção menos sensível
💡 Por quê:
Menos chunks = mais sensível = mais triggers
Mais chunks = detecção mais estável


🎯 5. THRESHOLD DE VOZ (VAD)
📍 Localização: apps/gateway/src/services/audioProcessor.ts
🔧 O que fazer:
AUMENTAR para 0.12-0.15 (menos sensível)
💡 Por quê:
Muito sensível pode detectar ruído como fala
Menos sensível = menos falsos positivos

-------------------------------------

🔍 DEBUGGING - ONDE INVESTIGAR:
📊 1. LOGS CRÍTICOS PARA ANALISAR:
📊 2. PERGUNTAS PARA INVESTIGAR:
Quantas vezes 🎬 Iniciando nova frase aparece?
Quantas vezes 🔚 Finalizando frase aparece?
Os timestamps das 2 transcrições são diferentes?
Os IDs das utterances são diferentes?
São canais diferentes (doctor vs patient)?

🎯 ESTRATÉGIAS DE TESTE:
🧪 TESTE 1: TIMING EXTREMO
🧪 TESTE 2: SENSIBILIDADE REDUZIDA
🧪 TESTE 3: LOGGING INTENSIVO
Adicionar logs em cada ponto de decisão
Identificar exatamente onde a duplicação acontece


🎯 RECOMENDAÇÃO DE ORDEM:
🥇 PRIORIDADE 1: TIMING
phraseEndSilenceMs: 10000 (10 segundos)
timeSinceLastProcessing: 15000 (15 segundos)
🥈 PRIORIDADE 2: SENSIBILIDADE
vadThreshold: 0.12 (menos sensível)
minConsecutiveChunks: 4 (mais estável)
🥉 PRIORIDADE 3: DEBUGGING
Logs detalhados para identificar origem
Timestamps e IDs das transcrições duplicadas