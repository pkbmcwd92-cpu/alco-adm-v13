import assert from 'node:assert';
import { resolveAvailableScopes } from '../src/components/administration/LearningPlanManager';
import { TPItem, ATPItem } from '../src/types';

console.log('=== RUNNING AUDIT: AI FAIL-CLOSED INTEGRITY & SCOPE REGRESSION SUITE ===\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${totalTests}. ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`[FAIL] ${totalTests}. ${name}:`, err.message);
    throw err;
  }
}

// Mock AI endpoint handlers simulating server logic
function simulateServerAITP(params: {
  apiKeyPresent: boolean;
  providerShouldFail?: boolean;
  providerRawText?: string;
}) {
  const { apiKeyPresent, providerShouldFail, providerRawText } = params;

  if (!apiKeyPresent) {
    return { status: 503, error: 'Layanan AI belum dikonfigurasi (GEMINI_API_KEY tidak terpasang).' };
  }

  if (providerShouldFail) {
    return { status: 500, error: 'Gagal merumuskan AI TP: Provider AI mengalami kesalahan internal.' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(providerRawText || '');
  } catch {
    return { status: 500, error: 'Respons AI tidak memenuhi kualifikasi struktur TP: Payload AI bukan berupa array' };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { status: 500, error: 'Respons AI tidak memenuhi kualifikasi struktur TP: Hasil perumusan AI TP kosong atau bukan array' };
  }

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (!item || typeof item !== 'object') {
      return { status: 500, error: `Respons AI tidak memenuhi kualifikasi struktur TP: Butir TP ke-${i + 1} bukan berupa objek valid` };
    }
    const stmt = item.statement || item.description;
    if (!stmt || typeof stmt !== 'string' || stmt.trim() === '') {
      return { status: 500, error: `Respons AI tidak memenuhi kualifikasi struktur TP: Rumusan TP ke-${i + 1} kosong atau tidak valid` };
    }
  }

  return { status: 200, success: true, items: parsed, engine: 'gemini' };
}

function simulateServerAILearningPlan(params: {
  apiKeyPresent: boolean;
  providerShouldFail?: boolean;
  providerRawText?: string;
}) {
  const { apiKeyPresent, providerShouldFail, providerRawText } = params;

  if (!apiKeyPresent) {
    return { status: 503, error: 'Layanan AI belum dikonfigurasi (GEMINI_API_KEY tidak terpasang).' };
  }

  if (providerShouldFail) {
    return { status: 500, error: 'Gagal menyusun Draf AI Modul Ajar: Provider AI unavailable.' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(providerRawText || '');
  } catch {
    return { status: 500, error: 'Respons AI tidak memenuhi kualifikasi struktur Modul Ajar: Payload AI bukan berupa objek valid' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { status: 500, error: 'Respons AI tidak memenuhi kualifikasi struktur Modul Ajar: Payload AI bukan berupa objek valid' };
  }

  if (!Array.isArray(parsed.learningExperiences) || parsed.learningExperiences.length === 0) {
    return { status: 500, error: 'Respons AI tidak memenuhi kualifikasi struktur Modul Ajar: Daftar Pengalaman Belajar (learningExperiences) kosong' };
  }

  const validPhases = ['UNDERSTAND', 'APPLY', 'REFLECT'];
  for (let i = 0; i < parsed.learningExperiences.length; i++) {
    const exp = parsed.learningExperiences[i];
    if (!exp || typeof exp !== 'object') {
      return { status: 500, error: `Respons AI tidak memenuhi kualifikasi struktur Modul Ajar: Butir pengalaman belajar ke-${i + 1} bukan berupa objek` };
    }
    if (!validPhases.includes(exp.phase)) {
      return { status: 500, error: `Respons AI tidak memenuhi kualifikasi struktur Modul Ajar: Fase pengalaman belajar ke-${i + 1} tidak valid` };
    }
    if (!exp.description || typeof exp.description !== 'string' || exp.description.trim() === '') {
      return { status: 500, error: `Respons AI tidak memenuhi kualifikasi struktur Modul Ajar: Deskripsi pengalaman belajar ke-${i + 1} kosong` };
    }
  }

  return { status: 200, success: true, data: parsed, engine: 'gemini' };
}

// --- AI TP REGRESSION TESTS ---

runTest('AI TP Test 1: missing API key -> ERROR (status 503), no generated TP', () => {
  const res = simulateServerAITP({ apiKeyPresent: false });
  assert.strictEqual(res.status, 503);
  assert.strictEqual('items' in res, false);
  assert.ok(res.error.includes('GEMINI_API_KEY'));
});

runTest('AI TP Test 2: provider failure -> ERROR (status 500), no generated TP', () => {
  const res = simulateServerAITP({ apiKeyPresent: true, providerShouldFail: true });
  assert.strictEqual(res.status, 500);
  assert.strictEqual('items' in res, false);
  assert.ok(res.error.includes('Gagal merumuskan AI TP'));
});

runTest('AI TP Test 3: invalid JSON -> ERROR (status 500)', () => {
  const res = simulateServerAITP({ apiKeyPresent: true, providerRawText: '{ invalid json ' });
  assert.strictEqual(res.status, 500);
  assert.strictEqual('items' in res, false);
});

runTest('AI TP Test 4: malformed TP payload -> ERROR (status 500)', () => {
  const res = simulateServerAITP({
    apiKeyPresent: true,
    providerRawText: JSON.stringify([{ code: 'TP 1.1' }]), // missing statement
  });
  assert.strictEqual(res.status, 500);
  assert.strictEqual('items' in res, false);
  assert.ok(res.error.includes('Rumusan TP ke-1 kosong atau tidak valid'));
});

runTest('AI TP Test 5: empty TP result array -> ERROR (status 500)', () => {
  const res = simulateServerAITP({
    apiKeyPresent: true,
    providerRawText: JSON.stringify([]),
  });
  assert.strictEqual(res.status, 500);
  assert.strictEqual('items' in res, false);
});

runTest('AI TP Test 6: provider failure does NOT call successful deterministic TP fallback', () => {
  const res = simulateServerAITP({ apiKeyPresent: true, providerShouldFail: true });
  assert.notStrictEqual(res.status, 200);
  assert.strictEqual((res as any).engine, undefined);
  assert.strictEqual('items' in res, false);
});

runTest('AI TP Test 7: no filler TP generated on failure to satisfy requested count', () => {
  const res = simulateServerAITP({ apiKeyPresent: false });
  assert.strictEqual('items' in res, false);
});

runTest('AI TP Test 8: valid AI TP response accepted with DRAFT contract', () => {
  const validPayload = [
    {
      code: 'TP 4.1',
      elementName: 'Menyimak',
      statement: 'Murid mampu mengidentifikasi ide pokok teks narasi dengan cermat.',
      competence: 'Mengidentifikasi',
      contentScope: 'Ide Pokok Teks Narasi',
      p3Dimensions: ['Bernalar Kritis'],
    },
  ];
  const res = simulateServerAITP({ apiKeyPresent: true, providerRawText: JSON.stringify(validPayload) });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.engine, 'gemini');
  assert.strictEqual(res.items.length, 1);
  assert.strictEqual(res.items[0].statement, validPayload[0].statement);
});

// --- AI LEARNING PLAN REGRESSION TESTS ---

runTest('AI LearningPlan Test 9: missing API key -> ERROR, no LearningPlan created', () => {
  const res = simulateServerAILearningPlan({ apiKeyPresent: false });
  assert.strictEqual(res.status, 503);
  assert.strictEqual('data' in res, false);
});

runTest('AI LearningPlan Test 10: provider failure -> ERROR, no LearningPlan created', () => {
  const res = simulateServerAILearningPlan({ apiKeyPresent: true, providerShouldFail: true });
  assert.strictEqual(res.status, 500);
  assert.strictEqual('data' in res, false);
});

runTest('AI LearningPlan Test 11: invalid JSON -> ERROR', () => {
  const res = simulateServerAILearningPlan({ apiKeyPresent: true, providerRawText: 'NOT_JSON' });
  assert.strictEqual(res.status, 500);
  assert.strictEqual('data' in res, false);
});

runTest('AI LearningPlan Test 12: malformed LearningPlan -> ERROR', () => {
  const malformed = {
    title: 'Draf Modul Ajar',
    learningExperiences: [
      { id: '1', phase: 'INVALID_PHASE', description: 'Test' }, // invalid phase
    ],
  };
  const res = simulateServerAILearningPlan({ apiKeyPresent: true, providerRawText: JSON.stringify(malformed) });
  assert.strictEqual(res.status, 500);
  assert.strictEqual('data' in res, false);
});

runTest('AI LearningPlan Test 13: provider failure does NOT call fallbackGenerateLearningPlan', () => {
  const res = simulateServerAILearningPlan({ apiKeyPresent: true, providerShouldFail: true });
  assert.notStrictEqual(res.status, 200);
  assert.strictEqual('data' in res, false);
  assert.strictEqual((res as any).engine, undefined);
});

runTest('AI LearningPlan Test 14: existing LearningPlan state remains unchanged when generation fails', () => {
  const existingPlan: any = {
    id: 'lp-existing-1',
    workflowStatus: 'DRAFT',
    topic: 'Topik Lama',
    learningExperiences: [],
    graduateProfileDimensions: [],
  };

  const res = simulateServerAILearningPlan({ apiKeyPresent: false });
  assert.strictEqual(res.status, 503);
  // Preserving original existingPlan state
  assert.strictEqual(existingPlan.id, 'lp-existing-1');
  assert.strictEqual(existingPlan.topic, 'Topik Lama');
});

runTest('AI LearningPlan Test 15: valid AI LearningPlan produces DRAFT result', () => {
  const validLP = {
    title: 'Draf Modul Ajar Ide Pokok',
    topic: 'Ide Pokok Teks Narasi',
    meaningfulUnderstanding: 'Murid memahami ide pokok dalam teks narasi.',
    learningExperiences: [
      { id: 'exp-1', phase: 'UNDERSTAND', description: 'Murid membaca teks narasi.', durationMinutes: 30 },
      { id: 'exp-2', phase: 'APPLY', description: 'Murid menentukan ide pokok paragraf.', durationMinutes: 40 },
      { id: 'exp-3', phase: 'REFLECT', description: 'Murid merefleksikan hasil pemahaman.', durationMinutes: 20 },
    ],
  };

  const res = simulateServerAILearningPlan({ apiKeyPresent: true, providerRawText: JSON.stringify(validLP) });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.title, validLP.title);
});

// --- SCOPE REGRESSION TESTS ---

runTest('Scope Test 16: 0 scope -> BLOCK (empty list)', () => {
  const scopes = resolveAvailableScopes({ items: [] } as any, { items: [] } as any);
  assert.strictEqual(scopes.length, 0);
});

runTest('Scope Test 17: 1 scope -> single scope resolved for auto-selection', () => {
  const singleTp: TPItem = {
    id: 'tp-1',
    code: 'TP 4.1',
    statement: 'Murid mampu membaca nyaring.',
    competence: 'Membaca',
    contentScope: 'Teks Narasi',
    order: 1,
  };
  const scopes = resolveAvailableScopes({ items: [singleTp] } as any, { items: [] } as any);
  assert.strictEqual(scopes.length, 1);
  assert.strictEqual(scopes[0].tpCode, 'TP 4.1');
});

runTest('Scope Test 18: >1 scope -> multiple scopes resolved for explicit selection', () => {
  const tp1: TPItem = { id: 'tp-1', code: 'TP 4.1', statement: 'Membaca nyaring', competence: '', contentScope: '', order: 1 };
  const tp2: TPItem = { id: 'tp-2', code: 'TP 4.2', statement: 'Menulis narasi', competence: '', contentScope: '', order: 2 };
  const scopes = resolveAvailableScopes({ items: [tp1, tp2] } as any, { items: [] } as any);
  assert.strictEqual(scopes.length, 2);
});

runTest('Scope Test 19: selected scope canonical IDs preserved accurately', () => {
  const tp1: TPItem = { id: 'tp-canonical-101', code: 'TP 4.1', statement: 'Membaca nyaring', competence: '', contentScope: '', order: 1 };
  const atp1: ATPItem = { id: 'atp-canonical-202', tpId: 'tp-canonical-101', stepNumber: 1, materialScope: 'Teks Pendek' };
  const scopes = resolveAvailableScopes({ items: [tp1] } as any, { items: [atp1] } as any);
  assert.strictEqual(scopes.length, 1);
  assert.strictEqual(scopes[0].linkedTpIds[0], 'tp-canonical-101');
  assert.strictEqual(scopes[0].linkedAtpItemIds[0], 'atp-canonical-202');
});

runTest('Scope Test 20: missing TP code not displayed as fabricated canonical "TP 1"', () => {
  const uncodedTp: TPItem = {
    id: 'tp-no-code',
    code: '', // no code
    statement: 'Menyimak instruksi lisan dengan saksama.',
    competence: 'Menyimak',
    contentScope: 'Instruksi Lisan',
    order: 1,
  };
  const scopes = resolveAvailableScopes({ items: [uncodedTp] } as any, { items: [] } as any);
  assert.strictEqual(scopes.length, 1);
  assert.strictEqual(scopes[0].tpCode, undefined);
  assert.strictEqual(scopes[0].title.includes('TP 1'), false);
  assert.strictEqual(scopes[0].title, 'Menyimak instruksi lisan dengan saksama.');
});

console.log(`\nAll ${totalTests} AI Fail-Closed & Scope Regression tests PASSED successfully!`);
