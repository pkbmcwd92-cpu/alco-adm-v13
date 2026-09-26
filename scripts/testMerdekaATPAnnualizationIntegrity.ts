import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  resolveATPItemTPReference,
  validateATPReferences,
  validateATPDataWorkflow,
  normalizeATPReferences,
} from '../src/services/cpWorkflowService';
import { ATPData, ATPItem, TPData, TPItem, AcademicSetting } from '../src/types';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(error);
    process.exit(1);
  }
}

console.log('--- RUNNING MERDEKA ATP ANNUALIZATION INTEGRITY REGRESSION ---\n');

const atpManagerPath = path.resolve(process.cwd(), 'src/components/ATPManager.tsx');
const atpManagerSource = fs.readFileSync(atpManagerPath, 'utf-8');

const serverPath = path.resolve(process.cwd(), 'server.ts');
const serverSource = fs.readFileSync(serverPath, 'utf-8');

const workflowServicePath = path.resolve(process.cwd(), 'src/services/cpWorkflowService.ts');
const workflowServiceSource = fs.readFileSync(workflowServicePath, 'utf-8');

const typesPath = path.resolve(process.cwd(), 'src/types/index.ts');
const typesSource = fs.readFileSync(typesPath, 'utf-8');

const appPath = path.resolve(process.cwd(), 'src/App.tsx');
const appSource = fs.readFileSync(appPath, 'utf-8');

// 1. Annual ATP generation source does not require context.semester
runTest('1. Annual ATP generation source does not require context.semester', () => {
  assert.ok(
    !atpManagerSource.includes('generateATPWithAI({\n        tps: tp.items,\n        cpGeneral: cp.generalDescription,\n        subject: context.subject,\n        grade: context.grade,\n        phase: context.phase,\n        semester: context.semester,'),
    'generateATPWithAI must not be called with semester: context.semester'
  );
});

// 2. ATPManager AI request does not send semester
runTest('2. ATPManager AI request does not send semester or totalHoursPerWeek', () => {
  // Check the generateATPWithAI call block in ATPManager
  const genCallMatch = atpManagerSource.match(/const generated = await generateATPWithAI\(\{([\s\S]*?)\}\);/);
  assert.ok(genCallMatch, 'generateATPWithAI call must exist in ATPManager');
  const genCallBody = genCallMatch[1];
  assert.ok(!genCallBody.includes('semester'), 'generateATPWithAI payload must not include semester');
  assert.ok(!genCallBody.includes('totalHoursPerWeek'), 'generateATPWithAI payload must not include totalHoursPerWeek');
});

// 3. Manual new ATP item does not populate semester
runTest('3. Manual new ATP item does not populate semester in handleOpenAdd', () => {
  const handleAddMatch = atpManagerSource.match(/const handleOpenAdd = \(\) => \{([\s\S]*?)\};/);
  assert.ok(handleAddMatch, 'handleOpenAdd must exist in ATPManager');
  const handleAddBody = handleAddMatch[1];
  assert.ok(!handleAddBody.includes('semester:'), 'handleOpenAdd must not assign semester');
});

// 4. Generated ATP item does not populate semester
runTest('4. Generated ATP item candidateItem does not assign semester', () => {
  const candidateItemMatch = atpManagerSource.match(/const candidateItem: ATPItem = \{([\s\S]*?)\};/);
  assert.ok(candidateItemMatch, 'candidateItem must exist in handleGenerateAI');
  const candidateBody = candidateItemMatch[1];
  assert.ok(!candidateBody.includes('semester:'), 'candidateItem must not assign semester');
});

// 5. ATP edit UI has no Semester selector for Merdeka annual flow
runTest('5. ATP edit modal has no Semester selector for Merdeka annual flow', () => {
  assert.ok(
    !atpManagerSource.includes('<label className="block text-xs font-bold text-slate-700 uppercase mb-1">\n                    Semester'),
    'Edit modal must not render a Semester label or selector'
  );
  assert.ok(
    !atpManagerSource.includes('<option value={1}>Semester 1</option>'),
    'Edit modal must not include Semester 1 option'
  );
});

// 6. ATP table does not display Sem 1 / Sem 2
runTest('6. ATP table does not display Sem 1 / Sem 2 or "Sem / JP" column', () => {
  assert.ok(!atpManagerSource.includes('Sem / JP'), 'Table header must not say "Sem / JP"');
  assert.ok(atpManagerSource.includes('Alokasi JP'), 'Table header must say "Alokasi JP"');
  assert.ok(!atpManagerSource.includes('`Sem ${item.semester}`'), 'Table rows must not render `Sem ${item.semester}`');
});

// 7. Page copy does not describe ATP as semester-scoped
runTest('7. Page copy describes ATP as annual context without semester', () => {
  assert.ok(
    !atpManagerSource.includes('Semester {context.semester}'),
    'Step description must not mention "Semester {context.semester}"'
  );
  assert.ok(
    atpManagerSource.includes('Tahun Ajaran {context.academicYear || \'-\'}'),
    'Step description must reference annual "Tahun Ajaran"'
  );
});

// 8. Total label is annual-neutral, not "Total Alokasi Waktu Semester"
runTest('8. Total label is annual-neutral ("Total Alokasi Waktu:")', () => {
  assert.ok(!atpManagerSource.includes('Total Alokasi Waktu Semester:'), 'Footer must not say "Total Alokasi Waktu Semester:"');
  assert.ok(atpManagerSource.includes('Total Alokasi Waktu:'), 'Footer must say "Total Alokasi Waktu:"');
});

// 9. Server /api/ai/generate-atp accepts valid Merdeka annual request without semester
runTest('9. Server /api/ai/generate-atp accepts valid Merdeka annual request without semester', () => {
  // Check that `if (!semester` in server.ts is guarded by isK13
  assert.ok(
    serverSource.includes('if (isK13) {\n    if (!semester || typeof semester !== \'string\' || semester.trim() === \'\') {\n      return res.status(400).json({ error: \'Semester harus diisi sebelum menyusun ATP.\' });\n    }\n  }'),
    'server.ts must only require semester when isK13 is true'
  );
});

// 10. Server Merdeka prompt does not require semester placement
runTest('10. Server Merdeka prompt uses annual context without semester', () => {
  assert.ok(
    serverSource.includes('${isK13 ? `- Tahun Ajaran / Semester: ${academicYear || \'-\'} / ${semester || \'-\'}` : `- Tahun Ajaran: ${academicYear || \'-\'}`}'),
    'server.ts prompt must format annual context for Kurikulum Merdeka'
  );
  assert.ok(
    !serverSource.includes('place items into Semester 1 or Semester 2'),
    'server.ts prompt must not ask for semester placement'
  );
});

// 11. Server does not fabricate JP when weekly JP is unresolved
runTest('11. Server removes synthetic JP when weekly JP is unresolved', () => {
  assert.ok(
    serverSource.includes('if (validatedWeeklyJP === undefined) {\n        // Enforce unresolved JP: do not leak synthetic or guessed numbers\n        delete item.jp;\n        delete item.allocatedJP;\n      }'),
    'server.ts must delete item.jp and item.allocatedJP when validatedWeeklyJP is undefined'
  );
});

// 12. pedagogicalATPFingerprint does not include ATPItem.semester
runTest('12. pedagogicalATPFingerprint does not include ATPItem.semester', () => {
  const atpFingerprintMatch = workflowServiceSource.match(/function pedagogicalATPFingerprint\([\s\S]*?return stableStringify\(\{([\s\S]*?)\}\);\n\}/);
  assert.ok(atpFingerprintMatch, 'pedagogicalATPFingerprint must exist');
  const atpFingerprintBody = atpFingerprintMatch[1];
  assert.ok(!atpFingerprintBody.includes('semester:'), 'pedagogicalATPFingerprint must not include semester');
});

// 13. Existing strict TP reference behavior remains intact
runTest('13. Strict TP reference resolution and validation contracts remain intact', () => {
  const tps: TPItem[] = [
    { id: 'tp-1', code: 'TP 1.1', statement: 'Memahami teks deskripsi', competence: 'Memahami', contentScope: 'Teks deskripsi', order: 1 },
    { id: 'tp-2', code: 'TP 1.2', statement: 'Menulis teks deskripsi', competence: 'Menulis', contentScope: 'Teks deskripsi', order: 2 },
  ];

  // 13.1 Exact ID
  const exactRes = resolveATPItemTPReference({ id: 'atp-1', stepNumber: 1, tpId: 'tp-1', tpCode: '', tpStatement: '', p3Dimensions: [] }, tps);
  assert.strictEqual(exactRes.status, 'RESOLVED_REFERENCE');

  // 13.2 Ambiguous TP
  const dupTPs: TPItem[] = [
    { id: 'tp-1a', code: 'TP 1.1', statement: 'Memahami teks deskripsi A', competence: 'Memahami', contentScope: 'Teks deskripsi A', order: 1 },
    { id: 'tp-1b', code: 'TP 1.1', statement: 'Memahami teks deskripsi B', competence: 'Memahami', contentScope: 'Teks deskripsi B', order: 2 },
  ];
  const ambRes = resolveATPItemTPReference({ id: 'atp-1', stepNumber: 1, tpId: '', tpCode: 'TP 1.1', tpStatement: '', p3Dimensions: [] }, dupTPs);
  assert.strictEqual(ambRes.status, 'AMBIGUOUS_REFERENCE');

  // 13.3 Dangling TP
  const dangRes = resolveATPItemTPReference({ id: 'atp-1', stepNumber: 1, tpId: 'tp-deleted', tpCode: 'TP 9', tpStatement: 'Non-existent', p3Dimensions: [] }, tps);
  assert.strictEqual(dangRes.status, 'DANGLING_REFERENCE');

  // 13.4 Duplicate reference check
  const mockTPData: TPData = {
    id: 'tp-data-1',
    academicSettingId: 'acad-1',
    cpId: 'cp-1',
    academicYear: '2026/2027',
    subjectCode: 'BINDO',
    phase: 'A',
    items: tps,
    workflowStatus: 'SIAP',
    generatedBy: 'TEACHER',
    needsReview: false,
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const dupAtp: ATPData = {
    id: 'atp-dup',
    academicSettingId: 'acad-1',
    tpDataId: 'tp-data-1',
    tpId: 'tp-data-1',
    academicYear: '2026/2027',
    subjectCode: 'BINDO',
    phase: 'A',
    items: [
      { id: 'atp-1', stepNumber: 1, tpId: 'tp-1', tpCode: 'TP 1.1', tpStatement: 'Memahami teks deskripsi', p3Dimensions: [] },
      { id: 'atp-2', stepNumber: 2, tpId: 'tp-1', tpCode: 'TP 1.1', tpStatement: 'Memahami teks deskripsi', p3Dimensions: [] },
    ],
    totalJP: 0,
    knownTotalJP: 0,
    hasUnknownJP: true,
    allocationComplete: false,
    workflowStatus: 'SIAP',
    basedOnTpUpdatedAt: '2026-01-01T00:00:00Z',
    needsReview: false,
    updatedAt: '2026-01-01T00:00:00Z',
  };
  const dupVal = validateATPReferences(dupAtp, mockTPData);
  assert.strictEqual(dupVal.isSiap, false, 'Duplicate TP reference in ATP must fail validation');
  assert.ok(dupVal.issues.some((i) => i.includes('DUPLICATE_TP_REFERENCE')));
});

// 14. ATP may remain valid structurally with JP unresolved
runTest('14. ATP can be valid and confirmed as SIAP even when JP is unresolved', () => {
  const tps: TPItem[] = [
    { id: 'tp-1', code: 'TP 1.1', statement: 'Memahami teks deskripsi', competence: 'Memahami', contentScope: 'Teks deskripsi', order: 1 },
    { id: 'tp-2', code: 'TP 1.2', statement: 'Menulis teks deskripsi', competence: 'Menulis', contentScope: 'Teks deskripsi', order: 2 },
  ];

  const mockTPData: TPData = {
    id: 'tp-data-1',
    academicSettingId: 'acad-1',
    cpId: 'cp-1',
    academicYear: '2026/2027',
    subjectCode: 'BINDO',
    phase: 'A',
    items: tps,
    workflowStatus: 'SIAP',
    generatedBy: 'TEACHER',
    needsReview: false,
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const validUnresolvedJPAtp: ATPData = {
    id: 'atp-valid-no-jp',
    academicSettingId: 'acad-1',
    tpDataId: 'tp-data-1',
    tpId: 'tp-data-1',
    academicYear: '2026/2027',
    subjectCode: 'BINDO',
    phase: 'A',
    rationale: 'Rasional urutan pembelajaran',
    items: [
      { id: 'atp-1', stepNumber: 1, tpId: 'tp-1', tpCode: 'TP 1.1', tpStatement: 'Memahami teks deskripsi', jp: undefined, p3Dimensions: [] },
      { id: 'atp-2', stepNumber: 2, tpId: 'tp-2', tpCode: 'TP 1.2', tpStatement: 'Menulis teks deskripsi', jp: undefined, p3Dimensions: [] },
    ],
    totalJP: 0,
    knownTotalJP: 0,
    hasUnknownJP: true,
    allocationComplete: false,
    workflowStatus: 'SIAP',
    basedOnTpUpdatedAt: '2026-01-01T00:00:00Z',
    needsReview: false,
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const valRes = validateATPReferences(validUnresolvedJPAtp, mockTPData);
  assert.strictEqual(valRes.isSiap, true, 'ATP with valid TP references and sequence must pass validation even if JP is undefined');
  assert.strictEqual(valRes.issues.length, 0);
});

// 15. ATPItem.semester remains only as deprecated compatibility field in type definition
runTest('15. ATPItem.semester remains as optional compatibility field in types', () => {
  assert.ok(
    typesSource.includes('semester?: 1 | 2 | null;'),
    'ATPItem in types/index.ts must retain optional semester field for compatibility'
  );
});

// 16. App.tsx still has ATP persistence deferred
runTest('16. App.tsx keeps handleSaveATP persistence cutover deferred', () => {
  assert.ok(
    appSource.includes('const handleSaveATP = (atp: ATPData) => {\n    // ATP persistence cutover is deferred\n  };'),
    'App.tsx handleSaveATP must remain deferred'
  );
});

console.log('\nAll 16 Merdeka ATP Annualization Integrity contract tests PASSED successfully!\n');
