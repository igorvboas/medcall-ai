export interface GroundTruthSegment {
  start: number;      // seconds
  end: number;        // seconds
  speaker: 'doctor' | 'patient';
  text_snippet: string;  // first few words for identification
}

export interface GroundTruth {
  audioFile: string;
  totalDurationSeconds: number;
  segments: GroundTruthSegment[];
}

export interface DeepgramUtterance {
  speaker: number;
  transcript: string;
  confidence: number;
  start: number;
  end: number;
  id: string;
  words: Array<{
    word: string;
    speaker: number;
    speaker_confidence: number;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export interface ChunkResult {
  chunkIndex: number;
  chunkSizeSeconds: number;
  startTime: number;
  endTime: number;
  utterances: DeepgramUtterance[];
  rawResponse: unknown;
}

export interface SpikeResult {
  audioFile: string;
  chunkSizeLabel: string;    // "5s", "30s", "60s", "full"
  chunkSizeSeconds: number;  // 5, 30, 60, or total duration
  totalChunks: number;
  chunks: ChunkResult[];
  allUtterances: DeepgramUtterance[];
  timestamp: string;
}
