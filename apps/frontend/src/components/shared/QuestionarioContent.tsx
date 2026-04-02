'use client';

const MODULOS = [
  { mod: '1', title: 'Abertura do Campo', obj: 'Estabilizar o campo emocional e identificar a queixa principal de entrada', questions: ['1. O que hoje mais te incomoda na sua vida ou na sua saúde?', '2. O que você gostaria de melhorar neste momento?', '3. Se pudesse resolver apenas uma coisa agora, qual seria?'] },
  { mod: '2', title: 'Leitura da Queixa', obj: 'Mapear palavras-chave, linguagem emocional, padrão de ameaça e início da suspeita de Reino', questions: ['4. Desde quando isso começou?', '5. O que estava acontecendo na sua vida nessa época?', '6. Isso surgiu de forma súbita ou foi aos poucos? □ Súbita □ Aos poucos □ Não sabe', '7. O que isso te impede de fazer hoje?', '8. Em quais momentos piora?', '9. Em quais momentos melhora?', '10. Se esse sintoma pudesse falar, o que ele diria?'] },
  { mod: '3', title: 'Sensação Corporal (Reino)', obj: 'Classificar o padrão sensorial em Vegetal, Mineral ou Animal', questions: ['11. Qual é a sensação exata no corpo?', '12. É pressão, aperto, peso, queimação, bloqueio, invasão ou fragilidade? □ Pressão □ Aperto □ Peso □ Queimação □ Bloqueio □ Invasão □ Fragilidade □ Outro', '13. Onde exatamente você sente isso?', '14. Essa sensação se move ou fica fixa? □ Move □ Fixa □ Varia', '15. Isso te lembra algo da sua vida?'] },
  { mod: '4', title: 'Emoção de Sobrevivência (Eixo HPA)', obj: 'Identificar o medo dominante, padrão de defesa e ativação simpática ou colapso', questions: ['16. O que você mais teme perder hoje?', '17. O que mais te gera medo?', '18. O que mais te gera raiva?', '19. Você se sente ameaçado, pressionado, abandonado ou desvalorizado? □ Ameaçado □ Pressionado □ Abandonado □ Desvalorizado', '20. Você sente que precisa se defender da vida? □ Sim □ Não □ Às vezes'] },
  { mod: '5', title: 'Projeto de Vida (IKIGAI)', obj: 'Avaliar presença ou ausência de propósito, bloqueio existencial e coerência de vida', questions: ['21. Qual é seu projeto de vida hoje?', '22. Como você se imagina daqui a 5 anos?', '23. O que te dá sentido para viver?', '24. O que você gostaria de estar vivendo e não consegue?'] },
  { mod: '6', title: 'História de Vida (Mapa do Miasma)', obj: 'Detectar padrões repetitivos, traumas não resolvidos e origem do conflito', questions: ['25. Como foi sua infância?', '26. Como eram seus pais com você?', '27. Houve perdas importantes? □ Sim □ Não', '28. Houve mudanças bruscas na sua vida? □ Sim □ Não', '29. Existe algo que se repete na sua vida e você não entende por quê?'] },
  { mod: '7', title: 'Histórico Gestacional', obj: 'Correlacionar ansiedade precoce, eixo HPA, microbiota e comportamento desde a gestação', questions: ['30. A gestação foi planejada ou surpresa? □ Planejada □ Surpresa □ Não sabe', '31. Como sua mãe se sentia durante a gravidez?', '32. Houve medo, rejeição ou estresse? □ Sim □ Não □ Não sabe', '33. Houve intercorrências na gestação ou parto? □ Sim □ Não □ Não sabe'] },
  { mod: '8', title: 'Setênios (Localização do Trauma)', obj: 'Identificar o ponto de ruptura e início do padrão em cada fase da vida', questions: ['34. Entre 0 e 7 anos, algo marcou sua vida?', '35. Entre 7 e 14 anos?', '36. Entre 14 e 21 anos?', '37. Em qual fase você sente que algo mudou dentro de você?'] },
  { mod: '9', title: 'Eixos Fisiológicos', obj: 'Avaliar padrões de sono, intestino e metabolismo', questions: ['— Sono —', '38. Você dorme bem? □ Sim □ Não □ Regularmente', '39. Acorda cansado(a)? □ Sim □ Não □ Às vezes', '40. Acorda durante a noite? □ Sim □ Não □ Às vezes', '— Intestino —', '41. Como é seu intestino?', '42. Tem gases, distensão ou constipação? □ Gases □ Distensão □ Constipação □ Nenhum', '— Metabolismo —', '43. Tem ganho de peso? □ Sim □ Não □ Estável', '44. Tem desejo por doces? □ Sim □ Não □ Às vezes', '45. Já teve alteração de glicose? □ Sim □ Não □ Não sabe'] },
  { mod: '10', title: 'Hábitos e Estilo de Vida', obj: 'Mapear fatores externos que impactam o processo saúde-doença', questions: ['46. Como é sua alimentação?', '47. Você pratica atividade física? □ Sim □ Não □ Às vezes', '48. Como é sua rotina de trabalho?', '49. Você tem momentos de descanso? □ Sim □ Não □ Raramente'] },
  { mod: '11', title: 'Fechamento do Campo', obj: 'Integrar a percepção do paciente e alinhar expectativas terapêuticas', questions: ['50. O que você acredita que seu corpo está tentando te mostrar?', '51. O que você espera desse tratamento?'] },
];

export function QuestionarioContent() {
  return (
    <>
      <p style={{ fontSize: 12, color: '#64748B', marginBottom: 16, textAlign: 'center', fontStyle: 'italic' }}>Roteiro com o objetivo de encontrar a CAUSA RAIZ</p>
      {MODULOS.map(m => (
        <div key={m.mod} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 6, borderBottom: '2px solid #EBF3F6', marginBottom: 8 }}>Módulo {m.mod} — {m.title}</div>
          <p style={{ fontSize: 10, color: '#94A3B8', fontStyle: 'italic', marginBottom: 6 }}>Objetivo: {m.obj}</p>
          <div style={{ fontSize: 12, color: '#0F172A', lineHeight: 1.9 }}>
            {m.questions.map((q, i) => {
              if (q.startsWith('—')) return <div key={i} style={{ fontWeight: 600, color: '#1B4266', marginTop: 6, fontSize: 11 }}>{q.replace(/—/g, '').trim()}</div>;
              const parts = q.split('□');
              return <div key={i}>{parts[0]}{parts.length > 1 && <span style={{ color: '#94A3B8', fontSize: 11 }}>{parts.slice(1).map(p => `□${p}`).join('')}</span>}</div>;
            })}
          </div>
        </div>
      ))}
    </>
  );
}
