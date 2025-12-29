'use client';

import { useEffect, useState } from 'react';
import { Stethoscope, User, AlertTriangle } from 'lucide-react';
import { AudioLevelIndicator } from './AudioLevelIndicator';

interface AudioDevice {
    deviceId: string;
    label: string;
}

interface DualMicrophoneControlProps {
    onMicrophonesSelected: (doctorMic: string, patientMic: string) => void;
    doctorLevel?: number;
    patientLevel?: number;
    disabled?: boolean;
}

export function DualMicrophoneControl({
    onMicrophonesSelected,
    doctorLevel = 0,
    patientLevel = 0,
    disabled = false
}: DualMicrophoneControlProps) {
    const [devices, setDevices] = useState<AudioDevice[]>([]);
    const [doctorMic, setDoctorMic] = useState('');
    const [patientMic, setPatientMic] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAudioDevices();
    }, []);

    const loadAudioDevices = async () => {
        try {
            // Solicitar permissão
            await navigator.mediaDevices.getUserMedia({ audio: true });

            // Listar dispositivos
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = allDevices
                .filter(device => device.kind === 'audioinput')
                .map(device => ({
                    deviceId: device.deviceId,
                    label: device.label || `Microfone ${device.deviceId.slice(0, 8)}`
                }));

            setDevices(audioInputs);

            // Tentar carregar seleções salvas do localStorage
            const savedDoctorMic = localStorage.getItem('presencial_doctor_mic');
            const savedPatientMic = localStorage.getItem('presencial_patient_mic');

            let doctorMicId = '';
            let patientMicId = '';

            // Verificar se os dispositivos salvos ainda existem
            const doctorMicExists = savedDoctorMic && audioInputs.some(d => d.deviceId === savedDoctorMic);
            const patientMicExists = savedPatientMic && audioInputs.some(d => d.deviceId === savedPatientMic);

            if (doctorMicExists && patientMicExists) {
                // Usar seleções salvas
                doctorMicId = savedDoctorMic;
                patientMicId = savedPatientMic;
                console.log('✅ Microfones salvos carregados do localStorage');
            } else {
                // Fallback para primeiros dois dispositivos
                if (audioInputs.length >= 2) {
                    doctorMicId = audioInputs[0].deviceId;
                    patientMicId = audioInputs[1].deviceId;
                } else if (audioInputs.length === 1) {
                    // Apenas 1 microfone - usar o mesmo para ambos
                    doctorMicId = audioInputs[0].deviceId;
                    patientMicId = audioInputs[0].deviceId;
                }
                console.log('📌 Usando microfones padrão (primeiros 2 dispositivos)');
            }

            if (doctorMicId && patientMicId) {
                setDoctorMic(doctorMicId);
                setPatientMic(patientMicId);
                onMicrophonesSelected(doctorMicId, patientMicId);
            }

        } catch (error) {
            console.error('Erro ao carregar dispositivos de áudio:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDoctorMicChange = (deviceId: string) => {
        setDoctorMic(deviceId);
        localStorage.setItem('presencial_doctor_mic', deviceId);
        onMicrophonesSelected(deviceId, patientMic);
        console.log('💾 Microfone do médico salvo:', deviceId);
    };

    const handlePatientMicChange = (deviceId: string) => {
        setPatientMic(deviceId);
        localStorage.setItem('presencial_patient_mic', deviceId);
        onMicrophonesSelected(doctorMic, deviceId);
        console.log('💾 Microfone do paciente salvo:', deviceId);
    };

    if (loading) {
        return (
            <div className="dual-microphone-control loading">
                <p>Carregando dispositivos de áudio...</p>
            </div>
        );
    }

    if (devices.length === 0) {
        return (
            <div className="dual-microphone-control error">
                <AlertTriangle className="error-icon" size={32} />
                <p>Nenhum microfone detectado</p>
                <p className="hint">Conecte um microfone e recarregue a página</p>
            </div>
        );
    }

    return (
        <div className="dual-microphone-control">
            <div className="microphone-section">
                <div className="microphone-header">
                    <Stethoscope className="header-icon" size={20} />
                    <h4>Microfone do Médico</h4>
                </div>
                <select
                    value={doctorMic}
                    onChange={(e) => handleDoctorMicChange(e.target.value)}
                    disabled={disabled}
                    className="microphone-select"
                >
                    {devices.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                            {device.label}
                        </option>
                    ))}
                </select>
                <AudioLevelIndicator
                    level={doctorLevel}
                    label="Nível de Áudio"
                    isSpeaking={doctorLevel > 0.02}
                />
            </div>

            <div className="microphone-section">
                <div className="microphone-header">
                    <User className="header-icon" size={20} />
                    <h4>Microfone do Paciente</h4>
                </div>
                <select
                    value={patientMic}
                    onChange={(e) => handlePatientMicChange(e.target.value)}
                    disabled={disabled}
                    className="microphone-select"
                >
                    {devices.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                            {device.label}
                        </option>
                    ))}
                </select>
                <AudioLevelIndicator
                    level={patientLevel}
                    label="Nível de Áudio"
                    isSpeaking={patientLevel > 0.02}
                />
            </div>

            {devices.length < 2 && (
                <div className="warning-message">
                    <AlertTriangle className="warning-icon" size={18} />
                    <span>Apenas 1 microfone detectado. O mesmo microfone será usado para médico e paciente.</span>
                </div>
            )}

            <style jsx>{`
        .dual-microphone-control {
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 32px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          border: 1px solid #E5E7EB;
        }
        
        .dual-microphone-control.loading,
        .dual-microphone-control.error {
          text-align: center;
          padding: 40px;
          color: #6b7280;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        
        .dual-microphone-control.error {
          color: #ef4444;
        }
        
        .error-icon {
          color: #ef4444;
          margin-bottom: 8px;
        }
        
        .hint {
          font-size: 14px;
          margin-top: 8px;
          color: #6b7280;
        }
        
        .microphone-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 24px;
          border-radius: 10px;
          background: #F9FAFB;
          border: 1px solid #E5E7EB;
        }
        
        .microphone-header {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .microphone-header h4 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #1B4266;
        }
        
        .header-icon {
          color: #1B4266;
          flex-shrink: 0;
        }
        
        .microphone-select {
          padding: 12px 16px;
          border: 2px solid #E5E7EB;
          border-radius: 8px;
          font-size: 15px;
          background: white;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 500;
        }
        
        .microphone-select:hover:not(:disabled) {
          border-color: #1B4266;
          box-shadow: 0 0 0 3px rgba(27, 66, 102, 0.1);
        }
        
        .microphone-select:focus {
          outline: none;
          border-color: #1B4266;
          box-shadow: 0 0 0 3px rgba(27, 66, 102, 0.1);
        }
        
        .microphone-select:disabled {
          background: #f3f4f6;
          cursor: not-allowed;
          opacity: 0.6;
        }
        
        .warning-message {
          padding: 14px 18px;
          background: #FEF3C7;
          border-left: 4px solid #F59E0B;
          border-radius: 8px;
          font-size: 14px;
          color: #92400E;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .warning-icon {
          color: #F59E0B;
          flex-shrink: 0;
        }
      `}</style>
        </div>
    );
}
