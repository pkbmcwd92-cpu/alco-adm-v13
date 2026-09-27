import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { sanitizeErrorCategory } from '../server/calendarProvider';

dotenv.config();

interface ModelProbeResult {
  plain: string;
  grounding: string;
}

async function probeModel(ai: GoogleGenAI, model: string): Promise<ModelProbeResult> {
  let plain = 'UNKNOWN_PROVIDER_ERROR';
  try {
    await ai.models.generateContent({
      model,
      contents: 'Balas hanya dengan kata OK.',
    });
    plain = 'SUCCESS';
  } catch (err: unknown) {
    plain = sanitizeErrorCategory(err);
  }

  let grounding = 'UNKNOWN_PROVIDER_ERROR';
  try {
    await ai.models.generateContent({
      model,
      contents: 'Cari satu informasi resmi dari situs pemerintah Indonesia dan jawab singkat.',
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    grounding = 'SUCCESS';
  } catch (err: unknown) {
    grounding = sanitizeErrorCategory(err);
  }

  return { plain, grounding };
}

function determineDiagnosis(
  isConfigured: boolean,
  m1: ModelProbeResult | null,
  m2: ModelProbeResult | null
): string {
  if (!isConfigured || !m1 || !m2) {
    return 'NO_API_KEY';
  }

  const m1PlainOk = m1.plain === 'SUCCESS';
  const m1GroundOk = m1.grounding === 'SUCCESS';
  const m2PlainOk = m2.plain === 'SUCCESS';
  const m2GroundOk = m2.grounding === 'SUCCESS';

  if (m1PlainOk && m1GroundOk && m2PlainOk && m2GroundOk) {
    return 'ALL_SUCCESS';
  }

  if (m1PlainOk && !m1GroundOk && m2PlainOk && !m2GroundOk) {
    return 'GROUNDING_SPECIFIC_FAILURE';
  }

  if (!m1PlainOk && !m1GroundOk && !m2PlainOk && !m2GroundOk) {
    return 'GENERAL_GEMINI_FAILURE';
  }

  return 'MODEL_SPECIFIC_FAILURE';
}

async function main() {
  console.log('=== GEMINI CALENDAR GROUNDING DIAGNOSTIC ===\n');

  const apiKey = process.env.GEMINI_API_KEY;
  const isConfigured = Boolean(apiKey && apiKey.trim() !== '');

  console.log(`AI Configured: ${isConfigured}\n`);

  if (!isConfigured) {
    console.log('Diagnosis:\nNO_API_KEY');
    return;
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey!,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });

  const model1 = 'gemini-3.5-flash-lite';
  const res1 = await probeModel(ai, model1);
  console.log(`[${model1}]`);
  console.log(`Plain Generation: ${res1.plain}`);
  console.log(`Google Search Grounding: ${res1.grounding}\n`);

  const model2 = 'gemini-3.8-flash';
  const res2 = await probeModel(ai, model2);
  console.log(`[${model2}]`);
  console.log(`Plain Generation: ${res2.plain}`);
  console.log(`Google Search Grounding: ${res2.grounding}\n`);

  const diagnosis = determineDiagnosis(isConfigured, res1, res2);
  console.log('Diagnosis:');
  console.log(diagnosis);
}

main().catch((err) => {
  console.error('Diagnostic error:', sanitizeErrorCategory(err));
  process.exit(1);
});
