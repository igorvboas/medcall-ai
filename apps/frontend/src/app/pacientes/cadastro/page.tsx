'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, FileText, Shield, Calendar } from 'lucide-react';
import { AvatarUpload } from '@/components/shared/AvatarUpload';
import './cadastro.css';

interface PatientFormData {
  // Informações do Paciente
  name: string;
  phone: string;
  address: string;
  birth_date: string;
  email?: string;
  gender?: 'M' | 'F' | 'O';
  
  // Histórico Médico
  allergies: string;
  medications: string;
  surgical_history: string;
  surgical_date: string;
  
  // Informação sobre Convênio
  insurance_name: string;
  cpf: string;
  validity_date: string;
  
  // Campos adicionais da tabela
  emergency_contact?: string;
  emergency_phone?: string;
  medical_history?: string;
  current_medications?: string;
  medicamento_freq?: string;
  historico_cirurgico?: string;
  data_ultima_cirurgia?: string;
  convenio?: string;
  convenio_vigencia?: string;
}

export default function CadastrarPaciente() {
  const router = useRouter();
  const [formData, setFormData] = useState<PatientFormData>({
    name: '',
    phone: '',
    address: '',
    birth_date: '',
    email: '',
    gender: undefined,
    allergies: '',
    medications: '',
    surgical_history: '',
    surgical_date: '',
    insurance_name: '',
    cpf: '',
    validity_date: '',
    emergency_contact: '',
    emergency_phone: '',
    medical_history: '',
    current_medications: '',
    medicamento_freq: '',
    historico_cirurgico: '',
    data_ultima_cirurgia: '',
    convenio: '',
    convenio_vigencia: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);

  const handleChange = (field: keyof PatientFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '+$1 $2$3');
    } else {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '+$1 $2$3');
    }
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatDate = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{2})(\d{2})(\d{4})/, '$1/$2/$3');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validação básica
      if (!formData.name.trim()) {
        alert('Nome é obrigatório');
        return;
      }

      // Preparar dados para envio - mapear campos do formulário para campos da tabela
      const patientData = {
        name: formData.name.trim(),
        email: formData.email?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        address: formData.address?.trim() || undefined,
        birth_date: formData.birth_date ? convertDateToISO(formData.birth_date) : undefined,
        gender: formData.gender,
        cpf: formData.cpf?.trim() || undefined,
        emergency_contact: formData.emergency_contact?.trim() || undefined,
        emergency_phone: formData.emergency_phone?.trim() || undefined,
        medical_history: formData.medical_history?.trim() || undefined,
        allergies: formData.allergies?.trim() || undefined,
        current_medications: formData.medications?.trim() || undefined,
        medicamento_freq: formData.medicamento_freq?.trim() || undefined,
        historico_cirurgico: formData.surgical_history?.trim() || undefined,
        data_ultima_cirurgia: formData.surgical_date ? convertDateToISO(formData.surgical_date) : undefined,
        convenio: formData.convenio?.trim() || undefined,
        convenio_vigencia: formData.convenio_vigencia ? convertDateToISO(formData.convenio_vigencia) : undefined
      };

      // Remover campos vazios/undefined
      Object.keys(patientData).forEach(key => {
        const value = (patientData as any)[key];
        if (value === '' || value === undefined || value === null) {
          delete (patientData as any)[key];
        }
      });

      console.log('Dados do paciente para envio:', patientData);

      // Fazer a chamada para a API
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patientData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao cadastrar paciente');
      }

      const result = await response.json();
      console.log('Paciente cadastrado com sucesso:', result);
      
      // Salvar ID do paciente para upload de avatar
      if (result.patient && result.patient.id) {
        setPatientId(result.patient.id);
      }
      
      // Redirecionar diretamente para a lista de pacientes
      router.push('/pacientes');
    } catch (error) {
      console.error('Erro ao cadastrar paciente:', error);
      alert(`Erro ao cadastrar paciente: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Função para converter data do formato DD/MM/YYYY para YYYY-MM-DD
  const convertDateToISO = (dateString: string): string | undefined => {
    if (!dateString) return undefined;
    
    // Remover caracteres não numéricos
    const cleanDate = dateString.replace(/\D/g, '');
    
    // Verificar se tem 8 dígitos (DDMMYYYY)
    if (cleanDate.length === 8) {
      const day = cleanDate.substring(0, 2);
      const month = cleanDate.substring(2, 4);
      const year = cleanDate.substring(4, 8);
      
      // Validar data básica
      const dayNum = parseInt(day);
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      
      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
        return `${year}-${month}-${day}`;
      }
    }
    
    return undefined;
  };


  return (
    <div className="cadastro-container">
      <div className="cadastro-header">
        <h1 className="cadastro-title">Adicionar Novo Paciente</h1>
      </div>

      <form onSubmit={handleSubmit} className="cadastro-form">
        {/* Informações do Paciente */}
        <div className="form-section">
          <div className="section-header">
            <div className="section-icon-wrapper">
              <User className="section-icon" />
            </div>
            <h2 className="section-title">Informações do Paciente</h2>
          </div>

          {patientId && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
              <AvatarUpload
                currentImageUrl={profilePicUrl}
                onUploadComplete={(url) => {
                  setProfilePicUrl(url);
                }}
                userId={patientId}
                userType="paciente"
                size="large"
              />
            </div>
          )}

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="name" className="field-label">Nome Completo</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="form-input"
                placeholder="Felipe Porto de Oliveira"
              />
            </div>

            <div className="form-field">
              <label htmlFor="phone" className="field-label">Número de Telefone</label>
              <div className="phone-input-wrapper">
                <span className="phone-flag">🇧🇷</span>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', formatPhone(e.target.value))}
                  className="form-input phone-input"
                  placeholder="+62 878299910122"
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="address" className="field-label">Endereço</label>
              <input
                id="address"
                type="text"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="form-input"
                placeholder="Av. Alameda Tocantins, 125"
              />
            </div>

            <div className="form-field">
              <label htmlFor="email" className="field-label">Email</label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="form-input"
                placeholder="paciente@email.com"
              />
            </div>


            <div className="form-field">
              <label htmlFor="gender" className="field-label">Sexo</label>
              <select
                id="gender"
                value={formData.gender || ''}
                onChange={(e) => handleChange('gender', e.target.value as 'M' | 'F' | 'O')}
                className="form-input"
              >
                <option value="">Selecione</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="O">Outro</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="birth_date" className="field-label">Data de Nascimento</label>
              <div className="date-input-wrapper">
                <input
                  id="birth_date"
                  type="text"
                  value={formData.birth_date}
                  onChange={(e) => handleChange('birth_date', formatDate(e.target.value))}
                  className="form-input"
                  placeholder="25/04/2019"
                  maxLength={10}
                />
                <Calendar className="date-icon" />
              </div>
            </div>

          </div>

        </div>

        {/* Histórico Médico */}
        <div className="form-section">
          <div className="section-header">
            <div className="section-icon-wrapper">
              <FileText className="section-icon" />
            </div>
            <h2 className="section-title">Histórico Médico</h2>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="allergies" className="field-label">Alergias</label>
              <textarea
                id="allergies"
                value={formData.allergies}
                onChange={(e) => handleChange('allergies', e.target.value)}
                className="form-textarea"
                placeholder="Liste aqui suas alergias"
                rows={3}
              />
            </div>

            <div className="form-field">
              <label htmlFor="medications" className="field-label">Medicações Atuais</label>
              <textarea
                id="medications"
                value={formData.medications}
                onChange={(e) => handleChange('medications', e.target.value)}
                className="form-textarea"
                placeholder="Metacam 1.5mg/mL"
                rows={3}
              />
            </div>


            <div className="form-field">
              <label htmlFor="medical_history" className="field-label">Histórico Médico</label>
              <textarea
                id="medical_history"
                value={formData.medical_history}
                onChange={(e) => handleChange('medical_history', e.target.value)}
                className="form-textarea"
                placeholder="Doenças prévias, cirurgias, etc."
                rows={3}
              />
            </div>

            <div className="form-field-row">
              <div className="form-field">
                <label htmlFor="surgical_history" className="field-label">Histórico Cirúrgico</label>
                <textarea
                  id="surgical_history"
                  value={formData.surgical_history}
                  onChange={(e) => handleChange('surgical_history', e.target.value)}
                  className="form-textarea"
                  placeholder="Liste aqui"
                  rows={3}
                />
              </div>

              <div className="form-field">
                <label htmlFor="surgical_date" className="field-label">Data Cirúrgica</label>
                <div className="date-input-wrapper">
                  <input
                    id="surgical_date"
                    type="text"
                    value={formData.surgical_date}
                    onChange={(e) => handleChange('surgical_date', formatDate(e.target.value))}
                    className="form-input"
                    placeholder="25/04/2019"
                    maxLength={10}
                  />
                  <Calendar className="date-icon" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Informação sobre Convênio */}
        <div className="form-section">
          <div className="section-header">
            <div className="section-icon-wrapper">
              <Shield className="section-icon" />
            </div>
            <h2 className="section-title">Informação sobre Convênio</h2>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="cpf" className="field-label">CPF</label>
              <input
                id="cpf"
                type="text"
                value={formData.cpf}
                onChange={(e) => handleChange('cpf', formatCPF(e.target.value))}
                className="form-input"
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </div>

            <div className="form-field">
              <label htmlFor="convenio" className="field-label">Nome do Convênio</label>
              <input
                id="convenio"
                type="text"
                value={formData.convenio}
                onChange={(e) => handleChange('convenio', e.target.value)}
                className="form-input"
                placeholder="Amil"
              />
            </div>

            <div className="form-field">
              <label htmlFor="convenio_vigencia" className="field-label">Data de Vigência do Convênio</label>
              <div className="date-input-wrapper">
                <input
                  id="convenio_vigencia"
                  type="text"
                  value={formData.convenio_vigencia}
                  onChange={(e) => handleChange('convenio_vigencia', formatDate(e.target.value))}
                  className="form-input"
                  placeholder="25/04/2025"
                  maxLength={10}
                />
                <Calendar className="date-icon" />
              </div>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="form-actions">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-secondary"
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="btn-spinner"></div>
                Salvando...
              </>
            ) : (
              'Salvar Paciente'
            )}
          </button>
        </div>
      </form>

    </div>
  );
}

