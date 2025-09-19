import '@livekit/components-styles';
import { MedicalConsultationRoom } from '@/components/livekit/MedicalConsultationRoom';

// Mock data for testing
const mockUtterances = [
  {
    id: '1',
    speaker: 'doctor' as const,
    text: 'Bom dia! Como está se sentindo hoje?',
    timestamp: new Date().toISOString(),
    confidence: 0.95
  },
  {
    id: '2',
    speaker: 'patient' as const,
    text: 'Olá doutor, estou com uma dor de cabeça há dois dias.',
    timestamp: new Date().toISOString(),
    confidence: 0.92
  },
  {
    id: '3',
    speaker: 'doctor' as const,
    text: 'Entendo. Pode me descrever melhor essa dor? É constante ou intermitente?',
    timestamp: new Date().toISOString(),
    confidence: 0.98
  }
];

const mockSuggestions = [
  {
    id: '1',
    type: 'question' as const,
    text: 'Pergunte sobre a intensidade da dor em uma escala de 1 a 10',
    confidence: 0.89,
    timestamp: new Date().toISOString(),
    used: false
  },
  {
    id: '2',
    type: 'diagnosis' as const,
    text: 'Considerar cefaleia tensional baseado nos sintomas relatados',
    confidence: 0.76,
    timestamp: new Date().toISOString(),
    used: false
  },
  {
    id: '3',
    type: 'treatment' as const,
    text: 'Recomendar hidratação e repouso para alívio inicial',
    confidence: 0.82,
    timestamp: new Date().toISOString(),
    used: true,
    used_at: new Date().toISOString()
  }
];

export default function MedicalTestPage() {
  const handleSuggestionUsed = (suggestionId: string) => {
    console.log('Suggestion used:', suggestionId);
  };

  const handleConnected = () => {
    console.log('Connected to medical consultation room');
  };

  const handleDisconnected = () => {
    console.log('Disconnected from medical consultation room');
  };

  const handleError = (error: Error) => {
    console.error('Medical consultation error:', error);
  };

  const handleEndCall = () => {
    console.log('Ending medical consultation');
    // In a real app, this would navigate back or show a summary
  };

  return (
    <MedicalConsultationRoom
      roomName={`medical-test-${Date.now()}`}
      participantName="Dr. Teste"
      userRole="doctor"
      sessionId={`session-${Date.now()}`}
      patientName="João Silva"
      hq={false}
      onConnected={handleConnected}
      onDisconnected={handleDisconnected}
      onError={handleError}
      onEndCall={handleEndCall}
      onShareConsultation={() => console.log('Share consultation')}
      suggestions={mockSuggestions}
      onSuggestionUsed={handleSuggestionUsed}
    />
  );
}
