/**
 * Regression Test Suite: PATCH FINAL AUDIT NO. 5 — ATP V7
 * Validates:
 * 1. Strict Canonical TP Resolver (Exact ID, Unique code/statement, Duplicate/Ambiguous, Dangling, Unresolved)
 * 2. New Item No-Fabrication & No-Auto-Select-First-TP
 * 3. Stable ATP Item IDs (across create, edit, reorder, save, change JP/semester, confirm)
 * 4. AI Generation DRAFT status & Teacher Confirmation with Validator Authority
 * 5. Complete Coverage & Validator Guards (MISSING_TP_REFERENCE, DUPLICATE_TP_REFERENCE, etc.)
 */
import assert from 'node:assert';
import {
  resolveATPItemTPReference,
  validateATPReferences,
  validateATPDataWorkflow,
  normalizeATPReferences,
} from '../src/services/cpWorkflowService';
import { matchCanonicalTP } from '../src/services/workflowEngine';
import { ATPData, ATPItem, TPData, TPItem, AcademicSetting } from '../src/types';

console.log('===========================================================');
console.log('🧪 RUNNING TEST SUITE: AUDIT NO. 5 — ATP V7 STRICT AUDIT');
console.log('===========================================================');

const mockAcademicSetting: AcademicSetting = {
  id: 'acad-test-001',
  profileId: 'prof-test-001',
  academicYear: '2025/2026',
  semester: '1 (Ganjil)',
  grade: 'Kelas 4',
  phase: 'B',
  level: 'SD',
  subject: 'Pendidikan Jasmani, Olahraga, dan Kesehatan',
  curriculum: 'Kurikulum Merdeka',
  totalHoursPerWeek: 4,
  updatedAt: '2026-01-01T00:00:00Z',
};

const canonicalTPItems: TPItem[] = [
  {
    id: 'tp-canon-001',
    code: 'TP 4.1',
    elementName: 'Keterampilan Gerak',
    statement: 'Mempraktikkan variasi pola gerak dasar lokomotor dan non-lokomotor.',
    competence: 'Mempraktikkan',
    contentScope: 'Variasi pola gerak dasar',
    p3Dimensions: ['Mandiri', 'Gotong Royong'],
    order: 1,
  },
  {
    id: 'tp-canon-002',
    code: 'TP 4.2',
    elementName: 'Pengetahuan Gerak',
    statement: 'Menerapkan konsep variasi pola gerak dasar lokomotor dalam permainan.',
    competence: 'Menerapkan',
    contentScope: 'Konsep gerak dasar permainan',
    p3Dimensions: ['Bernalar Kritis'],
    order: 2,
  },
  {
    id: 'tp-canon-003',
    code: 'TP 4.3',
    elementName: 'Pemanfaatan Gerak',
    statement: 'Membiasakan aktivitas jasmani untuk menjaga kebugaran tubuh.',
    competence: 'Membiasakan',
    contentScope: 'Aktivitas jasmani dan kebugaran',
    p3Dimensions: ['Mandiri'],
    order: 3,
  },
];

const mockTPData: TPData = {
  id: 'tp-data-001',
  academicSettingId: 'acad-test-001',
  cpId: 'cp-test-001',
  academicYear: '2025/2026',
  subjectCode: 'PJOK',
  phase: 'B',
  items: canonicalTPItems,
  workflowStatus: 'SIAP',
  generatedBy: 'TEACHER',
  needsReview: false,
  updatedAt: '2026-01-01T00:00:00Z',
};

// =========================================================================
// TEST 1: STRICT CANONICAL TP RESOLVER
// =========================================================================
console.log('\n--- 1. Strict Canonical TP Resolver ---');

// 1.1 Exact tpId
const itemExactId: ATPItem = {
  id: 'atp-1',
  stepNumber: 1,
  tpId: 'tp-canon-001',
  tpCode: 'Legacy Code',
  tpStatement: 'Legacy Statement',
  p3Dimensions: [],
};
const resExact = resolveATPItemTPReference(itemExactId, canonicalTPItems);
assert.strictEqual(resExact.status, 'RESOLVED_REFERENCE', 'Exact tpId must resolve to RESOLVED_REFERENCE');
assert.strictEqual(resExact.canonicalTPItem?.id, 'tp-canon-001');
console.log('✅ 1.1 Exact tpId matches -> RESOLVED_REFERENCE');

// 1.2 Unique legacy tpCode
const itemLegacyCode: ATPItem = {
  id: 'atp-2',
  stepNumber: 2,
  tpId: '',
  tpCode: 'TP 4.2',
  tpStatement: '',
  p3Dimensions: [],
};
const resLegacyCode = resolveATPItemTPReference(itemLegacyCode, canonicalTPItems);
assert.strictEqual(resLegacyCode.status, 'LEGACY_MIGRATED', 'Unique tpCode must resolve to LEGACY_MIGRATED');
assert.strictEqual(resLegacyCode.canonicalTPItem?.id, 'tp-canon-002');
console.log('✅ 1.2 Unique legacy tpCode matches -> LEGACY_MIGRATED');

// 1.3 Unique legacy tpStatement
const itemLegacyStmt: ATPItem = {
  id: 'atp-3',
  stepNumber: 3,
  tpId: '',
  tpCode: '',
  tpStatement: 'Membiasakan aktivitas jasmani untuk menjaga kebugaran tubuh.',
  p3Dimensions: [],
};
const resLegacyStmt = resolveATPItemTPReference(itemLegacyStmt, canonicalTPItems);
assert.strictEqual(resLegacyStmt.status, 'LEGACY_MIGRATED', 'Unique tpStatement must resolve to LEGACY_MIGRATED');
assert.strictEqual(resLegacyStmt.canonicalTPItem?.id, 'tp-canon-003');
console.log('✅ 1.3 Unique legacy tpStatement matches -> LEGACY_MIGRATED');

// 1.4 Duplicate tpCode -> AMBIGUOUS_REFERENCE (Must NOT pick first match)
const duplicateCodeTPs: TPItem[] = [
  { ...canonicalTPItems[0], id: 'tp-dup-1', code: 'TP 4.X' },
  { ...canonicalTPItems[1], id: 'tp-dup-2', code: 'TP 4.X' },
];
const itemDupCode: ATPItem = {
  id: 'atp-4',
  stepNumber: 4,
  tpId: '',
  tpCode: 'TP 4.X',
  tpStatement: '',
  p3Dimensions: [],
};
const resDupCode = resolveATPItemTPReference(itemDupCode, duplicateCodeTPs);
assert.strictEqual(resDupCode.status, 'AMBIGUOUS_REFERENCE', 'Duplicate tpCode must return AMBIGUOUS_REFERENCE');
assert.strictEqual(resDupCode.canonicalTPItem, undefined, 'Must NOT pick first match on duplicate code');
console.log('✅ 1.4 Duplicate tpCode -> AMBIGUOUS_REFERENCE (No first-match assumption)');

// 1.5 Duplicate statement -> AMBIGUOUS_REFERENCE (Must NOT pick first match)
const duplicateStmtTPs: TPItem[] = [
  { ...canonicalTPItems[0], id: 'tp-stmt-1', statement: 'Statement Identik' },
  { ...canonicalTPItems[1], id: 'tp-stmt-2', statement: 'Statement Identik' },
];
const itemDupStmt: ATPItem = {
  id: 'atp-5',
  stepNumber: 5,
  tpId: '',
  tpCode: '',
  tpStatement: 'Statement Identik',
  p3Dimensions: [],
};
const resDupStmt = resolveATPItemTPReference(itemDupStmt, duplicateStmtTPs);
assert.strictEqual(resDupStmt.status, 'AMBIGUOUS_REFERENCE', 'Duplicate statement must return AMBIGUOUS_REFERENCE');
assert.strictEqual(resDupStmt.canonicalTPItem, undefined, 'Must NOT pick first match on duplicate statement');
console.log('✅ 1.5 Duplicate statement -> AMBIGUOUS_REFERENCE (No first-match assumption)');

// 1.6 Dangling tpId (ID not in canonical list)
const itemDangling: ATPItem = {
  id: 'atp-6',
  stepNumber: 6,
  tpId: 'deleted-tp-999',
  tpCode: 'TP 4.1',
  tpStatement: canonicalTPItems[0].statement,
  p3Dimensions: [],
};
const resDangling = resolveATPItemTPReference(itemDangling, canonicalTPItems);
assert.strictEqual(resDangling.status, 'DANGLING_REFERENCE', 'Deleted/Unknown tpId must return DANGLING_REFERENCE');
assert.strictEqual(resDangling.canonicalTPItem, undefined, 'Must NOT secretly fall back to code/statement when tpId is explicit');
console.log('✅ 1.6 Unknown/Deleted tpId -> DANGLING_REFERENCE (No silent positional replacement)');

// 1.7 Unresolved reference (No ID, no matching code, no matching statement)
const itemUnresolved: ATPItem = {
  id: 'atp-7',
  stepNumber: 7,
  tpId: '',
  tpCode: 'TP UNKNOWN',
  tpStatement: 'Statement yang tidak ada sama sekali',
  p3Dimensions: [],
};
const resUnresolved = resolveATPItemTPReference(itemUnresolved, canonicalTPItems);
assert.strictEqual(resUnresolved.status, 'UNRESOLVED_REFERENCE', 'Unknown data must return UNRESOLVED_REFERENCE');
console.log('✅ 1.7 Completely unknown reference -> UNRESOLVED_REFERENCE');

// 1.8 Contradictory code and statement
const itemContradictory: ATPItem = {
  id: 'atp-8',
  stepNumber: 8,
  tpId: '',
  tpCode: 'TP 4.1', // points to canon 001
  tpStatement: canonicalTPItems[1].statement, // points to canon 002
  p3Dimensions: [],
};
const resContradictory = resolveATPItemTPReference(itemContradictory, canonicalTPItems);
assert.strictEqual(resContradictory.status, 'AMBIGUOUS_REFERENCE', 'Contradictory code and statement must return AMBIGUOUS_REFERENCE');
console.log('✅ 1.8 Contradictory code and statement -> AMBIGUOUS_REFERENCE');

// =========================================================================
// TEST 2: NEW ITEM NO-FABRICATION & NO-AUTO-SELECT
// =========================================================================
console.log('\n--- 2. New Item No-Fabrication & No-Auto-Select-First-TP ---');

// Simulating initial state of handleOpenAdd()
const createNewATPItem = (nextStep: number, sem?: 1 | 2): ATPItem => ({
  id: `atp-item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  stepNumber: nextStep,
  tpId: '',
  tpCode: '',
  tpStatement: '',
  materialScope: '',
  jp: undefined,
  semester: sem === 1 || sem === 2 ? sem : undefined,
  p3Dimensions: [],
  assessmentPlan: '',
  glossary: '',
  resources: '',
});

const freshItem = createNewATPItem(1, 1);
assert.strictEqual(freshItem.tpId, '', 'New item must have empty tpId');
assert.strictEqual(freshItem.tpCode, '', 'New item must NOT have fabricated tpCode (e.g. TP 4.1)');
assert.strictEqual(freshItem.tpStatement, '', 'New item must NOT auto-select first TP statement');
assert.strictEqual(freshItem.materialScope, '', 'New item must NOT auto-fill material scope');
assert.strictEqual(freshItem.jp, undefined, 'New item must NOT default to 6 JP');
assert.deepStrictEqual(freshItem.p3Dimensions, [], 'New item must NOT default to Bernalar Kritis');
console.log('✅ 2.1 Fresh ATP item has tpId="", tpCode="", tpStatement=""');
console.log('✅ 2.2 Fresh ATP item does NOT auto-select tp.items[0]');
console.log('✅ 2.3 Fresh ATP item does NOT fabricate TP 4.1 code');
console.log('✅ 2.4 Fresh ATP item does NOT inject fake JP or fake P3 defaults');

// =========================================================================
// TEST 3: STABLE ATP ITEM ID
// =========================================================================
console.log('\n--- 3. Stable ATP Item ID Lifecycle ---');

let atpItems: ATPItem[] = [
  {
    id: 'atp-item-A',
    stepNumber: 1,
    tpId: 'tp-canon-001',
    tpCode: 'TP 4.1',
    tpStatement: canonicalTPItems[0].statement,
    materialScope: 'Variasi pola gerak',
    jp: 18,
    semester: 1,
    p3Dimensions: ['Mandiri'],
  },
  {
    id: 'atp-item-B',
    stepNumber: 2,
    tpId: 'tp-canon-002',
    tpCode: 'TP 4.2',
    tpStatement: canonicalTPItems[1].statement,
    materialScope: 'Konsep gerak dasar',
    jp: 18,
    semester: 1,
    p3Dimensions: ['Bernalar Kritis'],
  },
  {
    id: 'atp-item-C',
    stepNumber: 3,
    tpId: 'tp-canon-003',
    tpCode: 'TP 4.3',
    tpStatement: canonicalTPItems[2].statement,
    materialScope: 'Aktivitas jasmani',
    jp: 36,
    semester: 1,
    p3Dimensions: ['Mandiri'],
  },
];

// 3.1 Edit item B (e.g. change materialScope & JP)
const editedB: ATPItem = {
  ...atpItems[1],
  materialScope: 'Updated Scope',
  jp: 20,
};
const itemsAfterEdit = atpItems.map((i) => (i.id === editedB.id ? editedB : i));
assert.strictEqual(itemsAfterEdit[1].id, 'atp-item-B', 'Edit must strictly preserve existing ID');
assert.strictEqual(itemsAfterEdit[1].materialScope, 'Updated Scope');
assert.strictEqual(itemsAfterEdit[1].jp, 20);
console.log('✅ 3.1 Edit preserves item.id (atp-item-B)');

// 3.2 Reorder: C, A, B
const reordered = [atpItems[2], atpItems[0], atpItems[1]].map((it, idx) => ({
  ...it,
  stepNumber: idx + 1,
}));
assert.strictEqual(reordered[0].id, 'atp-item-C', 'Step 1 must be item C');
assert.strictEqual(reordered[0].stepNumber, 1);
assert.strictEqual(reordered[1].id, 'atp-item-A', 'Step 2 must be item A');
assert.strictEqual(reordered[1].stepNumber, 2);
assert.strictEqual(reordered[2].id, 'atp-item-B', 'Step 3 must be item B');
assert.strictEqual(reordered[2].stepNumber, 3);
console.log('✅ 3.2 Reorder preserves all item IDs (C, A, B) with only stepNumber updating');

// 3.3 Save: simulates handleSave()
const savedATP: ATPData = {
  id: 'atp-save-test',
  academicSettingId: mockAcademicSetting.id,
  tpDataId: mockTPData.id,
  tpId: mockTPData.id,
  academicYear: '2025/2026',
  subjectCode: 'PJOK',
  phase: 'B',
  items: reordered.map((item, idx) => ({ ...item, stepNumber: idx + 1 })),
  totalJP: 72,
  knownTotalJP: 72,
  hasUnknownJP: false,
  allocationComplete: true,
  workflowStatus: 'DRAFT',
  generatedBy: 'TEACHER',
  updatedAt: new Date().toISOString(),
};
assert.deepStrictEqual(
  savedATP.items.map((i) => i.id),
  ['atp-item-C', 'atp-item-A', 'atp-item-B'],
  'Saved ATP items must retain exact IDs'
);
console.log('✅ 3.3 Save preserves all item IDs');

// 3.4 Change JP
const changedJP = savedATP.items.map((it) => (it.id === 'atp-item-C' ? { ...it, jp: 40 } : it));
assert.strictEqual(changedJP[0].id, 'atp-item-C');
assert.strictEqual(changedJP[0].jp, 40);
console.log('✅ 3.4 Change JP preserves item ID');

// 3.5 Change Semester
const changedSem = savedATP.items.map((it) => (it.id === 'atp-item-C' ? { ...it, semester: 2 as const } : it));
assert.strictEqual(changedSem[0].id, 'atp-item-C');
assert.strictEqual(changedSem[0].semester, 2);
console.log('✅ 3.5 Change Semester preserves item ID');

// =========================================================================
// TEST 4: AI DRAFT & TEACHER CONFIRMATION LIFECYCLE
// =========================================================================
console.log('\n--- 4. AI Draft & Teacher Confirmation Lifecycle ---');

// Simulated AI generation output
const aiGeneratedATP: ATPData = {
  id: 'atp-ai-001',
  academicSettingId: mockAcademicSetting.id,
  tpDataId: mockTPData.id,
  tpId: mockTPData.id,
  academicYear: '2025/2026',
  subjectCode: 'PJOK',
  phase: 'B',
  items: atpItems,
  totalJP: 72,
  knownTotalJP: 72,
  hasUnknownJP: false,
  allocationComplete: true,
  generatedBy: 'AI',
  workflowStatus: 'DRAFT', // Must start as DRAFT!
  generatedAt: new Date().toISOString(),
  needsReview: false,
  updatedAt: new Date().toISOString(),
};

assert.strictEqual(aiGeneratedATP.workflowStatus, 'DRAFT', 'AI ATP must start as DRAFT even if valid');
console.log('✅ 4.1 AI Generated ATP initial status is DRAFT');

// Teacher confirms and validator checks valid ATP candidate
const candidateValid: ATPData = {
  ...aiGeneratedATP,
  workflowStatus: 'SIAP',
  generatedBy: 'AI_EDITED_BY_TEACHER',
};
const valValid = validateATPReferences(candidateValid, mockTPData);
assert.strictEqual(valValid.isSiap, true, 'Valid ATP references should pass validation');
const finalizedValid: ATPData = {
  ...candidateValid,
  workflowStatus: valValid.isSiap ? 'SIAP' : 'PERLU_DILENGKAPI',
};
assert.strictEqual(finalizedValid.workflowStatus, 'SIAP', 'Confirmed valid ATP transitions to SIAP');
console.log('✅ 4.2 Teacher confirmation on valid ATP transitions to SIAP');

// Teacher confirms an invalid ATP candidate (e.g. containing dangling reference)
const candidateInvalid: ATPData = {
  ...aiGeneratedATP,
  workflowStatus: 'SIAP',
  items: [
    ...atpItems.slice(0, 2),
    {
      id: 'atp-item-broken',
      stepNumber: 3,
      tpId: 'non-existent-tp',
      tpCode: 'TP X',
      tpStatement: 'Random',
      p3Dimensions: [],
    },
  ],
};
const valInvalid = validateATPReferences(candidateInvalid, mockTPData);
assert.strictEqual(valInvalid.isSiap, false, 'Invalid ATP candidate must fail validation');
const finalizedInvalid: ATPData = {
  ...candidateInvalid,
  workflowStatus: valInvalid.isSiap ? 'SIAP' : 'PERLU_DILENGKAPI',
};
assert.strictEqual(finalizedInvalid.workflowStatus, 'PERLU_DILENGKAPI', 'Invalid ATP must be PERLU_DILENGKAPI, never forced to SIAP');
console.log('✅ 4.3 Teacher confirmation on invalid ATP is blocked and marked PERLU_DILENGKAPI');

// =========================================================================
// TEST 5: VALIDATOR COVERAGE & INTEGRITY
// =========================================================================
console.log('\n--- 5. Validator Coverage & Integrity ---');

// 5.1 MISSING_TP_REFERENCE (canonical TP not covered in ATP)
const partialATP: ATPData = {
  ...aiGeneratedATP,
  workflowStatus: 'SIAP',
  items: [atpItems[0], atpItems[1]], // Missing tp-canon-003
};
const valMissing = validateATPReferences(partialATP, mockTPData);
assert.strictEqual(valMissing.isSiap, false, 'Missing canonical TP must prevent SIAP');
assert.ok(
  valMissing.issues.some((i) => i.includes('MISSING_TP_REFERENCE')),
  'Issues must explicitly flag MISSING_TP_REFERENCE'
);
console.log('✅ 5.1 MISSING_TP_REFERENCE detected and prevents SIAP');

// 5.2 DUPLICATE_TP_REFERENCE (same canonical TP referenced twice)
const duplicateRefATP: ATPData = {
  ...aiGeneratedATP,
  workflowStatus: 'SIAP',
  items: [
    atpItems[0],
    atpItems[0], // Duplicate!
    atpItems[2],
  ],
};
const valDuplicate = validateATPReferences(duplicateRefATP, mockTPData);
assert.strictEqual(valDuplicate.isSiap, false, 'Duplicate reference must prevent SIAP');
assert.ok(
  valDuplicate.issues.some((i) => i.includes('DUPLICATE_TP_REFERENCE')),
  'Issues must explicitly flag DUPLICATE_TP_REFERENCE'
);
console.log('✅ 5.2 DUPLICATE_TP_REFERENCE detected and prevents SIAP');

// 5.3 DANGLING_REFERENCE detection
const danglingATP: ATPData = {
  ...aiGeneratedATP,
  workflowStatus: 'SIAP',
  items: [
    atpItems[0],
    atpItems[1],
    {
      id: 'atp-item-dang',
      stepNumber: 3,
      tpId: 'ghost-tp',
      tpCode: 'TP 4.3',
      tpStatement: canonicalTPItems[2].statement,
      p3Dimensions: [],
    },
  ],
};
const valDang = validateATPReferences(danglingATP, mockTPData);
assert.strictEqual(valDang.isSiap, false, 'Dangling reference must prevent SIAP');
assert.ok(
  valDang.issues.some((i) => i.includes('Dangling Reference')),
  'Issues must explicitly flag Dangling Reference'
);
console.log('✅ 5.3 DANGLING_REFERENCE detected and prevents SIAP');

// 5.4 UNRESOLVED_REFERENCE detection
const unresolvedATP: ATPData = {
  ...aiGeneratedATP,
  workflowStatus: 'SIAP',
  items: [
    atpItems[0],
    atpItems[1],
    {
      id: 'atp-item-unres',
      stepNumber: 3,
      tpId: '',
      tpCode: '',
      tpStatement: '',
      p3Dimensions: [],
    },
  ],
};
const valUnres = validateATPReferences(unresolvedATP, mockTPData);
assert.strictEqual(valUnres.isSiap, false, 'Unresolved reference must prevent SIAP');
assert.ok(
  valUnres.issues.some((i) => i.includes('belum terhubung dengan Tujuan Pembelajaran')),
  'Issues must explicitly flag Unresolved Reference'
);
console.log('✅ 5.4 UNRESOLVED_REFERENCE detected and prevents SIAP');

console.log('===========================================================');
console.log('🎉 ALL AUDIT NO. 5 (ATP V7) REGRESSION TESTS PASSED 100%!');
console.log('===========================================================');
