import fs from 'node:fs';
import path from 'node:path';
import { validateAssessmentPackage } from '../src/services/assessmentPackageService';
import type {
  AssessmentPackage,
  WrittenAssessmentInstrument,
  OralAssessmentInstrument,
  AcademicSetting,
  AssessmentPlan,
  TPData,
} from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`✓ ${message}`);
  } else {
    failed++;
    console.error(`✗ FAIL: ${message}`);
  }
}

const mockSetting: AcademicSetting = {
  id: 'setting-1',
  profileId: 'prof-1',
  curriculum: 'Kurikulum Merdeka',
  academicYear: '2025/2026',
  semester: '1 (Ganjil)',
  level: 'SMA',
  grade: 'Kelas 10',
  phase: 'E',
  subject: 'PJOK',
  updatedAt: new Date().toISOString(),
};

const mockTP: TPData = {
  id: 'tp-data-1',
  academicSettingId: 'setting-1',
  items: [
    {
      id: 'tp-1',
      code: 'TP-1',
      statement: 'Siswa mampu mendemonstrasikan teknik dasar basket',
      competence: 'Mendemonstrasikan',
      contentScope: 'Bola Basket',
      p3Dimensions: [],
      order: 1,
    },
  ],
  workflowStatus: 'SIAP',
  needsReview: false,
  updatedAt: new Date().toISOString(),
};

const mockPlan: AssessmentPlan = {
  id: 'plan-1',
  academicSettingId: 'setting-1',
  title: 'Rencana Asesmen Utama',
  purpose: 'SUMMATIVE',
  timing: 'POST',
  scopeType: 'TP',
  tpIds: ['tp-1'],
  criterionIds: [],
  instruments: [{ id: 'inst-written-1', type: 'WRITTEN_TEST', label: 'Tes Tertulis' }],
  workflowStatus: 'SIAP',
  needsReview: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockContext = {
  academicSetting: mockSetting,
  assessmentPlan: mockPlan,
  tp: mockTP,
};

function createBasePackage(): AssessmentPackage {
  const instId = 'inst-written-1';
  const itemId = 'item-mc-1';

  const inst: WrittenAssessmentInstrument = {
    id: instId,
    type: 'WRITTEN_TEST',
    title: 'Tes Tertulis Utama',
    items: [
      {
        id: itemId,
        itemType: 'MULTIPLE_CHOICE',
        prompt: 'Siapa penemu bola basket?',
        options: [
          { id: 'opt-a', label: 'A', text: 'James Naismith' },
          { id: 'opt-b', label: 'B', text: 'William G. Morgan' },
        ],
        order: 1,
      },
    ],
  };

  return {
    id: 'pkg-b12o-test',
    assessmentPlanId: 'plan-1',
    academicSettingId: 'setting-1',
    title: 'Paket Asesmen B12o Test',
    blueprintItems: [
      {
        id: 'bp-1',
        objectiveRefId: 'tp-1',
        instrumentType: 'WRITTEN_TEST',
        instrumentItemIds: [itemId],
        order: 1,
      },
    ],
    instruments: [inst],
    answerKeys: [
      {
        id: 'ak-1',
        instrumentId: instId,
        instrumentItemId: itemId,
        answerType: 'OPTION',
        optionIds: ['opt-a'],
      },
    ],
    scoringGuides: [],
    rubrics: [],
    workflowStatus: 'DRAFT',
    needsReview: false,
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

console.log('=== RUNNING B.1.2o SCORING GUIDE & ESSAY INTEGRITY REGRESSION TESTS ===\n');

// 1. Valid ESSAY item + EXPECTED_RESPONSE AnswerKey + valid ESSAY ScoringGuide
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-essay-1',
    itemType: 'ESSAY',
    prompt: 'Jelaskan teknik dasar memegang bola basket!',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-essay-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    answerType: 'EXPECTED_RESPONSE',
    value: 'Posisi tangan membentuk mangkuk di kedua sisi bola.',
  });
  pkg.scoringGuides.push({
    id: 'sg-essay-1',
    title: 'Pedoman Penskoran Uraian #1',
    guideType: 'ESSAY',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    instructions: 'Skor 5 jika menyebutkan 3 poin utama, skor 3 jika 2 poin, skor 1 jika 1 poin.',
    maxScore: 5,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(res.valid, 'Test 1: Valid ESSAY + EXPECTED_RESPONSE + valid ESSAY scoring guide passes validation');
}

// 2. ESSAY item missing AnswerKey
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-essay-1',
    itemType: 'ESSAY',
    prompt: 'Jelaskan teknik dasar memegang bola basket!',
    order: 2,
  });
  pkg.scoringGuides.push({
    id: 'sg-essay-1',
    title: 'Pedoman Penskoran Uraian #1',
    guideType: 'ESSAY',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    instructions: 'Petunjuk penskoran',
    maxScore: 5,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('kunci/rambu jawaban canonical')), 'Test 2: ESSAY item missing AnswerKey fails validation');
}

// 3. ESSAY item AnswerKey with empty value
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-essay-1',
    itemType: 'ESSAY',
    prompt: 'Jelaskan...',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-essay-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    answerType: 'EXPECTED_RESPONSE',
    value: '',
  });
  pkg.scoringGuides.push({
    id: 'sg-essay-1',
    title: 'Pedoman Penskoran Uraian #1',
    guideType: 'ESSAY',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    instructions: 'Petunjuk penskoran',
    maxScore: 5,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('kunci/rambu jawaban canonical')), 'Test 3: ESSAY AnswerKey with empty value fails validation');
}

// 4. ESSAY item AnswerKey with whitespace-only value
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-essay-1',
    itemType: 'ESSAY',
    prompt: 'Jelaskan...',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-essay-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    answerType: 'EXPECTED_RESPONSE',
    value: '   ',
  });
  pkg.scoringGuides.push({
    id: 'sg-essay-1',
    title: 'Pedoman Penskoran Uraian #1',
    guideType: 'ESSAY',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    instructions: 'Petunjuk penskoran',
    maxScore: 5,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('kunci/rambu jawaban canonical')), 'Test 4: ESSAY AnswerKey with whitespace-only value fails validation');
}

// 5. ESSAY item AnswerKey with answerType OPTION instead of EXPECTED_RESPONSE
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-essay-1',
    itemType: 'ESSAY',
    prompt: 'Jelaskan...',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-essay-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    answerType: 'OPTION',
    optionIds: ['opt-a'],
  });
  pkg.scoringGuides.push({
    id: 'sg-essay-1',
    title: 'Pedoman Penskoran Uraian #1',
    guideType: 'ESSAY',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    instructions: 'Petunjuk penskoran',
    maxScore: 5,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('kunci/rambu jawaban canonical')), 'Test 5: ESSAY AnswerKey with OPTION type fails validation');
}

// 6. ESSAY item missing ScoringGuide
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-essay-1',
    itemType: 'ESSAY',
    prompt: 'Jelaskan...',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-essay-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    answerType: 'EXPECTED_RESPONSE',
    value: 'Rambu jawaban lengkap',
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('pedoman penskoran canonical yang valid')), 'Test 6: ESSAY item missing ScoringGuide fails validation');
}

// 7. ESSAY ScoringGuide with empty title
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-essay-1',
    itemType: 'ESSAY',
    prompt: 'Jelaskan...',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-essay-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    answerType: 'EXPECTED_RESPONSE',
    value: 'Rambu jawaban',
  });
  pkg.scoringGuides.push({
    id: 'sg-essay-1',
    title: '',
    guideType: 'ESSAY',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    instructions: 'Petunjuk penskoran',
    maxScore: 5,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('belum memiliki judul')), 'Test 7: ESSAY ScoringGuide with empty title fails validation');
}

// 8. ESSAY ScoringGuide with whitespace-only title
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-essay-1',
    itemType: 'ESSAY',
    prompt: 'Jelaskan...',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-essay-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    answerType: 'EXPECTED_RESPONSE',
    value: 'Rambu jawaban',
  });
  pkg.scoringGuides.push({
    id: 'sg-essay-1',
    title: '   ',
    guideType: 'ESSAY',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    instructions: 'Petunjuk penskoran',
    maxScore: 5,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('belum memiliki judul')), 'Test 8: ESSAY ScoringGuide with whitespace title fails validation');
}

// 9. ESSAY ScoringGuide with empty instructions
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-essay-1',
    itemType: 'ESSAY',
    prompt: 'Jelaskan...',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-essay-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    answerType: 'EXPECTED_RESPONSE',
    value: 'Rambu jawaban',
  });
  pkg.scoringGuides.push({
    id: 'sg-essay-1',
    title: 'Pedoman Uraian',
    guideType: 'ESSAY',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    instructions: '',
    maxScore: 5,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('wajib memiliki instruksi penskoran')), 'Test 9: ESSAY ScoringGuide with empty instructions fails validation');
}

// 10. ESSAY ScoringGuide with whitespace-only instructions
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-essay-1',
    itemType: 'ESSAY',
    prompt: 'Jelaskan...',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-essay-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    answerType: 'EXPECTED_RESPONSE',
    value: 'Rambu jawaban',
  });
  pkg.scoringGuides.push({
    id: 'sg-essay-1',
    title: 'Pedoman Uraian',
    guideType: 'ESSAY',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    instructions: '   ',
    maxScore: 5,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('wajib memiliki instruksi penskoran')), 'Test 10: ESSAY ScoringGuide with whitespace instructions fails validation');
}

// 11. ESSAY ScoringGuide with undefined maxScore
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-essay-1',
    itemType: 'ESSAY',
    prompt: 'Jelaskan...',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-essay-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    answerType: 'EXPECTED_RESPONSE',
    value: 'Rambu jawaban',
  });
  pkg.scoringGuides.push({
    id: 'sg-essay-1',
    title: 'Pedoman Uraian',
    guideType: 'ESSAY',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    instructions: 'Instruksi penskoran',
    maxScore: undefined,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('maxScore > 0 yang valid')), 'Test 11: ESSAY ScoringGuide with undefined maxScore fails validation');
}

// 12. ESSAY ScoringGuide with maxScore = 0
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-essay-1',
    itemType: 'ESSAY',
    prompt: 'Jelaskan...',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-essay-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    answerType: 'EXPECTED_RESPONSE',
    value: 'Rambu jawaban',
  });
  pkg.scoringGuides.push({
    id: 'sg-essay-1',
    title: 'Pedoman Uraian',
    guideType: 'ESSAY',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    instructions: 'Instruksi penskoran',
    maxScore: 0,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('maxScore > 0 yang valid') || e.includes('maxScore tidak valid')), 'Test 12: ESSAY ScoringGuide with maxScore = 0 fails validation');
}

// 13. ESSAY ScoringGuide with negative maxScore
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-essay-1',
    itemType: 'ESSAY',
    prompt: 'Jelaskan...',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-essay-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    answerType: 'EXPECTED_RESPONSE',
    value: 'Rambu jawaban',
  });
  pkg.scoringGuides.push({
    id: 'sg-essay-1',
    title: 'Pedoman Uraian',
    guideType: 'ESSAY',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    instructions: 'Instruksi penskoran',
    maxScore: -5,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('maxScore > 0 yang valid') || e.includes('maxScore tidak valid')), 'Test 13: ESSAY ScoringGuide with negative maxScore fails validation');
}

// 14. ESSAY ScoringGuide with NaN maxScore
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-essay-1',
    itemType: 'ESSAY',
    prompt: 'Jelaskan...',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-essay-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    answerType: 'EXPECTED_RESPONSE',
    value: 'Rambu jawaban',
  });
  pkg.scoringGuides.push({
    id: 'sg-essay-1',
    title: 'Pedoman Uraian',
    guideType: 'ESSAY',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    instructions: 'Instruksi penskoran',
    maxScore: NaN,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('maxScore > 0 yang valid') || e.includes('maxScore tidak valid')), 'Test 14: ESSAY ScoringGuide with NaN maxScore fails validation');
}

// 15. ESSAY ScoringGuide with Infinity maxScore
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-essay-1',
    itemType: 'ESSAY',
    prompt: 'Jelaskan...',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-essay-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    answerType: 'EXPECTED_RESPONSE',
    value: 'Rambu jawaban',
  });
  pkg.scoringGuides.push({
    id: 'sg-essay-1',
    title: 'Pedoman Uraian',
    guideType: 'ESSAY',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    instructions: 'Instruksi penskoran',
    maxScore: Infinity,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('maxScore > 0 yang valid') || e.includes('maxScore tidak valid')), 'Test 15: ESSAY ScoringGuide with Infinity maxScore fails validation');
}

// 16. ESSAY ScoringGuide with dangling instrumentId
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-essay-1',
    itemType: 'ESSAY',
    prompt: 'Jelaskan...',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-essay-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    answerType: 'EXPECTED_RESPONSE',
    value: 'Rambu jawaban',
  });
  pkg.scoringGuides.push({
    id: 'sg-essay-1',
    title: 'Pedoman Uraian',
    guideType: 'ESSAY',
    instrumentId: 'ghost-inst-id',
    instrumentItemId: 'item-essay-1',
    instructions: 'Instruksi penskoran',
    maxScore: 10,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('merujuk instrumentId [ghost-inst-id] yang tidak ditemukan')), 'Test 16: ScoringGuide with dangling instrumentId fails validation');
}

// 17. ESSAY ScoringGuide with dangling instrumentItemId
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-essay-1',
    itemType: 'ESSAY',
    prompt: 'Jelaskan...',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-essay-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    answerType: 'EXPECTED_RESPONSE',
    value: 'Rambu jawaban',
  });
  pkg.scoringGuides.push({
    id: 'sg-essay-1',
    title: 'Pedoman Uraian',
    guideType: 'ESSAY',
    instrumentId: inst.id,
    instrumentItemId: 'ghost-item-id',
    instructions: 'Instruksi penskoran',
    maxScore: 10,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('merujuk item [ghost-item-id] yang tidak ditemukan')), 'Test 17: ScoringGuide with dangling instrumentItemId fails validation');
}

// 18. ESSAY ScoringGuide with cross-instrument item
{
  const pkg = createBasePackage();
  const inst1 = pkg.instruments[0] as WrittenAssessmentInstrument;
  const inst2: OralAssessmentInstrument = {
    id: 'inst-oral-2',
    type: 'ORAL_TEST',
    title: 'Tes Lisan Tambahan',
    items: [{ id: 'oral-item-1', prompt: 'Pertanyaan lisan?', order: 1 }],
  };
  pkg.instruments.push(inst2);

  pkg.scoringGuides.push({
    id: 'sg-essay-1',
    title: 'Pedoman Uraian',
    guideType: 'ESSAY',
    instrumentId: inst1.id,
    instrumentItemId: 'oral-item-1', // belongs to inst2, not inst1!
    instructions: 'Instruksi penskoran',
    maxScore: 10,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('milik instrumen lain')), 'Test 18: ScoringGuide with cross-instrument item linkage fails validation');
}

// 19. ESSAY guideType MANUAL for ESSAY item
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-essay-1',
    itemType: 'ESSAY',
    prompt: 'Jelaskan...',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-essay-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    answerType: 'EXPECTED_RESPONSE',
    value: 'Rambu jawaban',
  });
  pkg.scoringGuides.push({
    id: 'sg-essay-1',
    title: 'Pedoman Uraian',
    guideType: 'MANUAL', // Should be ESSAY
    instrumentId: inst.id,
    instrumentItemId: 'item-essay-1',
    instructions: 'Instruksi penskoran',
    maxScore: 10,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('pedoman penskoran canonical yang valid')), 'Test 19: ESSAY item with MANUAL guideType fails validation');
}

// 20. ScoringGuide with guideType ESSAY assigned to MULTIPLE_CHOICE item
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  pkg.scoringGuides.push({
    id: 'sg-essay-mc',
    title: 'Pedoman Penskoran Pilihan Ganda?',
    guideType: 'ESSAY',
    instrumentId: inst.id,
    instrumentItemId: 'item-mc-1', // MC item, not ESSAY!
    instructions: 'Instruksi penskoran',
    maxScore: 10,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('bukan berjenis ESSAY pada WRITTEN_TEST')), 'Test 20: ScoringGuide guideType ESSAY assigned to MULTIPLE_CHOICE item fails validation');
}

// 21. Valid SHORT_ANSWER item + EXACT AnswerKey
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-sa-1',
    itemType: 'SHORT_ANSWER',
    prompt: 'Tahun berapa Indonesia merdeka?',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-sa-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-sa-1',
    answerType: 'EXACT',
    value: '1945',
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(res.valid, 'Test 21: Valid SHORT_ANSWER + EXACT AnswerKey passes validation');
}

// 22. Valid SHORT_ANSWER item + EXPECTED_RESPONSE AnswerKey
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-sa-1',
    itemType: 'SHORT_ANSWER',
    prompt: 'Ibu kota Indonesia?',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-sa-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-sa-1',
    answerType: 'EXPECTED_RESPONSE',
    value: 'Jakarta / Nusantara',
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(res.valid, 'Test 22: Valid SHORT_ANSWER + EXPECTED_RESPONSE AnswerKey passes validation');
}

// 23. SHORT_ANSWER item missing AnswerKey
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-sa-1',
    itemType: 'SHORT_ANSWER',
    prompt: 'Tahun berapa Indonesia merdeka?',
    order: 2,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('Soal isian singkat #2 belum memiliki kunci jawaban canonical')), 'Test 23: SHORT_ANSWER missing AnswerKey fails validation');
}

// 24. SHORT_ANSWER item AnswerKey with empty value
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-sa-1',
    itemType: 'SHORT_ANSWER',
    prompt: 'Tahun berapa Indonesia merdeka?',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-sa-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-sa-1',
    answerType: 'EXACT',
    value: '',
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('Soal isian singkat #2 belum memiliki kunci jawaban canonical')), 'Test 24: SHORT_ANSWER AnswerKey with empty value fails validation');
}

// 25. SHORT_ANSWER item with valid optional ScoringGuide
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items.push({
    id: 'item-sa-1',
    itemType: 'SHORT_ANSWER',
    prompt: 'Tahun berapa Indonesia merdeka?',
    order: 2,
  });
  pkg.answerKeys.push({
    id: 'ak-sa-1',
    instrumentId: inst.id,
    instrumentItemId: 'item-sa-1',
    answerType: 'EXACT',
    value: '1945',
  });
  pkg.scoringGuides.push({
    id: 'sg-sa-1',
    title: 'Pedoman Isian Singkat',
    guideType: 'MANUAL',
    instrumentId: inst.id,
    instrumentItemId: 'item-sa-1',
    instructions: 'Skor 1 jika tepat, 0 jika salah',
    maxScore: 1,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(res.valid, 'Test 25: SHORT_ANSWER with valid optional ScoringGuide passes validation');
}

// 26. Generic MANUAL ScoringGuide with empty title
{
  const pkg = createBasePackage();
  pkg.scoringGuides.push({
    id: 'sg-manual-1',
    title: '',
    guideType: 'MANUAL',
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('Pedoman penskoran #1 belum memiliki judul')), 'Test 26: Generic MANUAL ScoringGuide with empty title fails validation');
}

// 27. Generic MANUAL ScoringGuide with dangling instrumentId
{
  const pkg = createBasePackage();
  pkg.scoringGuides.push({
    id: 'sg-manual-1',
    title: 'Pedoman Umum',
    guideType: 'MANUAL',
    instrumentId: 'ghost-inst-999',
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('merujuk instrumentId [ghost-inst-999] yang tidak ditemukan')), 'Test 27: Generic MANUAL ScoringGuide with dangling instrumentId fails validation');
}

// 28. Generic MANUAL ScoringGuide with instrumentItemId set but instrumentId empty
{
  const pkg = createBasePackage();
  pkg.scoringGuides.push({
    id: 'sg-manual-1',
    title: 'Pedoman Tanpa Instrumen',
    guideType: 'MANUAL',
    instrumentItemId: 'item-mc-1',
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('memiliki instrumentItemId [item-mc-1] tanpa instrumentId')), 'Test 28: ScoringGuide with instrumentItemId without instrumentId fails validation');
}

// 29. Generic MANUAL ScoringGuide with valid exact instrumentId and item ownership
{
  const pkg = createBasePackage();
  const inst = pkg.instruments[0];
  pkg.scoringGuides.push({
    id: 'sg-manual-1',
    title: 'Pedoman Khusus Pilihan Ganda',
    guideType: 'MANUAL',
    instrumentId: inst.id,
    instrumentItemId: 'item-mc-1',
    instructions: 'Informasi tambahan untuk pemeriksaan guru',
    maxScore: 1,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(res.valid, 'Test 29: Generic MANUAL ScoringGuide with valid exact ownership passes validation');
}

// 30. Generic MANUAL ScoringGuide with finite positive maxScore
{
  const pkg = createBasePackage();
  pkg.scoringGuides.push({
    id: 'sg-manual-1',
    title: 'Pedoman Umum Bobot Nilai',
    guideType: 'MANUAL',
    maxScore: 100,
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(res.valid, 'Test 30: Generic MANUAL ScoringGuide with finite positive maxScore passes validation');
}

// 31. UI builder file verification
{
  const uiContent = fs.readFileSync(path.resolve('src/components/administration/AssessmentPackageBuilder.tsx'), 'utf-8');
  const hasAddButton = uiContent.includes('Tambah Pedoman Penskoran');
  const hasInstrumentSelect = uiContent.includes('Instrumen Terkait:');
  const hasItemSelect = uiContent.includes('Butir Soal / Aspek Terkait:');
  const hasDeleteAction = uiContent.includes('Hapus Pedoman Penskoran');
  const noFakeData = !uiContent.includes('mockScoringGuide') && !uiContent.includes('dummyScore');

  assert(hasAddButton && hasInstrumentSelect && hasItemSelect && hasDeleteAction && noFakeData, 'Test 31: UI builder contains required manual scoring guide elements without fake data');
}

// 32. Service file verification
{
  const svcContent = fs.readFileSync(path.resolve('src/services/assessmentPackageService.ts'), 'utf-8');
  const hasStructuralSg = svcContent.includes('Structural Validation of AssessmentScoringGuides');
  const hasEssayValidation = svcContent.includes('Soal uraian #');
  const hasShortAnswerValidation = svcContent.includes('Soal isian singkat #');
  const noAnswerFallback = !svcContent.includes('item.prompt as AnswerKey') && !svcContent.includes('item.notes as AnswerKey');

  assert(hasStructuralSg && hasEssayValidation && hasShortAnswerValidation && noAnswerFallback, 'Test 32: Service contains fail-closed scoring guide & item integrity rules');
}

// 33. Export service integrity check
{
  const exportPath = path.resolve('src/services/documentEngine/assessmentExportService.ts');
  assert(fs.existsSync(exportPath), 'Test 33: Document export service file exists and is intact');
}

// 34. Strict Typing Check across modified codebase (verifying zero type escapes in B.1.2o changes)
{
  const filesToCheck = [
    'scripts/testB12oScoringGuideEssayIntegrityRegression.ts',
    'src/services/assessmentPackageService.ts',
    'src/components/administration/AssessmentPackageBuilder.tsx',
  ];

  const forbiddenPatterns = [
    ['as', 'any'].join(' '),
    ['as', 'unknown', 'as'].join(' '),
    ['@ts', 'ignore'].join('-'),
    ['@ts', 'expect-error'].join('-'),
  ];

  let foundEscape = false;
  filesToCheck.forEach((filePath) => {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) return;
    const code = fs.readFileSync(fullPath, 'utf-8');
    for (const pattern of forbiddenPatterns) {
      if (code.includes(pattern)) {
        foundEscape = true;
        console.error(`Forbidden type escape "${pattern}" found in ${filePath}`);
        break;
      }
    }
  });

  assert(!foundEscape, 'Test 34: Zero type escapes across regression test, service, and component files');
}

// 35. ScoringGuide with empty id fails validation
{
  const pkg = createBasePackage();
  pkg.scoringGuides.push({
    id: '',
    title: 'Pedoman Penskoran Tanpa ID',
    guideType: 'MANUAL',
  });

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some(e => e.includes('belum memiliki id canonical')), 'Test 35: ScoringGuide with empty id fails validation');
}

console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
if (failed > 0) {
  process.exit(1);
}
