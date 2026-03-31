/** Represents a single diarized utterance extracted from Deepgram response */
export interface DiarizedUtterance {
  speakerId: string;           // 'speaker_0' or 'speaker_1'
  transcript: string;          // Full utterance text
  startMs: number;             // Start time in milliseconds
  endMs: number;               // End time in milliseconds
  transcriptionConfidence: number; // Deepgram utterance.confidence (transcription accuracy)
  diarizationConfidence: number;   // Average word-level speaker_confidence
  needsReview: boolean;        // true if diarizationConfidence < threshold
}

/** In-memory audio accumulator for a session */
export interface AudioAccumulator {
  chunks: Buffer[];
  timer: NodeJS.Timeout | null;
  batchNumber: number;
  startTime: Date;
  totalDurationMs: number;     // Track accumulated duration (chunkCount * 5000ms)
}

/** Speaker role mapping from doctor UI */
export interface SpeakerMapping {
  speaker_0: 'doctor' | 'patient';
  speaker_1: 'doctor' | 'patient';
}

/** Result of processing a 60s batch */
export interface BatchResult {
  batchId: string;
  sessionId: string;
  utterances: DiarizedUtterance[];
  totalDurationMs: number;
  processedAt: Date;
}

/** Deepgram word with speaker_confidence (matches Deepgram SDK response) */
export interface DeepgramWordWithSpeaker {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker: number;
  speaker_confidence: number;
  punctuated_word: string;
}

/** Deepgram utterance from pre-recorded API with utterances:true + diarize:true */
export interface DeepgramDiarizedUtterance {
  start: number;
  end: number;
  confidence: number;
  channel: number;
  transcript: string;
  speaker: number;
  id: string;
  words: DeepgramWordWithSpeaker[];
}
