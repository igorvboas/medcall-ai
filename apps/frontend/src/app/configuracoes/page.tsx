'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, Stethoscope, CreditCard, Calendar, Hash, FileText, Smartphone, Upload, X, ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { AvatarUpload } from '@/components/shared/AvatarUpload';
import { formatCPF, formatPhone, validateCPF, removeMask } from '@/lib/validations';
import { supabase } from '@/lib/supabase';
import { TutorialPopup } from '@/components/dashboard/TutorialPopup';
import { CONFIGURACOES_STEPS } from '@/components/dashboard/tutorialSteps';
import './configuracoes.css';

interface MedicoData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  specialty?: string;
  crm?: string;
  cpf?: string;
  birth_date?: string;
  profile_pic?: string | null;
  logo_url?: string | null;
  subscription_type?: 'FREE' | 'PRO' | 'ENTERPRISE';
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  specialty: string;
  crm: string;
  cpf: string;
  birth_date: string;
  subscription_type: 'FREE' | 'PRO' | 'ENTERPRISE';
}

export default function ConfiguracoesPage() {
  const [medico, setMedico] = useState<MedicoData | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    specialty: '',
    crm: '',
    cpf: '',
    birth_date: '',
    subscription_type: 'FREE'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cpfError, setCpfError] = useState<string | null>(null);

  useEffect(() => {
    fetchMedicoData();
  }, []);

  const fetchMedicoData = async () => {
    try {
      setLoading(true);

      // Buscar usuário autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Usuário não autenticado');
      }

      // Buscar dados do médico
      const { data: medico, error: medicoError } = await supabase
        .from('medicos')
        .select('*')
        .eq('user_auth', user.id)
        .single();

      if (medicoError || !medico) {
        throw new Error('Erro ao carregar dados do médico');
      }

      setMedico(medico);

      // Buscar assinatura real da tabela assinaturas
      let subscriptionType: 'FREE' | 'PRO' | 'ENTERPRISE' = medico.subscription_type || 'FREE';
      try {
        const { data: assinatura } = await supabase
          .from('assinaturas')
          .select('assinatura_ativa, value, cycle')
          .eq('doctor_id', medico.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (assinatura?.assinatura_ativa) {
          // Determinar plano pelo valor ou ciclo
          subscriptionType = 'PRO';
        }
      } catch (e) {
        console.error('Erro ao buscar assinatura:', e);
      }

      // Preencher formulário com dados existentes e aplicar máscaras
      setFormData({
        name: medico.name || '',
        email: medico.email || '',
        phone: medico.phone ? formatPhone(medico.phone) : '',
        specialty: medico.specialty || '',
        crm: medico.crm || '',
        cpf: medico.cpf ? formatCPF(medico.cpf) : '',
        birth_date: medico.birth_date || '',
        subscription_type: subscriptionType
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Aplica máscaras específicas
    let formattedValue = value;

    if (name === 'phone') {
      formattedValue = formatPhone(value);
    } else if (name === 'cpf') {
      formattedValue = formatCPF(value);
      // Valida CPF em tempo real
      if (value.replace(/\D/g, '').length === 11) {
        if (!validateCPF(value)) {
          setCpfError('CPF inválido');
        } else {
          setCpfError(null);
        }
      } else {
        setCpfError(null);
      }
    }

    setFormData(prev => ({
      ...prev,
      [name]: formattedValue
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações antes de enviar
    if (formData.cpf && !validateCPF(formData.cpf)) {
      setError('Por favor, insira um CPF válido.');
      setCpfError('CPF inválido');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Buscar usuário autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Usuário não autenticado');
      }

      // Remove máscaras antes de enviar para o banco
      const dataToSend = {
        ...formData,
        phone: removeMask(formData.phone),
        cpf: removeMask(formData.cpf),
        birth_date: formData.birth_date ? formData.birth_date : null,
      };

      // Atualizar dados do médico no Supabase
      const { data: updatedMedico, error: updateError } = await supabase
        .from('medicos')
        .update(dataToSend)
        .eq('user_auth', user.id)
        .select()
        .single();

      if (updateError || !updatedMedico) {
        throw new Error(updateError?.message || 'Erro ao atualizar dados');
      }

      setMedico(updatedMedico);
      setSuccess('Dados atualizados com sucesso!');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar dados');
    } finally {
      setSaving(false);
    }
  };

  const formatSubscriptionType = (type: string) => {
    switch (type) {
      case 'FREE': return 'Gratuito';
      case 'PRO': return 'Profissional';
      case 'ENTERPRISE': return 'Empresarial';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="configuracoes-container">
        <div className="configuracoes-header">
          <h1 className="configuracoes-title">Configurações</h1>
          <p className="configuracoes-subtitle">Gerenciando suas informações pessoais</p>
        </div>

        <div className="loading-indicator">
          <div className="loading-icon"></div>
          <span>Carregando dados...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="configuracoes-container">
      <div className="configuracoes-header">
        <h1 className="configuracoes-title">Configurações</h1>
        <p className="configuracoes-subtitle">Gerenciando suas informações pessoais</p>
      </div>

      <div className="consultation-form">
        <form onSubmit={handleSubmit} className="form-card">
          <div className="form-section-title" data-tutorial="info-pessoais">
            <User className="form-section-icon" />
            <span>Informações Pessoais</span>
          </div>

          {medico && (
            <div className="form-group" style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
              <AvatarUpload
                currentImageUrl={medico.profile_pic}
                onUploadComplete={(url) => {
                  setMedico(prev => prev ? { ...prev, profile_pic: url } : null);
                  setSuccess('Foto de perfil atualizada com sucesso!');
                  setTimeout(() => setSuccess(null), 3000);
                }}
                userId={medico.id}
                userType="medico"
                size="large"
              />
            </div>
          )}

          {/* Upload de Logo para Documentos */}
          {medico && (
            <div className="form-group" data-tutorial="logo-upload" style={{ marginBottom: '2rem' }}>
              <label className="form-label" style={{ marginBottom: 12 }}>
                <ImageIcon style={{ width: 16, height: 16, display: 'inline', marginRight: 8 }} />
                Logo para Documentos (Receitas/Prescrições)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 160, height: 80, borderRadius: 10, border: '2px dashed #CBD5E1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: medico.logo_url ? '#fff' : '#F8FAFC', overflow: 'hidden', position: 'relative', cursor: 'pointer',
                }}
                  onClick={() => (document.getElementById('logo-upload-input') as HTMLInputElement)?.click()}
                >
                  {medico.logo_url ? (
                    <img src={medico.logo_url} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#94A3B8' }}>
                      <Upload size={20} />
                      <div style={{ fontSize: 11, marginTop: 4 }}>Enviar logo</div>
                    </div>
                  )}
                </div>
                {medico.logo_url && (
                  <button
                    type="button"
                    onClick={async () => {
                      const { data: { user: u } } = await supabase.auth.getUser();
                      await supabase.from('medicos').update({ logo_url: null }).eq('user_auth', u?.id || '');
                      setMedico(prev => prev ? { ...prev, logo_url: null } : null);
                      setSuccess('Logo removida');
                      setTimeout(() => setSuccess(null), 3000);
                    }}
                    style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <X size={14} /> Remover
                  </button>
                )}
                <input
                  id="logo-upload-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !medico) return;
                    try {
                      const fileExt = file.name.split('.').pop();
                      const fileName = `logo_${medico.id}_${Date.now()}.${fileExt}`;
                      const filePath = `logos/${fileName}`;
                      const { error: uploadError } = await supabase.storage.from('profile_pics').upload(filePath, file, { cacheControl: '3600', upsert: true });
                      if (uploadError) throw uploadError;
                      const { data: { publicUrl } } = supabase.storage.from('profile_pics').getPublicUrl(filePath);
                      const { data: { user: authUser } } = await supabase.auth.getUser();
                      await supabase.from('medicos').update({ logo_url: publicUrl }).eq('user_auth', authUser?.id || '');
                      setMedico(prev => prev ? { ...prev, logo_url: publicUrl } : null);
                      setSuccess('Logo atualizada com sucesso!');
                      setTimeout(() => setSuccess(null), 3000);
                    } catch (err: any) {
                      setError(err.message || 'Erro ao enviar logo');
                      setTimeout(() => setError(null), 5000);
                    }
                    e.target.value = '';
                  }}
                />
              </div>
              <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>Recomendado: imagem PNG ou JPG, fundo transparente, max 500KB</p>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="name" className="form-label">
              <User className="form-section-icon" style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
              Nome Completo
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              <Mail className="form-section-icon" style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone" className="form-label">
              <Phone className="form-section-icon" style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
              Telefone
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="form-input"
              placeholder="(11) 99999-9999"
              maxLength={15}
            />
          </div>

          <div className="form-group">
            <label htmlFor="cpf" className="form-label">
              <FileText className="form-section-icon" style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
              CPF
            </label>
            <input
              type="text"
              id="cpf"
              name="cpf"
              value={formData.cpf}
              onChange={handleInputChange}
              className={`form-input ${cpfError ? 'error' : ''}`}
              placeholder="000.000.000-00"
              maxLength={14}
            />
            {cpfError && (
              <div className="field-error" style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {cpfError}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="birth_date" className="form-label">
              <Calendar className="form-section-icon" style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
              Data de Nascimento
            </label>
            <input
              type="date"
              id="birth_date"
              name="birth_date"
              value={formData.birth_date}
              onChange={handleInputChange}
              className="form-input"
            />
          </div>

          <div className="form-section-title" data-tutorial="info-profissionais" style={{ marginTop: '2rem' }}>
            <Stethoscope className="form-section-icon" />
            <span>Informações Profissionais</span>
          </div>

          <div className="form-group">
            <label htmlFor="specialty" className="form-label">
              <Stethoscope className="form-section-icon" style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
              Especialidade
            </label>
            <input
              type="text"
              id="specialty"
              name="specialty"
              value={formData.specialty}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Ex: Clínico Geral, Cardiologia, etc."
            />
          </div>

          <div className="form-group">
            <label htmlFor="crm" className="form-label">
              <Hash className="form-section-icon" style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
              Número de Registro do Profissional
            </label>
            <input
              type="text"
              id="crm"
              name="crm"
              value={formData.crm}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Ex: 12345-SP (opcional)"
            />
            <div className="form-helper-text" style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
              Campo opcional. Preencha apenas se você possuir um número de registro profissional.
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="subscription_type" className="form-label">
              <CreditCard className="form-section-icon" style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
              Tipo de Assinatura
            </label>
            <select
              id="subscription_type"
              name="subscription_type"
              value={formData.subscription_type}
              onChange={handleInputChange}
              className="form-select"
              disabled
            >
              <option value="FREE">Gratuito</option>
              <option value="PRO">Profissional</option>
              <option value="ENTERPRISE">Empresarial</option>
            </select>
            <div className="form-helper-text">
              O tipo de assinatura não pode ser alterado aqui. Entre em contato com o suporte para alterações.
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {success && (
            <div className="success-message">
              {success}
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary btn-large"
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="loading-icon"></div>
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </button>
          </div>
        </form>
      </div>
      {/* Card Conexão WhatsApp */}
      <Link href="/conexao" data-tutorial="whatsapp-conexao" style={{ textDecoration: 'none', display: 'block', marginTop: 24 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '20px 24px', borderRadius: 12,
          background: 'var(--card-bg, #fff)', border: '1.5px solid var(--border-color, #E2E8F0)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer',
          transition: 'all 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#1B4266'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(27,66,102,0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color, #E2E8F0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: '#EBF3F6', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Smartphone size={22} style={{ color: '#1B4266' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #0F172A)' }}>Conexão WhatsApp</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary, #64748B)' }}>Conecte seu dispositivo para envio de mensagens</div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary, #94A3B8)" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </Link>

      <TutorialPopup steps={CONFIGURACOES_STEPS} pageKey="configuracoes" showWelcome={false} />
    </div>
  );
}
