import * as fs from 'fs';
import * as path from 'path';
import { validateAssessmentPackage } from '../src/services/assessmentPackageService';
import { buildNormalizedAssessmentDocumentModel } from '../src/services/documentEngine/assessmentExportService';
import type {
  AssessmentPackage,
  WrittenAssessmentInstrument,
  OralAssessmentInstrument,
  AcademicSetting,
  AssessmentPlan,
  TPData,
  AssessmentRubric,
  AssessmentScoringGuide,
  AssessmentAnswerKey,
  AssessmentDocumentSnapshot,
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
    {
      id: 'tp-2',
      code: 'TP-2',
      statement: 'Siswa mampu menerapkan taktik permainan bola basket',
      competence: 'Menerapkan',
      contentScope: 'Bola Basket',
      p3Dimensions: [],
      order: 2,
    },
  ],
  workflowStatus: 'SIAP',
  needsReview: false,
  updatedAt: new Date().toISOString(),
};

const mockPlan: AssessmentPlan = {
  id: 'plan-1',
  academicSettingId: 'setting-1',
  workspaceId: 'ws-1',
  title: 'Rencana Asesmen Utama',
  purpose: 'SUMMATIVE',
  timing: 'POST',
  scopeType: 'TP',
  tpIds: ['tp-1', 'tp-2'],
  criterionIds: [],
  instruments: [
    { id: 'inst-written-1', type: 'WRITTEN_TEST', label: 'Tes Tertulis A' },
    { id: 'inst-written-2', type: 'WRITTEN_TEST', label: 'Tes Tertulis B' },
    { id: 'inst-oral-1', type: 'ORAL_TEST', label: 'Tes Lisan A' },
  ],
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

function createValidBasePackage(): AssessmentPackage {
  const instWrittenId = 'inst-written-1';
  const mcItemId = 'item-mc-1';
  const essayItemId = 'item-essay-1';

  const writtenInst: WrittenAssessmentInstrument = {
    id: instWrittenId,
    type: 'WRITTEN_TEST',
    title: 'Tes Tertulis Utama',
    items: [
      {
        id: mcItemId,
        itemType: 'MULTIPLE_CHOICE',
        prompt: 'Siapa penemu bola basket?',
        options: [
          { id: 'opt-a', label: 'A', text: 'James Naismith' },
          { id: 'opt-b', label: 'B', text: 'William G. Morgan' },
        ],
        order: 1,
      },
      {
        id: essayItemId,
        itemType: 'ESSAY',
        prompt: 'Jelaskan sejarah singkat permainan bola basket!',
        order: 2,
      },
    ],
  };

  const oralInst: OralAssessmentInstrument = {
    id: 'inst-oral-1',
    type: 'ORAL_TEST',
    title: 'Tes Lisan Utama',
    items: [
      {
        id: 'item-oral-1',
        prompt: 'Sebutkan jumlah pemain bola basket dalam satu tim!',
        expectedResponse: '5 orang pemain',
        order: 1,
      },
      {
        id: 'item-oral-2',
        prompt: 'Berapa durasi pertandingan basket standar FIBA?',
        expectedResponse: '4 x 10 menit',
        order: 2,
      },
    ],
  };

  const akMc: AssessmentAnswerKey = {
    id: 'ak-1',
    instrumentId: instWrittenId,
    instrumentItemId: mcItemId,
    answerType: 'OPTION',
    optionIds: ['opt-a'],
  };

  const akEssay: AssessmentAnswerKey = {
    id: 'ak-2',
    instrumentId: instWrittenId,
    instrumentItemId: essayItemId,
    answerType: 'EXPECTED_RESPONSE',
    value: 'Bola basket diciptakan oleh Dr. James Naismith.',
  };

  const rub: AssessmentRubric = {
    id: 'rub-1',
    title: 'Rubrik Tes Tertulis',
    criteria: [{ id: 'crit-1', label: 'Keakuratan' }],
    scale: [{ id: 'sc-1', label: 'Sangat Baik', score: 4, order: 1 }],
    instrumentId: instWrittenId,
    instrumentItemId: essayItemId,
  };

  const sg: AssessmentScoringGuide = {
    id: 'sg-1',
    title: 'Pedoman Penskoran Uraian',
    guideType: 'ESSAY',
    instructions: 'Jawaban tepat mendapat poin penuh.',
    maxScore: 10,
    instrumentId: instWrittenId,
    instrumentItemId: essayItemId,
  };

  return {
    id: 'pkg-plan-1',
    assessmentPlanId: 'plan-1',
    academicSettingId: 'setting-1',
    workspaceId: 'ws-1',
    title: 'Perangkat Asesmen Utama',
    blueprintItems: [
      {
        id: 'bp-1',
        objectiveRefId: 'tp-1',
        instrumentType: 'WRITTEN_TEST',
        instrumentItemIds: [mcItemId],
        order: 1,
        assessmentIndicator: 'Menjawab pencetus olahraga basket',
      },
      {
        id: 'bp-2',
        objectiveRefId: 'tp-2',
        instrumentType: 'WRITTEN_TEST',
        instrumentItemIds: [essayItemId],
        order: 2,
        assessmentIndicator: 'Menjelaskan asal usul basket',
      },
    ],
    instruments: [writtenInst, oralInst],
    answerKeys: [akMc, akEssay],
    scoringGuides: [sg],
    rubrics: [rub],
    workflowStatus: 'SIAP',
    needsReview: false,
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

console.log('=== B.1.2q — EXACT ORDER CONTRACT HARDENING REGRESSION TESTS ===\n');

// -----------------------------------------------------------------------------
// SECTION 1: BLUEPRINT ORDER TESTS
// -----------------------------------------------------------------------------
console.log('--- 1. Blueprint Order Tests ---');

// Test 1: Valid blueprint orders 1,2 -> PASS
{
  const pkg = createValidBasePackage();
  pkg.blueprintItems[0].order = 1;
  pkg.blueprintItems[1].order = 2;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(res.valid, 'Test 1: Valid blueprint orders 1, 2 → PASS');
}

// Test 2: Blueprint order 0 -> FAIL
{
  const pkg = createValidBasePackage();
  pkg.blueprintItems[0].order = 0;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('kisi-kisi') && e.includes('order canonical tidak valid [0]')), 'Test 2: Blueprint order 0 → FAIL');
}

// Test 3: Blueprint order -1 -> FAIL
{
  const pkg = createValidBasePackage();
  pkg.blueprintItems[0].order = -1;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('kisi-kisi') && e.includes('order canonical tidak valid [-1]')), 'Test 3: Blueprint order -1 → FAIL');
}

// Test 4: Blueprint order 1.5 -> FAIL
{
  const pkg = createValidBasePackage();
  pkg.blueprintItems[0].order = 1.5;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('kisi-kisi') && e.includes('order canonical tidak valid [1.5]')), 'Test 4: Blueprint order 1.5 → FAIL');
}

// Test 5: Duplicate blueprint order (1, 1) -> FAIL
{
  const pkg = createValidBasePackage();
  pkg.blueprintItems[0].order = 1;
  pkg.blueprintItems[1].order = 1;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('duplicate order canonical pada kisi-kisi [1]')), 'Test 5: Duplicate blueprint order → FAIL');
}

// Test 6: Non-sequential but valid blueprint orders 1, 3 -> PASS
{
  const pkg = createValidBasePackage();
  pkg.blueprintItems[0].order = 1;
  pkg.blueprintItems[1].order = 3;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(res.valid, 'Test 6: Non-sequential but valid blueprint orders 1, 3 → PASS');
}

// -----------------------------------------------------------------------------
// SECTION 2: WRITTEN ITEM ORDER TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 2. Written Item Order Tests ---');

// Test 7: Valid written item orders 1, 2 -> PASS
{
  const pkg = createValidBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items[0].order = 1;
  inst.items[1].order = 2;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(res.valid, 'Test 7: Valid written item orders 1, 2 → PASS');
}

// Test 8: Written item order 0 -> FAIL
{
  const pkg = createValidBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items[0].order = 0;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('Soal tertulis') && e.includes('order canonical tidak valid [0]')), 'Test 8: Written item order 0 → FAIL');
}

// Test 9: Written item order -1 -> FAIL
{
  const pkg = createValidBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items[0].order = -1;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('Soal tertulis') && e.includes('order canonical tidak valid [-1]')), 'Test 9: Written item order -1 → FAIL');
}

// Test 10: Written item order 1.5 -> FAIL
{
  const pkg = createValidBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items[0].order = 1.5;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('Soal tertulis') && e.includes('order canonical tidak valid [1.5]')), 'Test 10: Written item order 1.5 → FAIL');
}

// Test 11: Duplicate written item order (1, 1) -> FAIL
{
  const pkg = createValidBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items[0].order = 1;
  inst.items[1].order = 1;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('duplicate order canonical pada tes tertulis [1]')), 'Test 11: Duplicate written item order → FAIL');
}

// Test 12: Non-sequential written item orders 1, 4 -> PASS
{
  const pkg = createValidBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items[0].order = 1;
  inst.items[1].order = 4;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(res.valid, 'Test 12: Non-sequential written item orders 1, 4 → PASS');
}

// -----------------------------------------------------------------------------
// SECTION 3: ORAL ITEM ORDER TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 3. Oral Item Order Tests ---');

// Test 13: Valid oral item orders 1, 2 -> PASS
{
  const pkg = createValidBasePackage();
  const inst = pkg.instruments[1] as OralAssessmentInstrument;
  inst.items[0].order = 1;
  inst.items[1].order = 2;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(res.valid, 'Test 13: Valid oral item orders 1, 2 → PASS');
}

// Test 14: Oral item order 0 -> FAIL
{
  const pkg = createValidBasePackage();
  const inst = pkg.instruments[1] as OralAssessmentInstrument;
  inst.items[0].order = 0;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('Pertanyaan tes lisan') && e.includes('order canonical tidak valid [0]')), 'Test 14: Oral item order 0 → FAIL');
}

// Test 15: Oral item order -1 -> FAIL
{
  const pkg = createValidBasePackage();
  const inst = pkg.instruments[1] as OralAssessmentInstrument;
  inst.items[0].order = -1;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('Pertanyaan tes lisan') && e.includes('order canonical tidak valid [-1]')), 'Test 15: Oral item order -1 → FAIL');
}

// Test 16: Oral item order 1.5 -> FAIL
{
  const pkg = createValidBasePackage();
  const inst = pkg.instruments[1] as OralAssessmentInstrument;
  inst.items[0].order = 1.5;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('Pertanyaan tes lisan') && e.includes('order canonical tidak valid [1.5]')), 'Test 16: Oral item order 1.5 → FAIL');
}

// Test 17: Duplicate oral item order (1, 1) -> FAIL
{
  const pkg = createValidBasePackage();
  const inst = pkg.instruments[1] as OralAssessmentInstrument;
  inst.items[0].order = 1;
  inst.items[1].order = 1;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('duplicate order canonical pada tes lisan [1]')), 'Test 17: Duplicate oral item order → FAIL');
}

// Test 18: Non-sequential oral item orders 1, 3 -> PASS
{
  const pkg = createValidBasePackage();
  const inst = pkg.instruments[1] as OralAssessmentInstrument;
  inst.items[0].order = 1;
  inst.items[1].order = 3;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(res.valid, 'Test 18: Non-sequential oral item orders 1, 3 → PASS');
}

// -----------------------------------------------------------------------------
// SECTION 4: CROSS INSTRUMENT INDEPENDENCE TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 4. Cross Instrument Independence Tests ---');

// Test 19: Written Inst A order 1 and Written Inst B order 1 -> PASS
{
  const pkg = createValidBasePackage();
  const instB: WrittenAssessmentInstrument = {
    id: 'inst-written-2',
    type: 'WRITTEN_TEST',
    title: 'Tes Tertulis B',
    items: [
      {
        id: 'item-mc-b1',
        itemType: 'MULTIPLE_CHOICE',
        prompt: 'Soal instrumen B',
        options: [
          { id: 'opt-b1', label: 'A', text: 'Opsi 1' },
          { id: 'opt-b2', label: 'B', text: 'Opsi 2' },
        ],
        order: 1, // Same order as inst-written-1 item 1
      },
    ],
  };

  const akB: AssessmentAnswerKey = {
    id: 'ak-b1',
    instrumentId: 'inst-written-2',
    instrumentItemId: 'item-mc-b1',
    answerType: 'OPTION',
    optionIds: ['opt-b1'],
  };

  pkg.instruments.push(instB);
  pkg.answerKeys.push(akB);

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(res.valid, 'Test 19: Written Inst A order 1 and Written Inst B order 1 → PASS');
}

// Test 20: Written Inst A order 1 and Oral Inst A order 1 -> PASS
{
  const pkg = createValidBasePackage();
  const writtenInst = pkg.instruments[0] as WrittenAssessmentInstrument;
  const oralInst = pkg.instruments[1] as OralAssessmentInstrument;

  writtenInst.items[0].order = 1;
  oralInst.items[0].order = 1;

  const res = validateAssessmentPackage(pkg, mockContext);
  assert(res.valid, 'Test 20: Written Inst A order 1 and Oral Inst A order 1 → PASS');
}

// -----------------------------------------------------------------------------
// SECTION 5: EXPORT MODEL NORMALIZATION TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 5. Export Model Normalization Tests ---');

// Test 21: Normalized kisiKisi row `no` uses exact `bp.order` without fallback
{
  const pkg = createValidBasePackage();
  pkg.blueprintItems[0].order = 5;
  pkg.blueprintItems[1].order = 10;

  const snapshot: AssessmentDocumentSnapshot = {
    snapshotId: 'snap-order-test',
    mode: 'CANONICAL_PACKAGE',
    documentType: 'ASESMEN',
    documentDate: '2026-09-24',
    formattedDocumentDate: '24 September 2026',
    assessmentPlanId: pkg.assessmentPlanId,
    assessmentPackageId: pkg.id,
    assessmentPackageRevision: 1,
    packageTitle: pkg.title,
    schoolName: 'SD Test',
    teacherName: 'Guru Test',
    principalName: 'Kepala Sekolah',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    grade: 'Kelas 10',
    subject: 'PJOK',
    curriculum: 'Kurikulum Merdeka',
    documentMode: 'data',
    generatedAt: new Date().toISOString(),
    blueprintItems: pkg.blueprintItems,
    instruments: pkg.instruments,
    answerKeys: pkg.answerKeys,
    scoringGuides: pkg.scoringGuides,
    rubrics: pkg.rubrics,
    resolvedObjectives: {
      'tp-1': { code: 'TP-1', statement: 'Mendemonstrasikan basket' },
      'tp-2': { code: 'TP-2', statement: 'Menerapkan taktik basket' },
    },
  };

  const model = buildNormalizedAssessmentDocumentModel(snapshot);
  assert(model.kisiKisi.rows[0].no === 5, 'Test 21a: First blueprint row no = exact bp.order (5)');
  assert(model.kisiKisi.rows[1].no === 10, 'Test 21b: Second blueprint row no = exact bp.order (10)');
}

// Test 22: Normalized written item `no` uses exact `item.order` without fallback
{
  const pkg = createValidBasePackage();
  const writtenInst = pkg.instruments[0] as WrittenAssessmentInstrument;
  writtenInst.items[0].order = 7;
  writtenInst.items[1].order = 12;

  const snapshot: AssessmentDocumentSnapshot = {
    snapshotId: 'snap-order-test-2',
    mode: 'CANONICAL_PACKAGE',
    documentType: 'ASESMEN',
    documentDate: '2026-09-24',
    formattedDocumentDate: '24 September 2026',
    assessmentPlanId: pkg.assessmentPlanId,
    assessmentPackageId: pkg.id,
    assessmentPackageRevision: 1,
    packageTitle: pkg.title,
    schoolName: 'SD Test',
    teacherName: 'Guru Test',
    principalName: 'Kepala Sekolah',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    grade: 'Kelas 10',
    subject: 'PJOK',
    curriculum: 'Kurikulum Merdeka',
    documentMode: 'data',
    generatedAt: new Date().toISOString(),
    blueprintItems: pkg.blueprintItems,
    instruments: pkg.instruments,
    answerKeys: pkg.answerKeys,
    scoringGuides: pkg.scoringGuides,
    rubrics: pkg.rubrics,
    resolvedObjectives: {},
  };

  const model = buildNormalizedAssessmentDocumentModel(snapshot);
  const normWritten = model.instruments.list.find((i) => i.type === 'WRITTEN_TEST');
  assert(normWritten?.writtenItems?.[0].no === 7, 'Test 22a: First written item no = exact item.order (7)');
  assert(normWritten?.writtenItems?.[1].no === 12, 'Test 22b: Second written item no = exact item.order (12)');
}

// Test 23: Normalized oral item `no` uses exact `item.order` without fallback
{
  const pkg = createValidBasePackage();
  const oralInst = pkg.instruments[1] as OralAssessmentInstrument;
  oralInst.items[0].order = 3;
  oralInst.items[1].order = 8;

  const snapshot: AssessmentDocumentSnapshot = {
    snapshotId: 'snap-order-test-3',
    mode: 'CANONICAL_PACKAGE',
    documentType: 'ASESMEN',
    documentDate: '2026-09-24',
    formattedDocumentDate: '24 September 2026',
    assessmentPlanId: pkg.assessmentPlanId,
    assessmentPackageId: pkg.id,
    assessmentPackageRevision: 1,
    packageTitle: pkg.title,
    schoolName: 'SD Test',
    teacherName: 'Guru Test',
    principalName: 'Kepala Sekolah',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    grade: 'Kelas 10',
    subject: 'PJOK',
    curriculum: 'Kurikulum Merdeka',
    documentMode: 'data',
    generatedAt: new Date().toISOString(),
    blueprintItems: pkg.blueprintItems,
    instruments: pkg.instruments,
    answerKeys: pkg.answerKeys,
    scoringGuides: pkg.scoringGuides,
    rubrics: pkg.rubrics,
    resolvedObjectives: {},
  };

  const model = buildNormalizedAssessmentDocumentModel(snapshot);
  const normOral = model.instruments.list.find((i) => i.type === 'ORAL_TEST');
  assert(normOral?.oralItems?.[0].no === 3, 'Test 23a: First oral item no = exact item.order (3)');
  assert(normOral?.oralItems?.[1].no === 8, 'Test 23b: Second oral item no = exact item.order (8)');
}

// Test 24: Normalized answer key `itemNumber` preserves exact `linked item.order`
{
  const pkg = createValidBasePackage();
  const writtenInst = pkg.instruments[0] as WrittenAssessmentInstrument;
  writtenInst.items[0].order = 9;

  const snapshot: AssessmentDocumentSnapshot = {
    snapshotId: 'snap-order-test-4',
    mode: 'CANONICAL_PACKAGE',
    documentType: 'ASESMEN',
    documentDate: '2026-09-24',
    formattedDocumentDate: '24 September 2026',
    assessmentPlanId: pkg.assessmentPlanId,
    assessmentPackageId: pkg.id,
    assessmentPackageRevision: 1,
    packageTitle: pkg.title,
    schoolName: 'SD Test',
    teacherName: 'Guru Test',
    principalName: 'Kepala Sekolah',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    grade: 'Kelas 10',
    subject: 'PJOK',
    curriculum: 'Kurikulum Merdeka',
    documentMode: 'data',
    generatedAt: new Date().toISOString(),
    blueprintItems: pkg.blueprintItems,
    instruments: pkg.instruments,
    answerKeys: pkg.answerKeys,
    scoringGuides: pkg.scoringGuides,
    rubrics: pkg.rubrics,
    resolvedObjectives: {},
  };

  const model = buildNormalizedAssessmentDocumentModel(snapshot);
  const mcAk = model.answerKeys.list.find((ak) => ak.answerType === 'OPTION');
  assert(mcAk?.itemNumber === 9, 'Test 24: Normalized answer key itemNumber = exact linked item.order (9)');
}

// -----------------------------------------------------------------------------
// ADDITIONAL HARDENING TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 6. Additional Hardening Tests ---');

// Test 25: Blueprint order NaN -> FAIL
{
  const pkg = createValidBasePackage();
  pkg.blueprintItems[0].order = NaN;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('kisi-kisi') && e.includes('order canonical tidak valid')), 'Test 25: Blueprint order NaN → FAIL');
}

// Test 26: Written item order NaN -> FAIL
{
  const pkg = createValidBasePackage();
  const inst = pkg.instruments[0] as WrittenAssessmentInstrument;
  inst.items[0].order = NaN;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('Soal tertulis') && e.includes('order canonical tidak valid')), 'Test 26: Written item order NaN → FAIL');
}

// Test 27: Oral item order NaN -> FAIL
{
  const pkg = createValidBasePackage();
  const inst = pkg.instruments[1] as OralAssessmentInstrument;
  inst.items[0].order = NaN;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('Pertanyaan tes lisan') && e.includes('order canonical tidak valid')), 'Test 27: Oral item order NaN → FAIL');
}

// Test 28: Duplicate blueprint orders 2, 2 -> FAIL
{
  const pkg = createValidBasePackage();
  pkg.blueprintItems[0].order = 2;
  pkg.blueprintItems[1].order = 2;
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('duplicate order canonical pada kisi-kisi [2]')), 'Test 28: Duplicate blueprint order 2, 2 → FAIL');
}

// -----------------------------------------------------------------------------
// SECTION 7: RUBRIC SCALE ORDER TESTS
// -----------------------------------------------------------------------------
console.log('\n--- 7. Rubric Scale Level Order Tests ---');

// Test 29: Valid rubric scale level order (1, 2) -> PASS
{
  const pkg = createValidBasePackage();
  pkg.rubrics[0].scale = [
    { id: 'sc-1', label: 'Cukup', score: 2, order: 1 },
    { id: 'sc-2', label: 'Baik', score: 4, order: 2 },
  ];
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(res.valid, 'Test 29: Valid rubric scale order 1, 2 → PASS');
}

// Test 30: Rubric scale level order 0 -> FAIL
{
  const pkg = createValidBasePackage();
  pkg.rubrics[0].scale = [
    { id: 'sc-1', label: 'Cukup', score: 2, order: 0 },
    { id: 'sc-2', label: 'Baik', score: 4, order: 2 },
  ];
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('skala') && e.includes('order canonical tidak valid [0]')), 'Test 30: Rubric scale order 0 → FAIL');
}

// Test 31: Rubric scale level order -1 -> FAIL
{
  const pkg = createValidBasePackage();
  pkg.rubrics[0].scale = [
    { id: 'sc-1', label: 'Cukup', score: 2, order: -1 },
    { id: 'sc-2', label: 'Baik', score: 4, order: 2 },
  ];
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('skala') && e.includes('order canonical tidak valid [-1]')), 'Test 31: Rubric scale order -1 → FAIL');
}

// Test 32: Rubric scale level order 1.5 -> FAIL
{
  const pkg = createValidBasePackage();
  pkg.rubrics[0].scale = [
    { id: 'sc-1', label: 'Cukup', score: 2, order: 1.5 },
    { id: 'sc-2', label: 'Baik', score: 4, order: 2 },
  ];
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('skala') && e.includes('order canonical tidak valid [1.5]')), 'Test 32: Rubric scale order 1.5 → FAIL');
}

// Test 33: Rubric scale level order NaN -> FAIL
{
  const pkg = createValidBasePackage();
  pkg.rubrics[0].scale = [
    { id: 'sc-1', label: 'Cukup', score: 2, order: NaN },
    { id: 'sc-2', label: 'Baik', score: 4, order: 2 },
  ];
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('skala') && e.includes('order canonical tidak valid')), 'Test 33: Rubric scale order NaN → FAIL');
}

// Test 34: Duplicate rubric scale level order (1, 1) -> FAIL
{
  const pkg = createValidBasePackage();
  pkg.rubrics[0].scale = [
    { id: 'sc-1', label: 'Cukup', score: 2, order: 1 },
    { id: 'sc-2', label: 'Baik', score: 4, order: 1 },
  ];
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(!res.valid && res.errors.some((e) => e.includes('duplicate order canonical pada skala rubrik')), 'Test 34: Duplicate rubric scale order 1, 1 → FAIL');
}

// Test 35: Non-sequential rubric scale level order (1, 3) -> PASS
{
  const pkg = createValidBasePackage();
  pkg.rubrics[0].scale = [
    { id: 'sc-1', label: 'Cukup', score: 2, order: 1 },
    { id: 'sc-2', label: 'Sangat Baik', score: 5, order: 3 },
  ];
  const res = validateAssessmentPackage(pkg, mockContext);
  assert(res.valid, 'Test 35: Non-sequential rubric scale order 1, 3 → PASS');
}

// Test 36: Export rubric scale sorting uses exact a.order - b.order
{
  const pkg = createValidBasePackage();
  pkg.rubrics[0].scale = [
    { id: 'sc-2', label: 'Tinggi', score: 5, order: 2 },
    { id: 'sc-1', label: 'Rendah', score: 1, order: 1 },
  ];

  const snapshot: AssessmentDocumentSnapshot = {
    snapshotId: 'snap-rubric-sort',
    mode: 'CANONICAL_PACKAGE',
    documentType: 'ASESMEN',
    documentDate: '2026-09-24',
    formattedDocumentDate: '24 September 2026',
    assessmentPlanId: pkg.assessmentPlanId,
    assessmentPackageId: pkg.id,
    assessmentPackageRevision: 1,
    packageTitle: pkg.title,
    schoolName: 'SD Test',
    teacherName: 'Guru Test',
    principalName: 'Kepala Sekolah',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    grade: 'Kelas 10',
    subject: 'PJOK',
    curriculum: 'Kurikulum Merdeka',
    documentMode: 'data',
    generatedAt: new Date().toISOString(),
    blueprintItems: pkg.blueprintItems,
    instruments: pkg.instruments,
    answerKeys: pkg.answerKeys,
    scoringGuides: pkg.scoringGuides,
    rubrics: pkg.rubrics,
    resolvedObjectives: {},
  };

  const model = buildNormalizedAssessmentDocumentModel(snapshot);
  const normRubric = model.rubrics.list[0];
  assert(normRubric.scale[0].label === 'Rendah' && normRubric.scale[1].label === 'Tinggi', 'Test 36: Export rubric scale correctly sorted by a.order - b.order');
}

// Test 37: Full forbidden type escape scan across services and regression script
{
  const forbiddenPatterns = [
    ['as', 'any'].join(' '),
    ['as', 'unknown', 'as'].join(' '),
    ['@ts', 'ignore'].join('-'),
    ['@ts', 'expect-error'].join('-'),
  ];

  const filesToCheck = [
    'src/services/assessmentPackageService.ts',
    'src/services/documentEngine/assessmentExportService.ts',
    'scripts/testB12qExactOrderContractRegression.ts',
  ];

  filesToCheck.forEach((relativePath) => {
    const code = fs.readFileSync(
      path.join(process.cwd(), relativePath),
      'utf8'
    );

    forbiddenPatterns.forEach((pattern) => {
      assert(
        !code.includes(pattern),
        `Test 37: ${relativePath} contains no forbidden type escape [${pattern}]`
      );
    });
  });
}

// Test 38: Preservation of B.1.2n canonical option key label resolution
{
  const pkg = createValidBasePackage();
  const writtenInst = pkg.instruments[0] as WrittenAssessmentInstrument;
  writtenInst.items[0].options = [
    { id: 'opt-a', label: 'A', text: 'Salah', isCorrect: true },
    { id: 'opt-b', label: 'B', text: 'Benar', isCorrect: false },
  ];

  pkg.answerKeys[0].optionIds = ['opt-b'];

  const snapshot: AssessmentDocumentSnapshot = {
    snapshotId: 'snap-b12n-preservation',
    mode: 'CANONICAL_PACKAGE',
    documentType: 'ASESMEN',
    documentDate: '2026-09-24',
    formattedDocumentDate: '24 September 2026',
    assessmentPlanId: pkg.assessmentPlanId,
    assessmentPackageId: pkg.id,
    assessmentPackageRevision: 1,
    packageTitle: pkg.title,
    schoolName: 'SD Test',
    teacherName: 'Guru Test',
    principalName: 'Kepala Sekolah',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    grade: 'Kelas 10',
    subject: 'PJOK',
    curriculum: 'Kurikulum Merdeka',
    documentMode: 'data',
    generatedAt: new Date().toISOString(),
    blueprintItems: pkg.blueprintItems,
    instruments: pkg.instruments,
    answerKeys: pkg.answerKeys,
    scoringGuides: pkg.scoringGuides,
    rubrics: pkg.rubrics,
    resolvedObjectives: {},
  };

  const model = buildNormalizedAssessmentDocumentModel(snapshot);
  const mcAk = model.answerKeys.list.find((ak) => ak.answerType === 'OPTION');
  assert(mcAk?.value === 'B', 'Test 38: Preserves B.1.2n exact linked option.label resolution (value = "B")');
}

// Test 39: Preservation of B.1.2o ESSAY ScoringGuide integrity
{
  const pkg = createValidBasePackage();

  // Verify ESSAY answer key is present with EXPECTED_RESPONSE
  const essayAnswerKey = pkg.answerKeys.find(
    (ak) => ak.instrumentItemId === 'item-essay-1'
  );

  assert(
    essayAnswerKey?.answerType === 'EXPECTED_RESPONSE',
    'Test 39: Canonical ESSAY EXPECTED_RESPONSE remains present'
  );

  // Remove ONLY ESSAY scoring guide
  pkg.scoringGuides = pkg.scoringGuides.filter(
    (sg) => sg.instrumentItemId !== 'item-essay-1'
  );

  const res = validateAssessmentPackage(pkg, mockContext);

  assert(
    !res.valid,
    'Test 39: B.1.2o ESSAY without canonical ScoringGuide fails validation'
  );

  assert(
    res.errors.some(
      (e) =>
        e.includes('pedoman penskoran canonical yang valid') ||
        e.includes('Pedoman penskoran')
    ),
    'Test 39: B.1.2o missing ESSAY ScoringGuide produces exact validation error'
  );
}

console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
