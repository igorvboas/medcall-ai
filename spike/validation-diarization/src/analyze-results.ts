import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import {
  GroundTruth,
  GroundTruthSegment,
  SpikeResult,
  DeepgramUtterance,
} from './types';

// ── CLI Argument Parsing ───────────────────────────────────────────────────

function parseArgs(): { resultsDir: string; groundTruthPath: string } {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run analyze [-- --results <dir>] [-- --ground-truth <path>]

Options:
  --results <dir>          Path to results directory (default: ./results)
  --ground-truth <path>    Path to ground truth JSON (default: ./ground-truth.json)
  --help, -h               Show this help message

Example:
  npm run analyze
  npm run analyze -- --results ./results --ground-truth ./ground-truth.json
`);
    process.exit(0);
  }

  const resultsIdx = args.indexOf('--results');
  const resultsDir =
    resultsIdx !== -1 && resultsIdx < args.length - 1
      ? path.resolve(process.cwd(), args[resultsIdx + 1])
      : path.join(process.cwd(), 'results');

  const gtIdx = args.indexOf('--ground-truth');
  const groundTruthPath =
    gtIdx !== -1 && gtIdx < args.length - 1
      ? path.resolve(process.cwd(), args[gtIdx + 1])
      : path.join(process.cwd(), 'ground-truth.json');

  return { resultsDir, groundTruthPath };
}

// ── Ground Truth Loading ───────────────────────────────────────────────────

function loadGroundTruth(filePath: string): GroundTruth {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: Ground truth file not found: ${filePath}`);
    console.error('Copy the template: cp ground-truth-template.json ground-truth.json');
    console.error('Then annotate it with speaker segments from your audio.');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return raw as GroundTruth;
}

// ── Results Loading ────────────────────────────────────────────────────────

function loadResults(resultsDir: string): SpikeResult[] {
  if (!fs.existsSync(resultsDir)) {
    console.error(`Error: Results directory not found: ${resultsDir}`);
    console.error('Run the spike first: npm run spike -- --audio audio/YOUR_FILE.webm');
    process.exit(1);
  }

  const files = fs.readdirSync(resultsDir)
    .filter(f => f.startsWith('results-') && f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    console.error('Error: No results-*.json files found in results directory');
    console.error('Run the spike first: npm run spike -- --audio audio/YOUR_FILE.webm');
    process.exit(1);
  }

  return files.map(f => {
    const raw = JSON.parse(fs.readFileSync(path.join(resultsDir, f), 'utf-8'));
    return raw as SpikeResult;
  });
}

// ── Speaker Mapping ────────────────────────────────────────────────────────

/**
 * Find ground truth segment containing the given midpoint.
 * Returns undefined if the midpoint falls in a gap between segments.
 */
function findGroundTruthSegment(
  midpoint: number,
  segments: GroundTruthSegment[]
): GroundTruthSegment | undefined {
  return segments.find(s => midpoint >= s.start && midpoint <= s.end);
}

/**
 * Compute speaker mapping for a set of utterances.
 * For each Deepgram speaker ID, count how many utterance midpoints
 * fall in "doctor" vs "patient" ground truth segments.
 * The speaker ID with more doctor-segment overlap maps to "doctor".
 */
function computeSpeakerMapping(
  utterances: DeepgramUtterance[],
  groundTruth: GroundTruth
): Map<number, 'doctor' | 'patient'> {
  const speakerCounts: Map<number, { doctor: number; patient: number }> = new Map();

  for (const utt of utterances) {
    const midpoint = (utt.start + utt.end) / 2;
    const gtSegment = findGroundTruthSegment(midpoint, groundTruth.segments);
    if (!gtSegment) continue;

    if (!speakerCounts.has(utt.speaker)) {
      speakerCounts.set(utt.speaker, { doctor: 0, patient: 0 });
    }
    const counts = speakerCounts.get(utt.speaker)!;
    counts[gtSegment.speaker]++;
  }

  const mapping: Map<number, 'doctor' | 'patient'> = new Map();
  const assignedRoles = new Set<string>();

  // Sort by total count to assign the most confident mapping first
  const sortedSpeakers = [...speakerCounts.entries()].sort(
    (a, b) => (b[1].doctor + b[1].patient) - (a[1].doctor + a[1].patient)
  );

  for (const [speakerId, counts] of sortedSpeakers) {
    const preferredRole: 'doctor' | 'patient' =
      counts.doctor >= counts.patient ? 'doctor' : 'patient';

    if (!assignedRoles.has(preferredRole)) {
      mapping.set(speakerId, preferredRole);
      assignedRoles.add(preferredRole);
    } else {
      // Assign the other role
      const otherRole = preferredRole === 'doctor' ? 'patient' : 'doctor';
      mapping.set(speakerId, otherRole);
      assignedRoles.add(otherRole);
    }
  }

  return mapping;
}

/**
 * Compute per-chunk speaker mapping (for chunked results where IDs reset per API call).
 * Returns a mapping for each chunk independently.
 */
function computePerChunkMappings(
  spikeResult: SpikeResult,
  groundTruth: GroundTruth
): Map<number, Map<number, 'doctor' | 'patient'>> {
  const perChunkMappings: Map<number, Map<number, 'doctor' | 'patient'>> = new Map();

  for (const chunk of spikeResult.chunks) {
    // Adjust utterance times to full-audio time for ground truth matching
    const adjustedUtterances = chunk.utterances.map(u => ({
      ...u,
      start: u.start + chunk.startTime,
      end: u.end + chunk.startTime,
    }));

    const mapping = computeSpeakerMapping(adjustedUtterances, groundTruth);
    perChunkMappings.set(chunk.chunkIndex, mapping);
  }

  return perChunkMappings;
}

// ── Accuracy Metrics ───────────────────────────────────────────────────────

interface ChunkSizeMetrics {
  chunkSizeLabel: string;
  chunkSizeSeconds: number;
  totalUtterances: number;
  matchedUtterances: number;
  correctSpeaker: number;
  accuracy: number;
  avgConfidence: number;
  highConfidenceTotal: number;
  highConfidenceCorrect: number;
  highConfidenceAccuracy: number;
  speakerDistribution: Record<string, number>;
  singleSpeakerChunks: number;
  totalChunks: number;
}

function computeMetrics(
  spikeResult: SpikeResult,
  groundTruth: GroundTruth,
  isFullFile: boolean
): ChunkSizeMetrics {
  let matchedUtterances = 0;
  let correctSpeaker = 0;
  let totalConfidence = 0;
  let totalConfidenceCount = 0;
  let highConfTotal = 0;
  let highConfCorrect = 0;
  const speakerDist: Record<string, number> = {};

  // Count single-speaker chunks
  let singleSpeakerChunks = 0;
  for (const chunk of spikeResult.chunks) {
    const speakers = new Set(chunk.utterances.map(u => u.speaker));
    if (speakers.size <= 1) {
      singleSpeakerChunks++;
    }
  }

  if (isFullFile) {
    // Full file: one consistent mapping
    const mapping = computeSpeakerMapping(spikeResult.allUtterances, groundTruth);

    for (const utt of spikeResult.allUtterances) {
      const midpoint = (utt.start + utt.end) / 2;
      const gtSegment = findGroundTruthSegment(midpoint, groundTruth.segments);
      if (!gtSegment) continue;

      matchedUtterances++;
      const mappedSpeaker = mapping.get(utt.speaker);

      if (mappedSpeaker === gtSegment.speaker) {
        correctSpeaker++;
      }

      // Word-level speaker confidence
      let uttAvgConfidence = 0;
      if (utt.words.length > 0) {
        const wordConfs = utt.words.map(w => w.speaker_confidence);
        uttAvgConfidence = wordConfs.reduce((a, b) => a + b, 0) / wordConfs.length;
        totalConfidence += wordConfs.reduce((a, b) => a + b, 0);
        totalConfidenceCount += wordConfs.length;
      }

      // High confidence analysis (speaker_confidence > 0.7)
      if (uttAvgConfidence > 0.7) {
        highConfTotal++;
        if (mappedSpeaker === gtSegment.speaker) {
          highConfCorrect++;
        }
      }

      // Speaker distribution
      const key = `speaker_${utt.speaker}`;
      speakerDist[key] = (speakerDist[key] || 0) + 1;
    }
  } else {
    // Chunked: per-chunk mapping since speaker IDs reset per API call
    const perChunkMappings = computePerChunkMappings(spikeResult, groundTruth);

    for (const chunk of spikeResult.chunks) {
      const mapping = perChunkMappings.get(chunk.chunkIndex) || new Map();

      for (const utt of chunk.utterances) {
        // Adjust utterance to full-audio time
        const adjustedStart = utt.start + chunk.startTime;
        const adjustedEnd = utt.end + chunk.startTime;
        const midpoint = (adjustedStart + adjustedEnd) / 2;

        const gtSegment = findGroundTruthSegment(midpoint, groundTruth.segments);
        if (!gtSegment) continue;

        matchedUtterances++;
        const mappedSpeaker = mapping.get(utt.speaker);

        if (mappedSpeaker === gtSegment.speaker) {
          correctSpeaker++;
        }

        // Word-level speaker confidence
        let uttAvgConfidence = 0;
        if (utt.words.length > 0) {
          const wordConfs = utt.words.map(w => w.speaker_confidence);
          uttAvgConfidence = wordConfs.reduce((a, b) => a + b, 0) / wordConfs.length;
          totalConfidence += wordConfs.reduce((a, b) => a + b, 0);
          totalConfidenceCount += wordConfs.length;
        }

        if (uttAvgConfidence > 0.7) {
          highConfTotal++;
          if (mappedSpeaker === gtSegment.speaker) {
            highConfCorrect++;
          }
        }

        const key = `chunk${chunk.chunkIndex}_speaker_${utt.speaker}`;
        speakerDist[key] = (speakerDist[key] || 0) + 1;
      }
    }
  }

  const accuracy = matchedUtterances > 0 ? (correctSpeaker / matchedUtterances) * 100 : 0;
  const avgConfidence = totalConfidenceCount > 0 ? totalConfidence / totalConfidenceCount : 0;
  const highConfidenceAccuracy = highConfTotal > 0 ? (highConfCorrect / highConfTotal) * 100 : 0;

  return {
    chunkSizeLabel: spikeResult.chunkSizeLabel,
    chunkSizeSeconds: spikeResult.chunkSizeSeconds,
    totalUtterances: spikeResult.allUtterances.length,
    matchedUtterances,
    correctSpeaker,
    accuracy,
    avgConfidence,
    highConfidenceTotal: highConfTotal,
    highConfidenceCorrect: highConfCorrect,
    highConfidenceAccuracy,
    speakerDistribution: speakerDist,
    singleSpeakerChunks,
    totalChunks: spikeResult.chunks.length,
  };
}

// ── Go/No-Go Decision ──────────────────────────────────────────────────────

const ACCURACY_THRESHOLD = 85;

function printGoNoGo(allMetrics: ChunkSizeMetrics[]): string {
  const fullFileMetrics = allMetrics.find(m => m.chunkSizeLabel === 'full');
  const chunkedMetrics = allMetrics.filter(m => m.chunkSizeLabel !== 'full');

  // Check if any chunked size meets threshold
  const passingChunked = chunkedMetrics.filter(m => m.accuracy >= ACCURACY_THRESHOLD);

  let decision: string;

  if (passingChunked.length > 0) {
    const best = passingChunked.reduce((a, b) => (a.accuracy > b.accuracy ? a : b));
    decision = `GO -- chunk size ${best.chunkSizeLabel} achieves ${best.accuracy.toFixed(1)}% accuracy (threshold: ${ACCURACY_THRESHOLD}%)`;
  } else if (fullFileMetrics && fullFileMetrics.accuracy >= ACCURACY_THRESHOLD) {
    decision = `CONDITIONAL GO -- full-file works (${fullFileMetrics.accuracy.toFixed(1)}%) but chunked accuracy is below threshold. Consider larger chunks or streaming approach.`;
  } else {
    const fullAcc = fullFileMetrics ? fullFileMetrics.accuracy.toFixed(1) : 'N/A';
    decision = `NO-GO -- nova-2 diarization for pt-BR does not meet accuracy threshold even with full-file processing (${fullAcc}%)`;
  }

  return decision;
}

// ── Console Output ─────────────────────────────────────────────────────────

function printResultsTable(allMetrics: ChunkSizeMetrics[]): void {
  console.log(`\n${'='.repeat(100)}`);
  console.log('ACCURACY ANALYSIS RESULTS');
  console.log(`${'='.repeat(100)}`);

  const header =
    '| Chunk Size | Utterances | Accuracy | Avg Confidence | High-Conf Accuracy | Single-Speaker Chunks |';
  const divider =
    '|------------|-----------|----------|----------------|--------------------|-----------------------|';

  console.log(header);
  console.log(divider);

  for (const m of allMetrics) {
    console.log(
      `| ${m.chunkSizeLabel.padEnd(10)} | ${String(m.matchedUtterances).padEnd(9)} | ${m.accuracy.toFixed(1).padStart(5)}%  | ${m.avgConfidence.toFixed(2).padStart(14)} | ${m.highConfidenceAccuracy.toFixed(1).padStart(17)}% | ${`${m.singleSpeakerChunks}/${m.totalChunks}`.padStart(21)} |`
    );
  }

  console.log(`${'='.repeat(100)}\n`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { resultsDir, groundTruthPath } = parseArgs();

  console.log('\nDiarization Accuracy Analysis');
  console.log(`Results directory: ${resultsDir}`);
  console.log(`Ground truth: ${groundTruthPath}`);

  // Load data
  const groundTruth = loadGroundTruth(groundTruthPath);
  console.log(`Ground truth: ${groundTruth.segments.length} segments, ${groundTruth.totalDurationSeconds}s total`);

  const results = loadResults(resultsDir);
  console.log(`Loaded ${results.length} result files`);

  // Compute metrics
  const allMetrics: ChunkSizeMetrics[] = [];

  for (const result of results) {
    const isFullFile = result.chunkSizeLabel === 'full';
    const metrics = computeMetrics(result, groundTruth, isFullFile);
    allMetrics.push(metrics);
  }

  // Print results table
  printResultsTable(allMetrics);

  // Go/No-Go decision
  const decision = printGoNoGo(allMetrics);
  console.log(`DECISION: ${decision}`);
  console.log('');

  // Save analysis
  const analysisPath = path.join(resultsDir, 'analysis.json');
  const analysis = {
    timestamp: new Date().toISOString(),
    groundTruthFile: groundTruthPath,
    groundTruthSegments: groundTruth.segments.length,
    accuracyThreshold: ACCURACY_THRESHOLD,
    metrics: allMetrics,
    decision,
  };

  fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
  console.log(`Full analysis saved to ${analysisPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
