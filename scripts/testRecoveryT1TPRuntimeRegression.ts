/**
 * Recovery T1 TP Runtime Regression
 */
import { validateTPDataWorkflow, normalizePhaseCode } from '../src/services/cpWorkflowService';
import { buildTPDiagnosticReport } from '../src/services/diagnosticService';
import { AcademicSetting, ActiveContext, CPData, CPAnalysisData, TPData } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

const academicSetting: AcademicSetting = {
  id: 'acad-t1',
  profileId: 'prof-t1',
  curriculum: 'Kurikulum Merdeka',
  curriculumType: 'KURIKULUM_MERDEKA',
  academicYear: '2026/2027',
  semester: '1 (Ganjil)',
  level: 'SD',
  grade: 'Kelas 1',
  phase: 'Fase A',
  subject: 'Bahasa Indonesia',
  updatedAt: '2026-09-22T00:00:00.000Z',
};

const context: ActiveContext = {
  profileId: 'prof-t1',
  schoolId: 'sch-t1',
  curriculum: 'Kurikulum Merdeka',
  curriculumType: 'KURIKULUM_MERDEKA',
  academicYear: '2026/2027',
  semester: '1 (Ganjil)',
  level: 'SD',
  grade: 'Kelas 1',
  phase: 'Fase A',
  subject: 'Bahasa Indonesia',
};

const cp: CPData = {
  id: 'cp-t1',
  academicSettingId: 'acad-t1',
  generalDescription: 'Peserta didik mampu memahami teks sederhana dan mengomunikasikan gagasan secara runtut.',
  elements: [{ id: 'el-1', name: 'Membaca', content: 'Memahami teks sederhana.' }],
  source: {
    title: 'CP Bahasa Indonesia',
    institution: 'BSKAP',
    retrievedAt: '2026-09-22T00:00:00.000Z',
    verificationStatus: 'VERIFIED',
  },
  updatedAt: '2026-09-22T00:00:00.000Z',
};

const cpAnalysis: CPAnalysisData = {
  id: 'cpa-t1',
  academicSettingId: 'acad-t1',
  items: [{
    id: 'ana-1',
    elementName: 'Membaca',
    cpCompetence: 'Memahami',
    materialScope: 'Teks sederhana',
    order: 1,
  }],
  updatedAt: '2026-09-22T00:00:00.000Z',
};

function validTP(overrides: Partial<TPData> = {}): TPData {
  return {
    id: 'tp-t1',
    academicSettingId: 'acad-t1',
    cpId: 'cp-t1',
    cpAnalysisId: 'cpa-t1',
    academicYear: '2026/2027',
    subjectCode: 'Bahasa Indonesia',
    phase: 'Fase A',
    workflowStatus: 'SIAP',
    needsReview: false,
    items: [
      {
        id: 'tp-item-1',
        code: 'TP 1.1',
        statement: 'Peserta didik mampu mengidentifikasi informasi utama dalam teks sederhana.',
        competence: 'Mengidentifikasi',
        contentScope: 'Informasi utama teks sederhana',
        order: 1,
      },
      {
        id: 'tp-item-2',
        code: 'TP 1.2',
        statement: 'Peserta didik mampu menceritakan kembali isi teks sederhana dengan bahasa sendiri.',
        competence: 'Menceritakan',
        contentScope: 'Isi teks sederhana',
        order: 2,
      },
    ],
    updatedAt: '2026-09-22T00:00:00.000Z',
    ...overrides,
  };
}

console.log('=== RUNNING RECOVERY T1 TP RUNTIME REGRESSION ===');

assert(normalizePhaseCode('A') === 'A', 'Phase normalization: A -> A');
assert(normalizePhaseCode('Fase A') === 'A', 'Phase normalization: Fase A -> A');
assert(normalizePhaseCode('fase d') === 'D', 'Phase normalization: fase d -> D');
assert(normalizePhaseCode(' Fase F ') === 'F', 'Phase normalization: Fase F -> F');
assert(normalizePhaseCode('') === '', 'Phase normalization: empty -> empty');

[
  { level: 'SD', phase: 'Fase A' },
  { level: 'SD', phase: 'Fase B' },
  { level: 'SD', phase: 'Fase C' },
  { level: 'SMP', phase: 'Fase D' },
  { level: 'SMA', phase: 'Fase E' },
  { level: 'SMA', phase: 'Fase F' },
].forEach(({ level, phase }) => {
  const result = validateTPDataWorkflow(
    validTP({ phase }),
    cp,
    cpAnalysis,
    { ...context, level, phase }
  );
  assert(result.isSiap && result.status === 'SIAP', `Valid combination: ${level} + ${phase}`);
});

[
  { level: 'SD', phase: 'Fase D' },
  { level: 'SMP', phase: 'Fase A' },
  { level: 'SMA', phase: 'Fase C' },
].forEach(({ level, phase }) => {
  const result = validateTPDataWorkflow(
    validTP({ phase }),
    cp,
    cpAnalysis,
    { ...context, level, phase }
  );
  assert(!result.isSiap && result.status === 'PERLU_DILENGKAPI', `Invalid combination remains blocked: ${level} + ${phase}`);
  assert(!result.issues.join('\n').includes('Fase Fase'), `Invalid combination message has no duplicate Fase: ${level} + ${phase}`);
});

const equivalentPhaseResult = validateTPDataWorkflow(
  validTP({ phase: 'A' }),
  cp,
  cpAnalysis,
  { ...context, phase: 'Fase A' }
);
assert(equivalentPhaseResult.isSiap, 'Equivalent phase formats A and Fase A do not mismatch');

const aiReadyResult = validateTPDataWorkflow(validTP({ generatedBy: 'AI' }), cp, cpAnalysis, context);
assert(aiReadyResult.status === 'SIAP' && aiReadyResult.isSiap, 'AI-generated valid TP validates as SIAP');

assert(validateTPDataWorkflow(validTP({ items: [] }), cp, cpAnalysis, context).status === 'BELUM_DIMULAI', 'Empty TP items -> BELUM_DIMULAI');
assert(validateTPDataWorkflow(validTP({
  items: [{ ...validTP().items[0], statement: '' }],
}), cp, cpAnalysis, context).status === 'PERLU_DILENGKAPI', 'Empty statement -> PERLU_DILENGKAPI');
assert(validateTPDataWorkflow(validTP({
  items: [{ ...validTP().items[0] }, { ...validTP().items[1], id: 'tp-item-1' }],
}), cp, cpAnalysis, context).status === 'PERLU_DILENGKAPI', 'Duplicate TP ID -> PERLU_DILENGKAPI');
assert(validateTPDataWorkflow(validTP({ phase: 'Fase B' }), cp, cpAnalysis, { ...context, phase: 'Fase A' }).status === 'PERLU_DILENGKAPI', 'Real phase mismatch remains blocked');

const tpManagerSource = fs.readFileSync(path.join(process.cwd(), 'src/components/TPManager.tsx'), 'utf-8');
assert(tpManagerSource.includes('Perubahan belum disimpan'), 'TPManager source has unsaved state label');
assert(tpManagerSource.includes('Tersimpan • SIAP'), 'TPManager source has saved ready state label');
assert(tpManagerSource.includes('Tersimpan • Perlu diperbaiki'), 'TPManager source has saved incomplete state label');
assert(tpManagerSource.includes('TP_CONTINUE_BLOCKED'), 'TPManager records blocked continuation');
assert(tpManagerSource.includes('saveState !== \'SAVED_READY\''), 'TPManager blocks onNextStep unless saved ready');
assert(tpManagerSource.includes('TP_GENERATE_SUCCESS'), 'TPManager records AI success and save feedback');

const diagnosticSource = fs.readFileSync(path.join(process.cwd(), 'src/services/diagnosticService.ts'), 'utf-8');
const report = buildTPDiagnosticReport({
  module: 'TP',
  workspaceId: 'ws-t1',
  academicSetting,
  context,
  tp: validTP(),
  uiItemsCount: 2,
  validation: aiReadyResult,
});
['nip', 'nuptk', 'principalNip', 'studentName', 'apiKey', 'process.env', 'environment'].forEach((forbidden) => {
  assert(!diagnosticSource.includes(forbidden), `Diagnostic source does not include forbidden field: ${forbidden}`);
  assert(!report.includes(forbidden), `Diagnostic report does not include forbidden field: ${forbidden}`);
});
assert(report.includes('phaseRaw: Fase A') && report.includes('phaseNormalized: A'), 'Diagnostic report exposes raw and normalized phase');
assert(report.includes('uiItemsCount: 2') && report.includes('storedItemsCount: 2'), 'Diagnostic report exposes UI/stored TP item counts');

console.log(`\nTEST RESULTS: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log('ALL RECOVERY T1 TP RUNTIME REGRESSION TESTS PASSED!');
