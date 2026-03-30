import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createClient } from '@deepgram/sdk';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import { ChunkResult, DeepgramUtterance, SpikeResult } from './types';

// Set ffmpeg binary path from @ffmpeg-installer/ffmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// ── Configuration ──────────────────────────────────────────────────────────

const CHUNK_SIZES_SECONDS = [5, 30, 60]; // Plus full-file handled separately
const RESULTS_DIR = path.join(process.cwd(), 'results');
const DEEPGRAM_OPTIONS = {
  model: 'nova-2' as const,
  language: 'pt-BR',
  smart_format: true,
  punctuate: true,
  diarize: true,
  utterances: true,
};

// ── CLI Argument Parsing ───────────────────────────────────────────────────

function parseArgs(): { audioPath: string } {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run spike -- --audio <path-to-audio-file>

Options:
  --audio <path>   Path to the audio file (relative to audio/ directory or absolute)
  --help, -h       Show this help message

Example:
  npm run spike -- --audio audio/consulta.webm
  npm run spike -- --audio /absolute/path/to/audio.wav
`);
    process.exit(0);
  }

  const audioIdx = args.indexOf('--audio');
  if (audioIdx === -1 || audioIdx === args.length - 1) {
    console.error('Error: --audio <path> argument is required');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  const audioPath = args[audioIdx + 1];
  const resolvedPath = path.isAbsolute(audioPath)
    ? audioPath
    : path.resolve(process.cwd(), audioPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: Audio file not found: ${resolvedPath}`);
    process.exit(1);
  }

  return { audioPath: resolvedPath };
}

// ── Deepgram Client ────────────────────────────────────────────────────────

function createDeepgramClient() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    console.error('Error: DEEPGRAM_API_KEY environment variable is not set');
    console.error('Create a .env file with DEEPGRAM_API_KEY=your_key_here');
    console.error('Or copy from: cp ../apps/backend/realtime-service/.env .env');
    process.exit(1);
  }
  return createClient(apiKey);
}

// ── Audio Splitting ────────────────────────────────────────────────────────

function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

function splitAudioIntoChunks(
  audioPath: string,
  chunkSizeSeconds: number,
  outputDir: string
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const outputPattern = path.join(outputDir, `chunk_%03d.wav`);

    ffmpeg(audioPath)
      .outputOptions([
        '-f', 'segment',
        '-segment_time', String(chunkSizeSeconds),
        '-ar', '16000',
        '-ac', '1',
        '-acodec', 'pcm_s16le',
      ])
      .output(outputPattern)
      .on('end', () => {
        // Read the output directory to find generated chunks
        const files = fs.readdirSync(outputDir)
          .filter(f => f.startsWith('chunk_') && f.endsWith('.wav'))
          .sort()
          .map(f => path.join(outputDir, f));
        resolve(files);
      })
      .on('error', (err) => {
        reject(new Error(`ffmpeg split error: ${err.message}`));
      })
      .run();
  });
}

function convertToWav(audioPath: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(audioPath)
      .outputOptions(['-ar', '16000', '-ac', '1', '-acodec', 'pcm_s16le'])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(new Error(`ffmpeg convert error: ${err.message}`)))
      .run();
  });
}

// ── Deepgram Transcription ─────────────────────────────────────────────────

async function transcribeBuffer(
  deepgram: ReturnType<typeof createClient>,
  audioBuffer: Buffer
): Promise<{ utterances: DeepgramUtterance[]; rawResponse: unknown }> {
  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    audioBuffer,
    DEEPGRAM_OPTIONS
  );

  if (error) {
    throw new Error(`Deepgram API error: ${JSON.stringify(error)}`);
  }

  const utterances: DeepgramUtterance[] = (result?.results?.utterances || []).map(
    (u: any) => ({
      speaker: u.speaker,
      transcript: u.transcript,
      confidence: u.confidence,
      start: u.start,
      end: u.end,
      id: u.id,
      words: (u.words || []).map((w: any) => ({
        word: w.word,
        speaker: w.speaker,
        speaker_confidence: w.speaker_confidence,
        start: w.start,
        end: w.end,
        confidence: w.confidence,
      })),
    })
  );

  return { utterances, rawResponse: result };
}

// ── Process Chunk Size ─────────────────────────────────────────────────────

async function processChunkSize(
  deepgram: ReturnType<typeof createClient>,
  audioPath: string,
  chunkSizeSeconds: number,
  totalDuration: number,
  label: string
): Promise<SpikeResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing ${label} chunks...`);
  console.log(`${'='.repeat(60)}`);

  const chunks: ChunkResult[] = [];
  const allUtterances: DeepgramUtterance[] = [];

  if (label === 'full') {
    // Full-file: read entire audio as WAV buffer
    console.log(`Processing full file (${totalDuration.toFixed(1)}s)...`);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spike-full-'));
    const wavPath = path.join(tmpDir, 'full.wav');

    try {
      await convertToWav(audioPath, wavPath);
      const buffer = fs.readFileSync(wavPath);

      const { utterances, rawResponse } = await transcribeBuffer(deepgram, buffer);

      const chunkResult: ChunkResult = {
        chunkIndex: 0,
        chunkSizeSeconds: totalDuration,
        startTime: 0,
        endTime: totalDuration,
        utterances,
        rawResponse,
      };
      chunks.push(chunkResult);
      allUtterances.push(...utterances);

      console.log(`  Full file: ${utterances.length} utterances found`);
    } catch (err) {
      console.error(`  Error processing full file:`, err);
    } finally {
      // Clean up
      if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
      fs.rmdirSync(tmpDir);
    }
  } else {
    // Chunked: split audio and process each chunk
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `spike-${label}-`));

    try {
      const chunkFiles = await splitAudioIntoChunks(audioPath, chunkSizeSeconds, tmpDir);
      const totalChunks = chunkFiles.length;
      console.log(`  Split into ${totalChunks} chunks of ${chunkSizeSeconds}s each`);

      for (let i = 0; i < chunkFiles.length; i++) {
        const chunkFile = chunkFiles[i];
        console.log(`  Processing ${label} chunks: chunk ${i + 1}/${totalChunks}...`);

        try {
          const buffer = fs.readFileSync(chunkFile);
          const { utterances, rawResponse } = await transcribeBuffer(deepgram, buffer);

          const startTime = i * chunkSizeSeconds;
          const endTime = Math.min((i + 1) * chunkSizeSeconds, totalDuration);

          const chunkResult: ChunkResult = {
            chunkIndex: i,
            chunkSizeSeconds,
            startTime,
            endTime,
            utterances,
            rawResponse,
          };
          chunks.push(chunkResult);

          // Adjust utterance timestamps to be relative to the full audio
          const adjustedUtterances = utterances.map(u => ({
            ...u,
            start: u.start + startTime,
            end: u.end + startTime,
            words: u.words.map(w => ({
              ...w,
              start: w.start + startTime,
              end: w.end + startTime,
            })),
          }));
          allUtterances.push(...adjustedUtterances);

          console.log(`    -> ${utterances.length} utterances, speakers: [${[...new Set(utterances.map(u => u.speaker))].join(', ')}]`);
        } catch (err) {
          console.error(`    -> Error on chunk ${i + 1}:`, err);
        }
      }
    } finally {
      // Clean up temp chunk files
      const tempFiles = fs.readdirSync(tmpDir);
      for (const f of tempFiles) {
        fs.unlinkSync(path.join(tmpDir, f));
      }
      fs.rmdirSync(tmpDir);
    }
  }

  return {
    audioFile: path.basename(audioPath),
    chunkSizeLabel: label,
    chunkSizeSeconds: label === 'full' ? totalDuration : chunkSizeSeconds,
    totalChunks: chunks.length,
    chunks,
    allUtterances,
    timestamp: new Date().toISOString(),
  };
}

// ── Summary Table ──────────────────────────────────────────────────────────

function printSummaryTable(results: SpikeResult[]): void {
  console.log(`\n${'='.repeat(80)}`);
  console.log('RESULTS SUMMARY');
  console.log(`${'='.repeat(80)}`);

  const header = '| Chunk Size | Total Utterances | Unique Speakers | Utterances/Speaker |';
  const divider = '|------------|-----------------|-----------------|-------------------|';

  console.log(header);
  console.log(divider);

  for (const result of results) {
    const totalUtterances = result.allUtterances.length;
    const speakers = [...new Set(result.allUtterances.map(u => u.speaker))];
    const uniqueSpeakers = speakers.length;

    const perSpeaker: Record<number, number> = {};
    for (const u of result.allUtterances) {
      perSpeaker[u.speaker] = (perSpeaker[u.speaker] || 0) + 1;
    }
    const perSpeakerStr = speakers
      .map(s => `S${s}:${perSpeaker[s]}`)
      .join(', ');

    console.log(
      `| ${result.chunkSizeLabel.padEnd(10)} | ${String(totalUtterances).padEnd(15)} | ${String(uniqueSpeakers).padEnd(15)} | ${perSpeakerStr.padEnd(17)} |`
    );
  }

  console.log(`${'='.repeat(80)}\n`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { audioPath } = parseArgs();
  const deepgram = createDeepgramClient();

  console.log(`\nDiarization Validation Spike`);
  console.log(`Audio file: ${audioPath}`);
  console.log(`Chunk sizes: ${CHUNK_SIZES_SECONDS.join('s, ')}s + full-file`);
  console.log(`Deepgram model: ${DEEPGRAM_OPTIONS.model}`);
  console.log(`Language: ${DEEPGRAM_OPTIONS.language}`);

  // Get audio duration
  const totalDuration = await getAudioDuration(audioPath);
  console.log(`Audio duration: ${totalDuration.toFixed(1)}s (${(totalDuration / 60).toFixed(1)} min)`);

  // Ensure results directory exists
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const allResults: SpikeResult[] = [];

  // Process each chunk size
  for (const chunkSize of CHUNK_SIZES_SECONDS) {
    const label = `${chunkSize}s`;
    const result = await processChunkSize(deepgram, audioPath, chunkSize, totalDuration, label);
    allResults.push(result);

    // Save intermediate result
    const resultPath = path.join(RESULTS_DIR, `results-${label}.json`);
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    console.log(`  Results saved to ${resultPath}`);
  }

  // Process full-file
  const fullResult = await processChunkSize(deepgram, audioPath, 0, totalDuration, 'full');
  allResults.push(fullResult);

  const fullResultPath = path.join(RESULTS_DIR, `results-full.json`);
  fs.writeFileSync(fullResultPath, JSON.stringify(fullResult, null, 2));
  console.log(`  Results saved to ${fullResultPath}`);

  // Print summary
  printSummaryTable(allResults);

  console.log('Spike complete. Run "npm run analyze" to compute accuracy metrics against ground truth.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
