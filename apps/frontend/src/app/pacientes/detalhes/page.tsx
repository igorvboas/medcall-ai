'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { gatewayClient } from '@/lib/gatewayClient';
import { ArrowLeft, Mail, Phone, Moon, Activity, Utensils, Scale, TrendingUp, FileText, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import EvolucaoSection from '@/components/evolucao/EvolucaoSection';
import Link from 'next/link';
import '../pacientes.css';

interface Patient {
  id: string;
  doctor_id: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  birth_date?: string;
  gender?: string;
  cpf?: string;
  address?: string;
  status: string;
  created_at: string;
  updated_at: string;
  profile_pic?: string;
}

interface PatientMetrics {
  media_sono: { score: number; tempo_medio_horas?: number } | null;
  atividade_fisica: { score: number; tempo_medio_horas?: number; intensidade_media?: number } | null;
  alimentacao: { score: number; refeicoes_media?: number; agua_media_litros?: number } | null;
  equilibrio_geral: number | null;
  total_registros: number;
  periodo_dias: number;
}

function PatientDetailsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams?.get('id') ?? '';

  const [patient, setPatient] = useState<Patient | null>(null);
  const [metrics, setMetrics] = useState<PatientMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestConsultaId, setLatestConsultaId] = useState<string | null>(null);
  const [allAnamneses, setAllAnamneses] = useState<any[]>([]);
  const [showAnamnesePopup, setShowAnamnesePopup] = useState(false);
  const [selectedAnamneseIndex, setSelectedAnamneseIndex] = useState(0);

  useEffect(() => {
    if (!id) {
      setError('ID do paciente não informado');
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [patientRes, metricsRes] = await Promise.all([
          gatewayClient.get<{ success: boolean; patient: Patient }>(`/patients/${id}`),
          gatewayClient.get<{ success: boolean; metrics: PatientMetrics }>(`/patients/${id}/metrics?dias=90`)
        ]);
        if (!patientRes.success || !patientRes.patient) {
          setError(patientRes.error || 'Paciente não encontrado');
          return;
        }
        setPatient(patientRes.patient);
        if (metricsRes.success && metricsRes.metrics) {
          setMetrics(metricsRes.metrics);
        } else {
          setMetrics({
            media_sono: null,
            atividade_fisica: null,
            alimentacao: null,
            equilibrio_geral: null,
            total_registros: 0,
            periodo_dias: 90
          });
        }

        // Buscar consulta mais recente e anamneses do paciente
        try {
          const { data: consultas } = await supabase
            .from('consultations')
            .select('id')
            .eq('patient_id', id)
            .order('created_at', { ascending: false })
            .limit(1);
          if (consultas && consultas.length > 0) {
            setLatestConsultaId(consultas[0].id);
          }

          // Buscar todas as anamneses do paciente
          const { data: anamneses } = await supabase
            .from('a_cadastro_anamnese')
            .select('*')
            .eq('paciente_id', id)
            .order('created_at', { ascending: false });
          if (anamneses && anamneses.length > 0) {
            setAllAnamneses(anamneses);
          }
        } catch (e) { console.error('Erro ao buscar dados do paciente:', e); }
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="patients-page">
        <div className="patients-container">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p className="loading-text">Carregando detalhes do paciente...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="patients-page">
        <div className="patients-container">
          <div className="error-state">
            <p className="error-title">{error || 'Paciente não encontrado'}</p>
            <Link href="/pacientes/" className="btn btn-primary">
              <ArrowLeft size={18} />
              Voltar à lista
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const initials = patient.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const formatScore = (v: number | null | undefined) =>
    v != null ? v.toFixed(1).replace('.', ',') : '—';

  return (
    <div className="patients-page">
      <div className="patients-container patient-details-container">
        <div className="patient-details-header">
          <button onClick={() => router.back()} className="btn-back-details" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft size={20} />
            Voltar
          </button>
          <div className="patient-details-title-row">
            <div className="patient-details-avatar">
              {patient.profile_pic ? (
                <img src={patient.profile_pic} alt={patient.name} className="patient-details-avatar-img" />
              ) : (
                <span className="patient-details-initials"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
              )}
            </div>
            <div>
              <h1 className="patient-details-name">{patient.name}</h1>
              <div className="patient-details-contact">
                {patient.email && (
                  <span className="contact-chip">
                    <Mail size={16} />
                    {patient.email}
                  </span>
                )}
                {patient.phone && (
                  <span className="contact-chip">
                    <Phone size={16} />
                    {patient.phone}
                  </span>
                )}
              </div>
            </div>
            {/* Botão Ver Anamnese */}
            <button
              onClick={() => { setSelectedAnamneseIndex(0); setShowAnamnesePopup(true); }}
              disabled={allAnamneses.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                borderRadius: 10, border: 'none', background: allAnamneses.length > 0 ? '#1B4266' : '#CBD5E1',
                color: '#fff', fontSize: 14, fontWeight: 600, cursor: allAnamneses.length > 0 ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', marginLeft: 'auto', flexShrink: 0,
              }}
            >
              <FileText size={16} />
              Ver Anamneses ({allAnamneses.length})
            </button>
          </div>
        </div>

        {/* Métricas do Check-in Diário */}
        <section className="patient-metrics-section">
          <h2 className="patient-metrics-section-title">Métricas de Check-in Diário</h2>
          <p className="patient-metrics-section-desc">
            Dados do outro sistema (check-in diário). Período: últimos {metrics?.periodo_dias ?? 90} dias
            {metrics?.total_registros != null && metrics.total_registros > 0 && (
              <> · {metrics.total_registros} registro(s)</>
            )}
          </p>

          <div className="patient-metrics-grid">
            <div className="patient-metric-card">
              <div className="patient-metric-icon-wrap sono">
                <Moon size={24} />
              </div>
              <div className="patient-metric-label">Sono</div>
              <div className="patient-metric-value">
                {metrics?.media_sono?.score != null ? (
                  <>
                    <span className="score">{formatScore(metrics.media_sono.score)}</span>
                    <span className="unit">/10</span>
                  </>
                ) : (
                  <span className="no-data">Sem dados</span>
                )}
              </div>
              {metrics?.media_sono?.tempo_medio_horas != null && (
                <div className="patient-metric-extra">
                  ~{metrics.media_sono.tempo_medio_horas.toFixed(1)} h de sono
                </div>
              )}
            </div>

            <div className="patient-metric-card">
              <div className="patient-metric-icon-wrap atividade">
                <Activity size={24} />
              </div>
              <div className="patient-metric-label">Atividade Física</div>
              <div className="patient-metric-value">
                {metrics?.atividade_fisica?.score != null ? (
                  <>
                    <span className="score">{formatScore(metrics.atividade_fisica.score)}</span>
                    <span className="unit">/10</span>
                  </>
                ) : (
                  <span className="no-data">Sem dados</span>
                )}
              </div>
              {metrics?.atividade_fisica?.tempo_medio_horas != null && (
                <div className="patient-metric-extra">
                  ~{metrics.atividade_fisica.tempo_medio_horas.toFixed(1)} h/semana
                </div>
              )}
            </div>

            <div className="patient-metric-card">
              <div className="patient-metric-icon-wrap alimentacao">
                <Utensils size={24} />
              </div>
              <div className="patient-metric-label">Alimentação</div>
              <div className="patient-metric-value">
                {metrics?.alimentacao?.score != null ? (
                  <>
                    <span className="score">{formatScore(metrics.alimentacao.score)}</span>
                    <span className="unit">/10</span>
                  </>
                ) : (
                  <span className="no-data">Sem dados</span>
                )}
              </div>
              {metrics?.alimentacao?.refeicoes_media != null && (
                <div className="patient-metric-extra">
                  ~{metrics.alimentacao.refeicoes_media.toFixed(1)} refeições ·{' '}
                  {metrics.alimentacao.agua_media_litros != null
                    ? `${metrics.alimentacao.agua_media_litros.toFixed(1)} L água`
                    : ''}
                </div>
              )}
            </div>

            <div className="patient-metric-card equilibrio">
              <div className="patient-metric-icon-wrap equilibrio">
                <Scale size={24} />
              </div>
              <div className="patient-metric-label">Equilíbrio Geral</div>
              <div className="patient-metric-value">
                {metrics?.equilibrio_geral != null ? (
                  <>
                    <span className="score">{formatScore(metrics.equilibrio_geral)}</span>
                    <span className="unit">/10</span>
                  </>
                ) : (
                  <span className="no-data">Sem dados</span>
                )}
              </div>
            </div>
          </div>

          {metrics?.total_registros === 0 && (
            <p className="patient-metrics-empty">
              Nenhum check-in registrado no período. As métricas aparecem quando o paciente preenche o check-in diário no outro sistema.
            </p>
          )}
        </section>

        {/* Evolução do Paciente */}
        {latestConsultaId && (
          <section className="patient-info-section">
            <h2 className="patient-info-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={20} />
              Evolução
            </h2>
            <EvolucaoSection
              consultaId={latestConsultaId}
              patientId={id}
              patientName={patient.name}
            />
          </section>
        )}

        {/* Dados cadastrais resumidos */}
        <section className="patient-info-section">
          <h2 className="patient-info-section-title">Dados cadastrais</h2>
          <div className="patient-info-grid">
            {patient.cpf && (
              <div className="patient-info-item">
                <span className="label">CPF</span>
                <span className="value">{patient.cpf}</span>
              </div>
            )}
            {patient.birth_date && (
              <div className="patient-info-item">
                <span className="label">Data de nascimento</span>
                <span className="value">{new Date(patient.birth_date).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
            {(patient.city || patient.state) && (
              <div className="patient-info-item">
                <span className="label">Cidade / Estado</span>
                <span className="value">{[patient.city, patient.state].filter(Boolean).join(' / ')}</span>
              </div>
            )}
            {patient.address && (
              <div className="patient-info-item full-width">
                <span className="label">Endereço</span>
                <span className="value">{patient.address}</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Popup Histórico de Anamneses */}
      {showAnamnesePopup && allAnamneses.length > 0 && (
        <div onClick={() => setShowAnamnesePopup(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '90vw', maxWidth: 700, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1B4266', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={18} color="#fff" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Histórico de Anamneses</h3>
              </div>
              <button onClick={() => setShowAnamnesePopup(false)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Sidebar com lista de datas */}
              <div style={{ width: 160, borderRight: '1px solid #E2E8F0', overflowY: 'auto', background: '#FAFBFC', padding: '8px 0' }}>
                {allAnamneses.map((a, idx) => (
                  <button key={idx} onClick={() => setSelectedAnamneseIndex(idx)}
                    style={{
                      width: '100%', padding: '10px 14px', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                      background: selectedAnamneseIndex === idx ? '#EBF3F6' : 'transparent',
                      borderLeft: selectedAnamneseIndex === idx ? '3px solid #1B4266' : '3px solid transparent',
                    }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: selectedAnamneseIndex === idx ? '#1B4266' : '#64748B' }}>
                      {a.created_at ? new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : `Anamnese ${idx + 1}`}
                    </div>
                    {idx === 0 && <div style={{ fontSize: 10, color: '#1B4266', fontWeight: 700, marginTop: 2 }}>Mais recente</div>}
                  </button>
                ))}
              </div>
              {/* Conteúdo da anamnese selecionada */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                {(() => {
                  const a = allAnamneses[selectedAnamneseIndex];
                  if (!a) return <p style={{ color: '#94A3B8' }}>Nenhuma anamnese selecionada</p>;
                  const sections = [
                    { title: 'Dados Pessoais', fields: [
                      { label: 'Nome', value: a.nome_completo }, { label: 'Email', value: a.email }, { label: 'Telefone', value: a.telefone },
                      { label: 'Data Nasc.', value: a.data_nascimento }, { label: 'Gênero', value: a.genero }, { label: 'Profissão', value: a.profissao }, { label: 'CPF', value: a.cpf },
                    ]},
                    { title: 'Medidas', fields: [
                      { label: 'Peso Atual', value: a.peso_atual }, { label: 'Altura', value: a.altura }, { label: 'Peso Desejado', value: a.peso_desejado },
                    ]},
                    { title: 'Sono, Água e Jejum', fields: [
                      { label: 'Avaliação do Sono', value: a.avaliacao_sono }, { label: 'Consumo de Água', value: a.consumo_agua },
                      { label: 'Cor da Urina', value: a.cor_urina }, { label: 'Prática de Jejum', value: a.pratica_jejum },
                    ]},
                    { title: 'Objetivo e Atividade Física', fields: [
                      { label: 'Objetivo Principal', value: a.objetivo_principal }, { label: 'Pratica Atividade', value: a.patrica_atividade_fisica },
                      { label: 'Nível', value: a.nivel_atividade }, { label: 'Modalidades', value: Array.isArray(a.modalidades) ? a.modalidades.join(', ') : a.modalidades },
                      { label: 'Frequência', value: a.frequencia_deseja_treinar },
                    ]},
                    { title: 'Preferências Alimentares', fields: [
                      { label: 'Proteínas', value: Array.isArray(a.proteinas) ? a.proteinas.join(', ') : a.proteinas },
                      { label: 'Carboidratos', value: Array.isArray(a.carboidratos) ? a.carboidratos.join(', ') : a.carboidratos },
                      { label: 'Vegetais', value: Array.isArray(a.vegetais) ? a.vegetais.join(', ') : a.vegetais },
                      { label: 'Leguminosas', value: Array.isArray(a.leguminosas) ? a.leguminosas.join(', ') : a.leguminosas },
                      { label: 'Gorduras', value: Array.isArray(a.gorduras) ? a.gorduras.join(', ') : a.gorduras },
                      { label: 'Frutas', value: Array.isArray(a.frutas) ? a.frutas.join(', ') : a.frutas },
                    ]},
                    { title: 'Saúde e Medicamentos', fields: [
                      { label: 'Medicamentos', value: a.toma_medicamentos }, { label: 'Quais', value: a.medicamentos_detalhes },
                      { label: 'Suplementos', value: Array.isArray(a.suplementos) ? a.suplementos.join(', ') : a.suplementos },
                      { label: 'Condições', value: Array.isArray(a.condicoes) ? a.condicoes.join(', ') : a.condicoes },
                      { label: 'Cirurgia', value: a.cirurgia },
                    ]},
                    { title: 'Saúde Digestiva', fields: [
                      { label: 'Mastigação', value: a.mastigacao }, { label: 'Alergias', value: Array.isArray(a.alergias) ? a.alergias.join(', ') : a.alergias },
                      { label: 'Desconfortos', value: Array.isArray(a.desconfortos_intestinais) ? a.desconfortos_intestinais.join(', ') : a.desconfortos_intestinais },
                      { label: 'Intestino', value: a.avaliacao_intestino }, { label: 'Bristol', value: a.escala_bristol },
                    ]},
                  ];
                  return sections.map(section => {
                    const validFields = section.fields.filter(f => f.value);
                    if (validFields.length === 0) return null;
                    return (
                      <div key={section.title} style={{ marginBottom: 20 }}>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1B4266', textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '2px solid #EBF3F6', marginBottom: 10 }}>{section.title}</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 20px' }}>
                          {validFields.map(f => (
                            <div key={f.label} style={{ padding: '6px 0' }}>
                              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 2 }}>{f.label}</div>
                              <div style={{ fontSize: 13, color: '#0F172A', fontWeight: 500, lineHeight: 1.4 }}>{String(f.value)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PatientDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="patients-page">
          <div className="patients-container">
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p className="loading-text">Carregando...</p>
            </div>
          </div>
        </div>
      }
    >
      <PatientDetailsContent />
    </Suspense>
  );
}
