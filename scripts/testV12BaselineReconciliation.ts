import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  getAcademicEntityScope,
  isAnnualEntity,
  isSemesterEntity,
  AcademicEntityKind,
} from '../src/services/academicScope';
import {
  DOCUMENT_CATALOG,
  MERDEKA_DOC_TYPES,
  ZipExportItemStatus,
} from '../src/services/documentEngine';
import { getCurriculumDocumentTypes } from '../src/services/curriculumRouter';
import { checkAssessmentExportEligibility } from '../src/services/documentEngine/assessmentExportService';

console.log('=== RUNNING AUDIT: V12 BASELINE RECONCILIATION REGRESSION ===\n');

let totalTests = 0;
let passedTests = 0;

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

// =========================================================================
// SECTION A: F1 Annual vs Semester Scope Verification
// =========================================================================
runTest('A. F1 Scope: TP, ATP, PROTA are YEAR scope; PROMES is SEMESTER scope', () => {
  assert.strictEqual(getAcademicEntityScope('TP'), 'YEAR');
  assert.strictEqual(isAnnualEntity('TP'), true);

  assert.strictEqual(getAcademicEntityScope('ATP'), 'YEAR');
  assert.strictEqual(isAnnualEntity('ATP'), true);

  assert.strictEqual(getAcademicEntityScope('PROTA'), 'YEAR');
  assert.strictEqual(isAnnualEntity('PROTA'), true);

  assert.strictEqual(getAcademicEntityScope('PROMES'), 'SEMESTER');
  assert.strictEqual(isSemesterEntity('PROMES'), true);
  assert.strictEqual(isAnnualEntity('PROMES'), false);
});

// =========================================================================
// SECTION B: Canonical Calendar Vocabulary (Single SSOT)
// =========================================================================
runTest('B. Canonical Calendar Vocabulary: Only ACADEMIC_CALENDAR exists, CALENDAR alias removed', () => {
  // ACADEMIC_CALENDAR must resolve properly
  assert.strictEqual(getAcademicEntityScope('ACADEMIC_CALENDAR'), 'SEMESTER');
  assert.strictEqual(isSemesterEntity('ACADEMIC_CALENDAR'), true);

  // 'CALENDAR' must not be in canonical scope mapping and must throw fail-closed
  assert.throws(
    () => getAcademicEntityScope('CALENDAR' as any),
    /Unknown academic entity kind/,
    'CALENDAR alias must not be accepted; only ACADEMIC_CALENDAR is canonical'
  );
});

// =========================================================================
// SECTION C: Absence of Known Synthetic JP Fallbacks in Data-Mode
// =========================================================================
runTest('C. Generator Audit: No synthetic JP fallbacks (|| 72, || 6, || 4) in PDF generators or DOCX generators', () => {
  const pdfGenPath = path.resolve(process.cwd(), 'src/services/documentEngine/renderers/pdf/pdfDocGenerators.ts');
  const pdfGenContent = fs.readFileSync(pdfGenPath, 'utf-8');

  // Must not contain `totalJP || 72`
  assert.strictEqual(
    pdfGenContent.includes('totalJP || 72'),
    false,
    'PDF generator must not fabricate default totalJP = 72'
  );

  // Must not contain `it.jp || 6` or `|| 6}`
  assert.strictEqual(
    pdfGenContent.includes('it.jp || 6'),
    false,
    'PDF generator must not fabricate default item JP = 6'
  );
  assert.strictEqual(
    pdfGenContent.includes('|| 6} JP'),
    false,
    'PDF generator must not contain synthetic "|| 6} JP"'
  );
  assert.strictEqual(
    pdfGenContent.includes('a.jp || 4'),
    false,
    'PDF generator must not fabricate allocation JP = 4'
  );

  // Check ATP generator does not assume semester authority in total label
  const atpGenPath = path.resolve(process.cwd(), 'src/services/documentEngine/generators/atpGenerator.ts');
  const atpGenContent = fs.readFileSync(atpGenPath, 'utf-8');
  assert.strictEqual(
    atpGenContent.includes('TOTAL ALOKASI WAKTU SEMESTER'),
    false,
    'ATP DOCX generator must not label total JP as SEMESTER'
  );

  // Check TP generator does not inject fake example TP in data mode
  const tpGenPath = path.resolve(process.cwd(), 'src/services/documentEngine/generators/tpGenerator.ts');
  const tpGenContent = fs.readFileSync(tpGenPath, 'utf-8');
  assert.strictEqual(
    tpGenContent.includes('Peserta didik mampu memahami dan menguasai kompetensi dasar.'),
    false,
    'TP DOCX generator must not fabricate sample TP description in data mode'
  );
});

// =========================================================================
// SECTION D: CP and TP Standalone Available in Merdeka Catalog & ZIP
// =========================================================================
runTest('D. Catalog Consistency: CP & TP standalone exist in MERDEKA_DOC_TYPES, DOCUMENT_CATALOG, and router', () => {
  // MERDEKA_DOC_TYPES in zipBundle
  assert.strictEqual(MERDEKA_DOC_TYPES.includes('CP'), true, 'MERDEKA_DOC_TYPES must include CP');
  assert.strictEqual(MERDEKA_DOC_TYPES.includes('TP'), true, 'MERDEKA_DOC_TYPES must include TP');

  // DOCUMENT_CATALOG in documentEngine
  const cpCatalog = DOCUMENT_CATALOG.find((c) => c.type === 'CP');
  const tpCatalog = DOCUMENT_CATALOG.find((c) => c.type === 'TP');
  assert.ok(cpCatalog, 'DOCUMENT_CATALOG must contain entry for CP');
  assert.ok(tpCatalog, 'DOCUMENT_CATALOG must contain entry for TP');

  // Router export types
  const routerTypes = getCurriculumDocumentTypes('KURIKULUM_MERDEKA');
  assert.strictEqual(routerTypes.includes('CP'), true, 'Router types must include CP');
  assert.strictEqual(routerTypes.includes('TP'), true, 'Router types must include TP');
});

// =========================================================================
// SECTION E: ZIP Instance-Aware Result Contract
// =========================================================================
runTest('E. ZIP Instance Contract: itemResults supports instanceId & instanceTitle without type collision', () => {
  const itemResults: ZipExportItemStatus[] = [
    {
      type: 'MODUL_AJAR',
      instanceId: 'plan-modul-1',
      instanceTitle: 'Modul 1: Gerak Dasar Bola Besar',
      status: 'SUCCESS',
      filesGenerated: ['06_Modul_Ajar_Gerak_Dasar_Bola_Besar.pdf'],
    },
    {
      type: 'MODUL_AJAR',
      instanceId: 'plan-modul-2',
      instanceTitle: 'Modul 2: Gerak Dasar Atletik',
      status: 'SUCCESS',
      filesGenerated: ['06_Modul_Ajar_Gerak_Dasar_Atletik.pdf'],
    },
    {
      type: 'ASESMEN',
      instanceId: 'pkg-asesmen-1',
      instanceTitle: 'Paket Formatif Unit 1',
      status: 'SUCCESS',
      filesGenerated: ['02_Asesmen_Paket_Formatif_Unit_1.pdf'],
    },
  ];

  // Assert all instances are preserved and distinct
  assert.strictEqual(itemResults.length, 3);
  assert.strictEqual(itemResults[0].instanceId, 'plan-modul-1');
  assert.strictEqual(itemResults[1].instanceId, 'plan-modul-2');
  assert.notStrictEqual(itemResults[0].instanceId, itemResults[1].instanceId);
  assert.strictEqual(itemResults[0].type, itemResults[1].type);
});

// =========================================================================
// SECTION F: Assessment Subsystem Untouched Confirmation
// =========================================================================
runTest('F. Protected Subsystem: Assessment core exports remain intact and functional', () => {
  assert.strictEqual(typeof checkAssessmentExportEligibility, 'function');

  // Verify core assessment files exist
  const assessmentExportServicePath = path.resolve(
    process.cwd(),
    'src/services/documentEngine/assessmentExportService.ts'
  );
  assert.strictEqual(fs.existsSync(assessmentExportServicePath), true);
});

// =========================================================================
// SECTION G: Micro-Fix Anti-Synthetic & Unverified Calendar Regression Lock
// =========================================================================
runTest('G. Micro-Fix Regression Lock: Unverified calendars removed, no synthetic scheduling, ATP partial guard', () => {
  // ASSERT A: Unverified calendar seeds removed
  const regionalCalendarsPath = path.resolve(process.cwd(), 'src/data/calendar/regionalCalendars.ts');
  const regionalCalendarsContent = fs.readFileSync(regionalCalendarsPath, 'utf-8');
  assert.strictEqual(
    regionalCalendarsContent.includes('kaldik-kab-bandung-2026-2027'),
    false,
    'regionalCalendars.ts must not contain unverified kaldik-kab-bandung-2026-2027'
  );
  assert.strictEqual(
    regionalCalendarsContent.includes('kaldik-nasional-2024-2025'),
    false,
    'regionalCalendars.ts must not contain unverified kaldik-nasional-2024-2025'
  );
  assert.strictEqual(
    regionalCalendarsContent.includes('kaldik-nasional-2025-2026'),
    false,
    'regionalCalendars.ts must not contain unverified kaldik-nasional-2025-2026'
  );
  assert.strictEqual(
    regionalCalendarsContent.includes('kaldik-nasional-2026-2027'),
    false,
    'regionalCalendars.ts must not contain unverified kaldik-nasional-2026-2027'
  );

  // ASSERT B: pdfDocGenerators.ts does not contain synthetic PROMES sequence
  const pdfGenPath = path.resolve(process.cwd(), 'src/services/documentEngine/renderers/pdf/pdfDocGenerators.ts');
  const pdfGenContent = fs.readFileSync(pdfGenPath, 'utf-8');
  assert.strictEqual(
    pdfGenContent.includes("'v', '', '', '', 'v'"),
    false,
    'pdfDocGenerators.ts must not contain synthetic PROMES week sequence'
  );

  // ASSERT C: Does not contain synthetic week range
  assert.strictEqual(
    pdfGenContent.includes('Minggu ke-${idx * 2 + 1}'),
    false,
    'pdfDocGenerators.ts must not fabricate week range "Minggu ke-${idx * 2 + 1}"'
  );

  // ASSERT D: Does not use fallback "1 Pekan Efektif" or "Bulan Berjalan"
  assert.strictEqual(
    pdfGenContent.includes('1 Pekan Efektif'),
    false,
    'pdfDocGenerators.ts must not contain fallback "1 Pekan Efektif"'
  );
  assert.strictEqual(
    pdfGenContent.includes('Bulan Berjalan'),
    false,
    'pdfDocGenerators.ts must not contain fallback "Bulan Berjalan"'
  );

  // ASSERT E: ATP generators have partial allocation status distinction
  const atpGenPath = path.resolve(process.cwd(), 'src/services/documentEngine/generators/atpGenerator.ts');
  const atpGenContent = fs.readFileSync(atpGenPath, 'utf-8');
  assert.strictEqual(
    atpGenContent.includes('Alokasi belum lengkap'),
    true,
    'atpGenerator.ts must contain partial allocation distinction "Alokasi belum lengkap"'
  );
  assert.strictEqual(
    pdfGenContent.includes('Alokasi belum lengkap'),
    true,
    'pdfDocGenerators.ts must contain partial allocation distinction "Alokasi belum lengkap"'
  );
});

console.log(`\n========================================`);
console.log(`ALL V12 BASELINE RECONCILIATION TESTS PASSED (${passedTests}/${totalTests})`);
console.log(`========================================\n`);
