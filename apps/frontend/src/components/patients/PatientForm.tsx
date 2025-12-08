'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Save, User, Mail, Phone, MapPin, Calendar, FileText, AlertTriangle, Upload, Trash2 } from 'lucide-react';
import { AvatarUpload } from '@/components/shared/AvatarUpload';
import { supabase } from '@/lib/supabase';
import './PatientForm.css';

// Tipos locais para pacientes
interface Patient {
  id: string;
  doctor_id: string;
  name: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  gender?: 'M' | 'F' | 'O';
  cpf?: string;
  address?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  medical_history?: string;
  allergies?: string;
  current_medications?: string;
  profile_pic?: string | null;
  status: 'active' | 'inactive' | 'archived';
  created_at: string;
  updated_at: string;
}

interface CreatePatientData {
  name: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  gender?: 'M' | 'F' | 'O';
  cpf?: string;
  address?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  medical_history?: string;
  allergies?: string;
  current_medications?: string;
  status?: 'active' | 'inactive' | 'archived';
}

interface PatientFormProps {
  patient?: Patient;
  onSubmit: (data: CreatePatientData) => void;
  onCancel: () => void;
  title: string;
}

export function PatientForm({ patient, onSubmit, onCancel, title }: PatientFormProps) {
  const [formData, setFormData] = useState<CreatePatientData>({
    name: '',
    email: '',
    phone: '',
    birth_date: '',
    gender: undefined,
    cpf: '',
    address: '',
    emergency_contact: '',
    emergency_phone: '',
    medical_history: '',
    allergies: '',
    current_medications: '',
    status: 'active',
  });

  const [errors, setErrors] = useState<Partial<CreatePatientData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [medicalFiles, setMedicalFiles] = useState<Array<{ id: string; name: string; url: string; file?: File }>>([]);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preencher formulário se estiver editando
  useEffect(() => {
    if (patient) {
      setFormData({
        name: patient.name,
        email: patient.email || '',
        phone: patient.phone || '',
        birth_date: patient.birth_date || '',
        gender: patient.gender,
        cpf: patient.cpf || '',
        address: patient.address || '',
        emergency_contact: patient.emergency_contact || '',
        emergency_phone: patient.emergency_phone || '',
        medical_history: patient.medical_history || '',
        allergies: patient.allergies || '',
        current_medications: patient.current_medications || '',
        status: patient.status,
      });
    }
  }, [patient]);

  // Validação do formulário
  const validateForm = (): boolean => {
    const newErrors: Partial<CreatePatientData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (formData.cpf && !/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(formData.cpf)) {
      newErrors.cpf = 'CPF inválido (formato: 000.000.000-00)';
    }

    if (formData.birth_date) {
      const birthDate = new Date(formData.birth_date);
      const today = new Date();
      if (birthDate > today) {
        newErrors.birth_date = 'Data de nascimento não pode ser futura';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manipular mudanças nos campos
  const handleChange = (field: keyof CreatePatientData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Limpar erro do campo quando usuário começar a digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Manipular envio do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Limpar campos vazios antes de enviar
      const cleanedData: CreatePatientData = {
        name: formData.name,
        ...Object.fromEntries(
          Object.entries(formData).filter(([key, value]) => 
            key !== 'name' && value !== '' && value !== undefined && value !== null
          )
        )
      } as CreatePatientData;
      
      console.log('📋 Dados do formulário antes do envio:', formData);
      console.log('🧹 Dados limpos para envio:', cleanedData);
      
      onSubmit(cleanedData);
    } catch (error) {
      console.error('Erro ao submeter formulário:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Formatar CPF
  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  // Formatar telefone
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
  };

  // Manipular seleção de arquivos
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(async (file) => {
      // Validar tamanho (máximo 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(`O arquivo ${file.name} excede o tamanho máximo de 10MB`);
        return;
      }

      // Validar tipo
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        alert(`O arquivo ${file.name} não é um tipo permitido. Use PDF, DOC, DOCX, JPG ou PNG`);
        return;
      }

      const fileId = Math.random().toString(36).substr(2, 9);
      setUploadingFiles(prev => [...prev, fileId]);

      try {
        // Se estiver editando um paciente, fazer upload para o Supabase
        if (patient?.id) {
          const fileExt = file.name.split('.').pop();
          const fileName = `paciente_${patient.id}_historico_${Date.now()}.${fileExt}`;
          const filePath = `pacientes/historicos/${fileName}`;

          const { error: uploadError, data } = await supabase.storage
            .from('medical_files')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            throw uploadError;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('medical_files')
            .getPublicUrl(filePath);

          setMedicalFiles(prev => [...prev, { id: fileId, name: file.name, url: publicUrl }]);
        } else {
          // Se estiver criando, apenas adicionar à lista (será enviado depois)
          setMedicalFiles(prev => [...prev, { id: fileId, name: file.name, url: '', file }]);
        }
      } catch (error: any) {
        console.error('Erro ao fazer upload:', error);
        alert(`Erro ao fazer upload do arquivo ${file.name}: ${error.message}`);
      } finally {
        setUploadingFiles(prev => prev.filter(id => id !== fileId));
      }
    });

    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remover arquivo
  const handleRemoveFile = async (fileId: string, fileUrl: string) => {
    try {
      // Se tiver URL, tentar deletar do Supabase
      if (fileUrl && patient?.id) {
        const filePath = fileUrl.split('/').slice(-2).join('/');
        await supabase.storage
          .from('medical_files')
          .remove([filePath]);
      }

      setMedicalFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (error) {
      console.error('Erro ao remover arquivo:', error);
      // Remover da lista mesmo se der erro no Supabase
      setMedicalFiles(prev => prev.filter(f => f.id !== fileId));
    }
  };

  return (
    <div className="form-container">
      {/* Header */}
      <div className="form-header">
        <h2 className="form-title">{title}</h2>
        <button
          onClick={onCancel}
          className="form-close-btn"
          type="button"
        >
          <X className="close-icon" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="form-content">
        {/* Avatar - apenas quando editando */}
        {patient && patient.id && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
            <AvatarUpload
              currentImageUrl={patient.profile_pic}
              onUploadComplete={(url) => {
                // Avatar foi atualizado com sucesso
                console.log('Avatar atualizado:', url);
              }}
              userId={patient.id}
              userType="paciente"
              size="large"
            />
          </div>
        )}

        {/* Informações Básicas */}
        <div className="form-section">
          <div className="section-header">
            <User className="section-icon" />
            <h3 className="section-title">Informações Básicas</h3>
          </div>
          
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="name" className="field-label">
                Nome Completo *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`form-input ${errors.name ? 'error' : ''}`}
                placeholder="Digite o nome completo"
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            <div className="form-field">
              <label htmlFor="email" className="field-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={`form-input ${errors.email ? 'error' : ''}`}
                placeholder="email@exemplo.com"
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            <div className="form-field">
              <label htmlFor="phone" className="field-label">
                Telefone
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', formatPhone(e.target.value))}
                className="form-input"
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="form-field">
              <label htmlFor="cpf" className="field-label">
                CPF
              </label>
              <input
                id="cpf"
                type="text"
                value={formData.cpf}
                onChange={(e) => handleChange('cpf', formatCPF(e.target.value))}
                className={`form-input ${errors.cpf ? 'error' : ''}`}
                placeholder="000.000.000-00"
                maxLength={14}
              />
              {errors.cpf && <span className="field-error">{errors.cpf}</span>}
            </div>

            <div className="form-field">
              <label htmlFor="birth_date" className="field-label">
                Data de Nascimento
              </label>
              <input
                id="birth_date"
                type="date"
                value={formData.birth_date ? new Date(formData.birth_date).toISOString().split('T')[0] : ''}
                onChange={(e) => handleChange('birth_date', e.target.value)}
                className={`form-input ${errors.birth_date ? 'error' : ''}`}
              />
              {errors.birth_date && <span className="field-error">{errors.birth_date}</span>}
            </div>

            <div className="form-field">
              <label htmlFor="gender" className="field-label">
                Sexo
              </label>
              <select
                id="gender"
                value={formData.gender || ''}
                onChange={(e) => handleChange('gender', e.target.value as 'M' | 'F' | 'O')}
                className="form-select"
              >
                <option value="">Selecione</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="O">Outro</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="status" className="field-label">
                Status
              </label>
              <select
                id="status"
                value={formData.status || 'active'}
                onChange={(e) => handleChange('status', e.target.value as 'active' | 'inactive' | 'archived')}
                className="form-select"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="form-section">
          <div className="section-header">
            <MapPin className="section-icon" />
            <h3 className="section-title">Endereço</h3>
          </div>
          
          <div className="form-grid">
            <div className="form-field full-width">
              <label htmlFor="address" className="field-label">
                Endereço Completo
              </label>
              <input
                id="address"
                type="text"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="form-input"
                placeholder="Rua, número, bairro"
              />
            </div>

          </div>
        </div>

        {/* Contato de Emergência */}
        <div className="form-section">
          <div className="section-header">
            <AlertTriangle className="section-icon" />
            <h3 className="section-title">Contato de Emergência</h3>
          </div>
          
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="emergency_contact" className="field-label">
                Nome do Contato
              </label>
              <input
                id="emergency_contact"
                type="text"
                value={formData.emergency_contact}
                onChange={(e) => handleChange('emergency_contact', e.target.value)}
                className="form-input"
                placeholder="Nome do contato de emergência"
              />
            </div>

            <div className="form-field">
              <label htmlFor="emergency_phone" className="field-label">
                Telefone do Contato
              </label>
              <input
                id="emergency_phone"
                type="tel"
                value={formData.emergency_phone}
                onChange={(e) => handleChange('emergency_phone', formatPhone(e.target.value))}
                className="form-input"
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
        </div>

        {/* Informações Médicas */}
        <div className="form-section medical-info-section">
          <div className="section-header">
            <FileText className="section-icon" />
            <h3 className="section-title">Informações Médicas</h3>
          </div>
          
          <div className="medical-info-grid">
            <div className="medical-info-card">
              <div className="medical-info-header">
                <label htmlFor="medical_history" className="field-label medical-label">
                  <FileText className="field-icon" size={18} />
                  Histórico Médico
                </label>
                <span className="char-count">
                  {formData.medical_history?.length || 0} caracteres
                </span>
              </div>
              <textarea
                id="medical_history"
                value={formData.medical_history}
                onChange={(e) => handleChange('medical_history', e.target.value)}
                className="form-textarea medical-textarea"
                placeholder="Exemplo:&#10;- Hipertensão diagnosticada em 2018&#10;- Diabetes tipo 2 desde 2020&#10;- Cirurgia de apendicite em 2015&#10;- Histórico familiar de doenças cardíacas"
                rows={6}
                style={{
                  resize: 'vertical',
                  minHeight: '120px',
                  fontFamily: 'inherit',
                  lineHeight: '1.6'
                }}
              />
              <div className="field-hint">
                <span className="hint-text">Dica: Liste doenças, cirurgias, condições crônicas e histórico familiar</span>
              </div>
              
              {/* Upload de Arquivos de Histórico */}
              <div className="medical-files-upload">
                <div className="medical-files-header">
                  <label className="medical-files-label">
                    <FileText className="field-icon" size={16} />
                    Arquivos de Histórico Médico
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="medical-files-upload-btn"
                    disabled={isSubmitting || uploadingFiles.length > 0}
                  >
                    <Upload size={16} />
                    Adicionar Arquivo
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="medical-files-input"
                  disabled={isSubmitting || uploadingFiles.length > 0}
                />
                <p className="medical-files-hint">
                  Formatos aceitos: PDF, DOC, DOCX, JPG, PNG (máximo 10MB por arquivo)
                </p>
                
                {medicalFiles.length > 0 && (
                  <div className="medical-files-list">
                    {medicalFiles.map((file) => (
                      <div key={file.id} className="medical-file-item">
                        <FileText size={16} className="medical-file-icon" />
                        <span className="medical-file-name" title={file.name}>
                          {file.name}
                        </span>
                        {uploadingFiles.includes(file.id) ? (
                          <span className="medical-file-status">Enviando...</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(file.id, file.url)}
                            className="medical-file-remove"
                            disabled={isSubmitting}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="medical-info-card">
              <div className="medical-info-header">
                <label htmlFor="allergies" className="field-label medical-label">
                  <AlertTriangle className="field-icon" size={18} />
                  Alergias
                </label>
                <span className="char-count">
                  {formData.allergies?.length || 0} caracteres
                </span>
              </div>
              <textarea
                id="allergies"
                value={formData.allergies}
                onChange={(e) => handleChange('allergies', e.target.value)}
                className="form-textarea medical-textarea"
                placeholder="Exemplo:&#10;- Penicilina (reação: urticária)&#10;- Amendoim (anafilaxia)&#10;- Látex (irritação cutânea)&#10;- Nenhuma alergia conhecida"
                rows={5}
                style={{
                  resize: 'vertical',
                  minHeight: '100px',
                  fontFamily: 'inherit',
                  lineHeight: '1.6'
                }}
              />
              <div className="field-hint">
                <span className="hint-text">Importante: Liste todas as alergias conhecidas, incluindo reações</span>
              </div>
            </div>

            <div className="medical-info-card">
              <div className="medical-info-header">
                <label htmlFor="current_medications" className="field-label medical-label">
                  <FileText className="field-icon" size={18} />
                  Medicamentos em Uso
                </label>
                <span className="char-count">
                  {formData.current_medications?.length || 0} caracteres
                </span>
              </div>
              <textarea
                id="current_medications"
                value={formData.current_medications}
                onChange={(e) => handleChange('current_medications', e.target.value)}
                className="form-textarea medical-textarea"
                placeholder="Exemplo:&#10;- Losartana 50mg - 1x ao dia (manhã)&#10;- Metformina 850mg - 2x ao dia (manhã e noite)&#10;- Omeprazol 20mg - 1x ao dia (jejum)&#10;- Nenhum medicamento em uso"
                rows={5}
                style={{
                  resize: 'vertical',
                  minHeight: '100px',
                  fontFamily: 'inherit',
                  lineHeight: '1.6'
                }}
              />
              <div className="field-hint">
                <span className="hint-text">Inclua nome do medicamento, dosagem e frequência de uso</span>
              </div>
            </div>
          </div>
        </div>

        {/* Botões */}
        <div className="form-actions">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="btn btn-secondary"
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            disabled={isSubmitting}
            className={`btn ${patient ? 'btn-update' : 'btn-primary'}`}
          >
            {isSubmitting ? (
              <>
                <div className="btn-spinner"></div>
                Salvando...
              </>
            ) : (
              <>
                <Save className="btn-icon" />
                {patient ? 'Atualizar' : 'Criar'} Paciente
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}