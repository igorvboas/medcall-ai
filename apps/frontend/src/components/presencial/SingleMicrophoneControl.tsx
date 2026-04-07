'use client';

import { useEffect, useState } from 'react';
import { Stethoscope, AlertTriangle } from 'lucide-react';

interface AudioDevice {
    deviceId: string;
    label: string;
}

interface SingleMicrophoneControlProps {
    onMicrophoneSelected: (micId: string) => void;
    audioLevel?: number;
    disabled?: boolean;
    initialMic?: string;
}

const STORAGE_KEY = 'presencial_single_mic';

export function SingleMicrophoneControl({
    onMicrophoneSelected,
    audioLevel = 0,
    disabled = false,
    initialMic
}: SingleMicrophoneControlProps) {
    const [devices, setDevices] = useState<AudioDevice[]>([]);
    const [selectedMic, setSelectedMic] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAudioDevices();
    }, []);

    const loadAudioDevices = async () => {
        try {
            // Solicitar permissao
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

            let micId = '';

            // Prioridade: 1) props initialMic, 2) localStorage, 3) primeiro dispositivo
            const propMicExists = initialMic && audioInputs.some(d => d.deviceId === initialMic);

            if (propMicExists) {
                micId = initialMic;
                console.log('[SingleMicControl] Microfone carregado das props iniciais');
            } else {
                const savedMic = localStorage.getItem(STORAGE_KEY);
                const savedMicExists = savedMic && audioInputs.some(d => d.deviceId === savedMic);

                if (savedMicExists) {
                    micId = savedMic;
                    console.log('[SingleMicControl] Microfone salvo carregado do localStorage');
                } else if (audioInputs.length > 0) {
                    micId = audioInputs[0].deviceId;
                    console.log('[SingleMicControl] Usando primeiro microfone disponivel');
                }
            }

            if (micId) {
                setSelectedMic(micId);
                localStorage.setItem(STORAGE_KEY, micId);
                onMicrophoneSelected(micId);
            }

        } catch (error) {
            console.error('[SingleMicControl] Erro ao carregar dispositivos de audio:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMicChange = (deviceId: string) => {
        setSelectedMic(deviceId);
        localStorage.setItem(STORAGE_KEY, deviceId);
        onMicrophoneSelected(deviceId);
        console.log('[SingleMicControl] Microfone salvo:', deviceId);
    };

    if (loading) {
        return (
            <div className="single-microphone-control loading">
                <p>Carregando dispositivos de audio...</p>
                <style jsx>{`
                    .single-microphone-control.loading {
                        text-align: center;
                        padding: 40px;
                        color: #6b7280;
                        background: white;
                        border-radius: 12px;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                        border: 1px solid #E5E7EB;
                    }
                `}</style>
            </div>
        );
    }

    if (devices.length === 0) {
        return (
            <div className="single-microphone-control error">
                <AlertTriangle className="error-icon" size={32} />
                <p>Nenhum microfone detectado</p>
                <p className="hint">Conecte um microfone e recarregue a pagina</p>
                <style jsx>{`
                    .single-microphone-control.error {
                        text-align: center;
                        padding: 40px;
                        color: #ef4444;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 12px;
                        background: white;
                        border-radius: 12px;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                        border: 1px solid #E5E7EB;
                    }
                    .hint {
                        font-size: 14px;
                        margin-top: 8px;
                        color: #6b7280;
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="single-microphone-control">
            <div className="microphone-section">
                <div className="microphone-header">
                    <Stethoscope className="header-icon" size={20} />
                    <h4>Microfone Compartilhado</h4>
                </div>
                <select
                    value={selectedMic}
                    onChange={(e) => handleMicChange(e.target.value)}
                    disabled={disabled}
                    className="microphone-select"
                >
                    {devices.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                            {device.label}
                        </option>
                    ))}
                </select>
            </div>

            <style jsx>{`
                .single-microphone-control {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    padding: 32px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                    border: 1px solid #E5E7EB;
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

                .audio-level-section {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .audio-level-label {
                    font-size: 14px;
                    font-weight: 600;
                    color: #1B4266;
                }

                .audio-progress-container {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    width: 100%;
                }

                .audio-progress-bar {
                    flex: 1;
                    height: 4px;
                    background: #CFCFCF;
                    border-radius: 4px;
                    position: relative;
                    overflow: hidden;
                }

                .audio-progress-fill {
                    height: 100%;
                    background: #16E5AD;
                    border-radius: 4px;
                    transition: width 0.1s ease;
                }

                .audio-mute-icon {
                    width: 18.78px;
                    height: 19.52px;
                    object-fit: contain;
                    flex-shrink: 0;
                    transition: opacity 0.2s ease;
                }

                .audio-mute-icon.muted {
                    opacity: 1;
                }

                .audio-mute-icon.active {
                    opacity: 0.5;
                }
            `}</style>
        </div>
    );
}
