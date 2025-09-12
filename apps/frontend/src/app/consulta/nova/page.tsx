'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Monitor, Users, Check, Loader2 } from 'lucide-react';
import { getPatients, createConsultation } from '@/lib/supabase';

interface Patient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: string;
}

interface MicrophoneDevice {
  deviceId: string;
  label: string;
}

// Função para criar sessão presencial
async function createPresentialSession(consultationId: string, participantData: any) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001'}/api/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      consultation_id: consultationId,
      session_type: 'presencial',
      participants: participantData,
      consent: true,
      metadata: {
        appointmentType: 'presencial'
      }
    }),
  });

  if (!response.ok) {
    throw new Error('Falha ao criar sessão presencial');
  }

  return response.json();
}

export default function NovaConsultaPage() {
  const router = useRouter();
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [appointmentType, setAppointmentType] = useState<'presencial' | 'online'>('online');
  const [selectedDoctorMic, setSelectedDoctorMic] = useState<string>('');
  const [selectedPatientMic, setSelectedPatientMic] = useState<string>('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [microphones, setMicrophones] = useState<MicrophoneDevice[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [isCreatingConsultation, setIsCreatingConsultation] = useState(false);

  useEffect(() => {
    // Carregar pacientes e microfones
    const initializeData = async () => {
      try {
        // Carregar pacientes do Supabase
        setLoadingPatients(true);
        const patientsData = await getPatients();
        setPatients(patientsData);
      } catch (error) {
        console.error('Erro ao carregar pacientes:', error);
      } finally {
        setLoadingPatients(false);
      }

      // Solicitar permissões e listar microfones disponíveis
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices
          .filter(device => device.kind === 'audioinput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Microfone ${device.deviceId.substring(0, 5)}...`,
          }));
        setMicrophones(audioInputs);
      } catch (error) {
        console.error('Erro ao acessar microfones:', error);
      }
    };

    initializeData();
  }, []);

  const handleStartConsultation = async () => {
    if (!selectedPatient || !selectedDoctorMic || !consentGiven) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (appointmentType === 'presencial' && !selectedPatientMic) {
      alert('Para consultas presenciais, selecione o microfone do paciente.');
      return;
    }

    setIsCreatingConsultation(true);

    try {
      // Encontrar o paciente selecionado
      const selectedPatientData = patients.find(p => p.id === selectedPatient);
      if (!selectedPatientData) {
        throw new Error('Paciente não encontrado');
      }

      // Criar consulta no Supabase
      const consultation = await createConsultation({
        patient_id: selectedPatient,
        consultation_type: appointmentType === 'presencial' ? 'PRESENCIAL' : 'TELEMEDICINA',
        patient_name: selectedPatientData.name,
      });

      console.log('Consulta criada:', consultation);

      // Verificar tipo de consulta e redirecionar adequadamente
      if (appointmentType === 'presencial') {
        // Fluxo para consulta presencial
        try {
          const participantData = {
            doctor: {
              id: 'doctor-current', // TODO: Pegar do contexto de auth
              name: 'Dr. Médico', // TODO: Pegar do contexto de auth
              email: 'doctor@medcall.ai' // TODO: Pegar do contexto de auth
            },
            patient: {
              id: selectedPatient,
              name: selectedPatientData.name,
              email: selectedPatientData.email || ''
            }
          };

          // Criar sessão presencial no gateway
          const session = await createPresentialSession(consultation.id, participantData);
          
          console.log('Sessão presencial criada:', session);

          // Redirecionar para página de consulta presencial
          const searchParams = new URLSearchParams({
            sessionId: session.session.id,
            consultationId: consultation.id,
            doctorMicId: selectedDoctorMic,
            patientMicId: selectedPatientMic,
            patientName: selectedPatientData.name
          });

          router.push(`/consulta/presencial?${searchParams.toString()}`);
          
        } catch (sessionError) {
          console.error('Erro ao criar sessão presencial:', sessionError);
          alert('Erro ao criar sessão presencial. Tente novamente.');
        }
      } else {
        // Fluxo para consulta online (a ser implementado)
        alert('Consulta online ainda não implementada. Use consulta presencial.');
        // TODO: Implementar fluxo online com LiveKit
        // router.push(`/call/${consultation.id}`);
      }
      
    } catch (error) {
      console.error('Erro ao criar consulta:', error);
      alert('Erro ao criar consulta. Tente novamente.');
    } finally {
      setIsCreatingConsultation(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Nova Consulta</h1>
        <p className="page-subtitle">
          Configure os parâmetros para iniciar uma nova consulta médica
        </p>
      </div>

      <div className="consultation-form">
        <div className="form-card">
          <h2 className="form-section-title">
            <Users className="form-section-icon" />
            Informações do Paciente
          </h2>
          
          <div className="form-group">
            <label htmlFor="patient-select" className="form-label">
              Selecionar Paciente *
            </label>
            <select
              id="patient-select"
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              className="form-select"
              required
              disabled={loadingPatients}
            >
              <option value="">
                {loadingPatients ? 'Carregando pacientes...' : 'Selecione um paciente'}
              </option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name} {patient.email ? `- ${patient.email}` : ''} {patient.city ? `(${patient.city})` : ''}
                </option>
              ))}
            </select>
            {loadingPatients && (
              <div className="loading-indicator">
                <Loader2 className="loading-icon" />
                <span>Carregando pacientes...</span>
              </div>
            )}
            {!loadingPatients && patients.length === 0 && (
              <p className="form-helper-text">
                Nenhum paciente encontrado. Cadastre pacientes primeiro.
              </p>
            )}
          </div>
        </div>

        <div className="form-card">
          <h2 className="form-section-title">
            <Monitor className="form-section-icon" />
            Tipo de Atendimento
          </h2>
          
          <div className="form-group">
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="appointment-type"
                  value="online"
                  checked={appointmentType === 'online'}
                  onChange={(e) => setAppointmentType(e.target.value as 'online')}
                  className="radio-input"
                />
                <span className="radio-label">Online</span>
              </label>
              
              <label className="radio-option">
                <input
                  type="radio"
                  name="appointment-type"
                  value="presencial"
                  checked={appointmentType === 'presencial'}
                  onChange={(e) => setAppointmentType(e.target.value as 'presencial')}
                  className="radio-input"
                />
                <span className="radio-label">Presencial</span>
              </label>
            </div>
          </div>
        </div>

        <div className="form-card">
          <h2 className="form-section-title">
            <Mic className="form-section-icon" />
            Configuração de Áudio
          </h2>
          
          <div className="form-group">
            <label htmlFor="doctor-mic-select" className="form-label">
              Microfone do Médico *
            </label>
            <select
              id="doctor-mic-select"
              value={selectedDoctorMic}
              onChange={(e) => setSelectedDoctorMic(e.target.value)}
              className="form-select"
              required
            >
              <option value="">Selecione um microfone</option>
              {microphones.map((mic) => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {mic.label}
                </option>
              ))}
            </select>
          </div>

          {appointmentType === 'presencial' && (
            <div className="form-group">
              <label htmlFor="patient-mic-select" className="form-label">
                Microfone do Paciente *
              </label>
              <select
                id="patient-mic-select"
                value={selectedPatientMic}
                onChange={(e) => setSelectedPatientMic(e.target.value)}
                className="form-select"
                required
              >
                <option value="">Selecione um microfone</option>
                {microphones.map((mic) => (
                  <option key={mic.deviceId} value={mic.deviceId}>
                    {mic.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="form-card">
          <h2 className="form-section-title">
            <Check className="form-section-icon" />
            Consentimento
          </h2>
          
          <div className="form-group">
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="checkbox-input"
                required
              />
              <span className="checkbox-label">
                Eu confirmo que o paciente foi informado e consentiu com a gravação 
                e transcrição da consulta para fins médicos e de análise.
              </span>
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button
            onClick={handleStartConsultation}
            className="btn btn-primary btn-large"
            disabled={!selectedPatient || !selectedDoctorMic || !consentGiven || 
                     (appointmentType === 'presencial' && !selectedPatientMic) ||
                     isCreatingConsultation || loadingPatients}
          >
            {isCreatingConsultation ? (
              <>
                <Loader2 className="loading-icon" />
                Criando Consulta...
              </>
            ) : (
              'Iniciar Consulta'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
