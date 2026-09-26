import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  canConfirmAssessmentPackage,
  confirmAssessmentPackage,
} from '../src/services/assessmentPackageService';
import { resolveAssessmentGenerationUIState } from '../src/services/assessmentGenerationUIStateResolver';
import type {
  AcademicSetting,
  AssessmentPackage,
  AssessmentPlan,
  TPData,
  TPItem,
} from '../src/types';
import type { AssessmentValidationReport } from '../src/types/assessmentValidation';

console.log('=== B.1.2l SERVICE-LEVEL CONFIRMATION GATE REGRESSION SUITE ===');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`  [FAIL] ${name}:`, errorMsg);
    failed++;
  }
}

function createAcademicSetting(overrides?: Partial<AcademicSetting>): AcademicSetting {
  return {
    id: 'setting-1',
    profileId: 'prof-1',
    curriculum: 'Kurikulum Merdeka',
    curriculumType: 'KURIKULUM_MERDEKA',
    academicYear: '2026/2027',
    semester: '1 (Ganjil)',
    level: 'SD',
    grade: 'Kelas 4',
    phase: 'Fase B',
    subject: 'PJOK',
    updatedAt: '2026-09-24T00:00:00.000Z',
    ...overrides,
  };
}

function createTPItem(id: string, overrides?: Partial<TPItem>): TPItem {
  return {
    id,
    code: `TP-${id}`,
    statement: `Mempraktikkan gerak dasar untuk ${id}`,
    competence: 'Mempraktikkan',
    contentScope: 'gerak dasar',
    order: 1,
    ...overrides,
  };
}

function createTPData(items: TPItem[]): TPData {
  return {
    id: 'tp-data-1',
    academicSettingId: 'setting-1',
    workflowStatus: 'SIAP',
    needsReview: false,
    items,
    updatedAt: '2026-09-24T00:00:00.000Z',
  };
}

function createAssessmentPlan(tpIds: string[]): AssessmentPlan {
  return {
    id: 'plan-1',
    academicSettingId: 'setting-1',
    title: 'Rencana Asesmen Harian',
    purpose: 'SUMMATIVE',
    timing: 'POST',
    scopeType: 'TP',
    tpIds,
    criterionIds: [],
    instruments: [
      {
        id: 'inst-1',
        type: 'WRITTEN_TEST',
        label: 'Tes Tertulis',
      },
    ],
    workflowStatus: 'SIAP',
    needsReview: false,
    revision: 1,
    createdAt: '2026-09-24T00:00:00.000Z',
    updatedAt: '2026-09-24T00:00:00.000Z',
  };
}

function createValidPackage(overrides?: Partial<AssessmentPackage>): AssessmentPackage {
  return {
    id: 'pkg-1',
    assessmentPlanId: 'plan-1',
    academicSettingId: 'setting-1',
    title: 'Paket Asesmen Valid',
    revision: 1,
    blueprintItems: [
      {
        id: 'bp-1',
        objectiveRefId: 'tp-1',
        instrumentType: 'WRITTEN_TEST',
        instrumentItemIds: ['q1'],
        order: 1,
      },
    ],
    instruments: [
      {
        id: 'inst-1',
        type: 'WRITTEN_TEST',
        title: 'Tes Tertulis',
        items: [
          {
            id: 'q1',
            itemType: 'ESSAY',
            prompt: 'Jelaskan fungsi pemanasan sebelum olahraga.',
            order: 1,
          },
        ],
      },
    ],
    answerKeys: [
      {
        id: 'ak-q1',
        instrumentId: 'inst-1',
        instrumentItemId: 'q1',
        answerType: 'EXPECTED_RESPONSE',
        value: 'Pemanasan membantu mempersiapkan tubuh sebelum aktivitas fisik.',
      },
    ],
    scoringGuides: [
      {
        id: 'sg-q1',
        title: 'Pedoman Penskoran Soal 1',
        guideType: 'ESSAY',
        instructions: 'Nilai berdasarkan ketepatan dan kelengkapan jawaban.',
        maxScore: 10,
        instrumentId: 'inst-1',
        instrumentItemId: 'q1',
      },
    ],
    rubrics: [],
    workflowStatus: 'DRAFT',
    needsReview: true,
    createdAt: '2026-09-24T00:00:00.000Z',
    updatedAt: '2026-09-24T00:00:00.000Z',
    ...overrides,
  };
}

function createValidationReportFixture(
  pkg: AssessmentPackage,
  overrides?: Partial<AssessmentValidationReport>
): AssessmentValidationReport {
  return {
    id: 'report-1',
    assessmentPackageId: pkg.id,
    packageRevision: pkg.revision ?? 1,
    structural: {
      status: 'PASS',
      findings: [],
    },
    coverage: {
      status: 'PASS',
      findings: [],
    },
    answerVerification: {
      status: 'PASS',
      findings: [],
    },
    quality: {
      status: 'PASS',
      findings: [],
    },
    assembly: {
      status: 'PASS',
      findings: [],
    },
    overallStatus: 'PASS',
    reviewerStatus: 'NOT_REQUESTED',
    engineVersion: '1.0.0',
    createdAt: '2026-09-24T00:00:00.000Z',
    ...overrides,
  };
}

function runTests() {
  const tp1 = createTPItem('tp-1');
  const tpData = createTPData([tp1]);
  const plan = createAssessmentPlan(['tp-1']);
  const setting = createAcademicSetting();
  const context = {
    academicSetting: setting,
    assessmentPlan: plan,
    tp: tpData,
  };

  const packageServicePath = path.resolve('src/services/assessmentPackageService.ts');
  const packageServiceContent = fs.readFileSync(packageServicePath, 'utf8');

  const builderPath = path.resolve('src/components/administration/AssessmentPackageBuilder.tsx');
  const builderContent = fs.readFileSync(builderPath, 'utf8');

  const uiResolverPath = path.resolve('src/services/assessmentGenerationUIStateResolver.ts');
  const uiResolverContent = fs.readFileSync(uiResolverPath, 'utf8');

  const regressionFilePath = path.resolve('scripts/testB12lAssessmentConfirmationGateRegression.ts');
  const regressionContent = fs.readFileSync(regressionFilePath, 'utf8');

  // ----------------------------------------------------
  // TEST 1 — NO REPORT BLOCKED
  // ----------------------------------------------------
  test('TEST 1: canConfirmAssessmentPackage returns eligible=false when validationReport is null or undefined', () => {
    const pkg = createValidPackage();
    const resNull = canConfirmAssessmentPackage(pkg, context, null);
    assert.strictEqual(resNull.eligible, false, 'Eligible must be false for null report');
    assert.ok(resNull.errors.some((e) => e.includes('Laporan validasi final belum tersedia')));

    const resUndef = canConfirmAssessmentPackage(pkg, context, undefined);
    assert.strictEqual(resUndef.eligible, false, 'Eligible must be false for undefined report');
  });

  // ----------------------------------------------------
  // TEST 2 — NO REPORT CANNOT CONFIRM
  // ----------------------------------------------------
  test('TEST 2: confirmAssessmentPackage returns success=false and workflowStatus!=SIAP without report', () => {
    const pkg = createValidPackage();
    const res = confirmAssessmentPackage(pkg, context, null);
    assert.strictEqual(res.success, false, 'confirmAssessmentPackage must fail without report');
    assert.notStrictEqual(res.package.workflowStatus, 'SIAP', 'Package workflowStatus must not become SIAP');
  });

  // ----------------------------------------------------
  // TEST 3 — EXACT PASS REPORT
  // ----------------------------------------------------
  test('TEST 3: Structurally valid package with exact PASS report confirms to SIAP with needsReview=false', () => {
    const pkg = createValidPackage();
    const report = createValidationReportFixture(pkg, { overallStatus: 'PASS' });

    const gate = canConfirmAssessmentPackage(pkg, context, report);
    assert.strictEqual(gate.eligible, true, 'canConfirm must be eligible with exact PASS report');
    assert.strictEqual(gate.errors.length, 0, 'No errors expected');

    const confirmed = confirmAssessmentPackage(pkg, context, report);
    assert.strictEqual(confirmed.success, true, 'Confirmation must succeed');
    assert.strictEqual(confirmed.package.workflowStatus, 'SIAP', 'WorkflowStatus must be SIAP');
    assert.strictEqual(confirmed.package.needsReview, false, 'needsReview must be false');
    assert.strictEqual(confirmed.package.reviewReason, undefined, 'reviewReason must be cleared');
  });

  // ----------------------------------------------------
  // TEST 4 — EXACT REVIEW REPORT
  // ----------------------------------------------------
  test('TEST 4: Structurally valid package with exact REVIEW report confirms to SIAP on explicit teacher action', () => {
    const pkg = createValidPackage();
    const report = createValidationReportFixture(pkg, { overallStatus: 'REVIEW' });

    const gate = canConfirmAssessmentPackage(pkg, context, report);
    assert.strictEqual(gate.eligible, true, 'REVIEW report is eligible for teacher confirmation');

    const confirmed = confirmAssessmentPackage(pkg, context, report);
    assert.strictEqual(confirmed.success, true, 'Explicit teacher confirmation must succeed for REVIEW report');
    assert.strictEqual(confirmed.package.workflowStatus, 'SIAP', 'Confirmed package must be SIAP');
    assert.strictEqual(confirmed.package.needsReview, false, 'needsReview must be false after confirmation');
  });

  // ----------------------------------------------------
  // TEST 5 — FAIL REPORT BLOCKED
  // ----------------------------------------------------
  test('TEST 5: Package with FAIL validation report is strictly blocked from confirmation', () => {
    const pkg = createValidPackage();
    const report = createValidationReportFixture(pkg, { overallStatus: 'FAIL' });

    const gate = canConfirmAssessmentPackage(pkg, context, report);
    assert.strictEqual(gate.eligible, false, 'FAIL report must not be eligible');
    assert.ok(gate.errors.some((e) => e.includes('tidak memenuhi syarat')));

    const confirmed = confirmAssessmentPackage(pkg, context, report);
    assert.strictEqual(confirmed.success, false, 'Confirmation must fail for FAIL report');
    assert.notStrictEqual(confirmed.package.workflowStatus, 'SIAP', 'Status must not become SIAP');
  });

  // ----------------------------------------------------
  // TEST 6 — WRONG PACKAGE ID BLOCKED
  // ----------------------------------------------------
  test('TEST 6: Validation report with mismatched assessmentPackageId is blocked', () => {
    const pkg = createValidPackage({ id: 'pkg-alpha' });
    const report = createValidationReportFixture(pkg, { assessmentPackageId: 'pkg-beta' });

    const gate = canConfirmAssessmentPackage(pkg, context, report);
    assert.strictEqual(gate.eligible, false, 'Mismatched package ID must not be eligible');
    assert.ok(gate.errors.some((e) => e.includes('tidak cocok dengan ID Perangkat Asesmen')));

    const confirmed = confirmAssessmentPackage(pkg, context, report);
    assert.strictEqual(confirmed.success, false, 'Confirmation must fail for foreign package report');
    assert.notStrictEqual(confirmed.package.workflowStatus, 'SIAP');
  });

  // ----------------------------------------------------
  // TEST 7 — STALE REVISION BLOCKED
  // ----------------------------------------------------
  test('TEST 7: Stale revision in validation report is blocked from confirmation', () => {
    const pkg = createValidPackage({ revision: 2 });
    const report = createValidationReportFixture(pkg, { packageRevision: 1 });

    const gate = canConfirmAssessmentPackage(pkg, context, report);
    assert.strictEqual(gate.eligible, false, 'Stale revision must not be eligible');
    assert.ok(gate.errors.some((e) => e.includes('tidak cocok dengan revisi Perangkat Asesmen')));

    const confirmed = confirmAssessmentPackage(pkg, context, report);
    assert.strictEqual(confirmed.success, false, 'Confirmation must fail on stale revision');
    assert.notStrictEqual(confirmed.package.workflowStatus, 'SIAP');
  });

  // ----------------------------------------------------
  // TEST 8 — FUTURE REVISION ALSO BLOCKED
  // ----------------------------------------------------
  test('TEST 8: Future revision in validation report is also blocked (exact match enforced)', () => {
    const pkg = createValidPackage({ revision: 2 });
    const report = createValidationReportFixture(pkg, { packageRevision: 3 });

    const gate = canConfirmAssessmentPackage(pkg, context, report);
    assert.strictEqual(gate.eligible, false, 'Future revision mismatch must be rejected');

    const confirmed = confirmAssessmentPackage(pkg, context, report);
    assert.strictEqual(confirmed.success, false, 'Future revision report cannot confirm package');
  });

  // ----------------------------------------------------
  // TEST 9 — DEFAULT REVISION CONTRACT
  // ----------------------------------------------------
  test('TEST 9: Default package revision (undefined) resolves to revision 1', () => {
    const pkg = createValidPackage({ revision: undefined });
    const report = createValidationReportFixture(pkg, { packageRevision: 1 });

    const gate = canConfirmAssessmentPackage(pkg, context, report);
    assert.strictEqual(gate.eligible, true, 'Default revision 1 matches report revision 1');

    const confirmed = confirmAssessmentPackage(pkg, context, report);
    assert.strictEqual(confirmed.success, true, 'Confirmation succeeds with default revision matching 1');
  });

  // ----------------------------------------------------
  // TEST 10 — STRUCTURAL INVALID + PASS REPORT
  // ----------------------------------------------------
  test('TEST 10: Structurally invalid package cannot be confirmed even with exact PASS report', () => {
    const invalidPkg = createValidPackage({ title: '' }); // Invalid: empty title
    const report = createValidationReportFixture(invalidPkg, { overallStatus: 'PASS' });

    const gate = canConfirmAssessmentPackage(invalidPkg, context, report);
    assert.strictEqual(gate.eligible, false, 'Structurally invalid package must not be eligible');
    assert.ok(gate.errors.some((e) => e.includes('Judul Perangkat Asesmen wajib diisi')));

    const confirmed = confirmAssessmentPackage(invalidPkg, context, report);
    assert.strictEqual(confirmed.success, false, 'Confirmation must fail for structural error');
    assert.notStrictEqual(confirmed.package.workflowStatus, 'SIAP');
  });

  // ----------------------------------------------------
  // TEST 11 — STRUCTURAL FAILURE BEHAVIOR RETAINED
  // ----------------------------------------------------
  test('TEST 11: Structural failure in confirmAssessmentPackage retains PERLU_DILENGKAPI and needsReview=true', () => {
    const invalidPkg = createValidPackage({ title: '', blueprintItems: [] });
    const report = createValidationReportFixture(invalidPkg, { overallStatus: 'PASS' });

    const confirmed = confirmAssessmentPackage(invalidPkg, context, report);
    assert.strictEqual(confirmed.success, false);
    assert.strictEqual(confirmed.package.workflowStatus, 'PERLU_DILENGKAPI', 'Must set PERLU_DILENGKAPI on structural failure');
    assert.strictEqual(confirmed.package.needsReview, true, 'Must set needsReview=true on structural failure');
    assert.ok(confirmed.package.reviewReason, 'reviewReason must contain structural errors');
  });

  // ----------------------------------------------------
  // TEST 12 — GATE FAILURE DOES NOT FABRICATE STRUCTURAL FAILURE
  // ----------------------------------------------------
  test('TEST 12: Evidence gate failure on structurally valid package does not mutate package to PERLU_DILENGKAPI', () => {
    const pkg = createValidPackage({ workflowStatus: 'DRAFT', needsReview: false });
    // Report is missing (null)
    const confirmed = confirmAssessmentPackage(pkg, context, null);
    assert.strictEqual(confirmed.success, false);
    assert.strictEqual(confirmed.package.workflowStatus, 'DRAFT', 'Must retain existing DRAFT status, not mutate to PERLU_DILENGKAPI');
    assert.strictEqual(confirmed.package.needsReview, false, 'Must retain needsReview state');
  });

  // ----------------------------------------------------
  // TEST 13 — BUILDER PASSES REPORT TO ELIGIBILITY
  // ----------------------------------------------------
  test('TEST 13: AssessmentPackageBuilder passes validationReport to canConfirmAssessmentPackage', () => {
    assert.ok(
      builderContent.includes('canConfirmAssessmentPackage(activePackage, validationContext, validationReport)'),
      'Builder must supply validationReport to canConfirmAssessmentPackage'
    );
  });

  // ----------------------------------------------------
  // TEST 14 — BUILDER PASSES REPORT TO CONFIRM
  // ----------------------------------------------------
  test('TEST 14: AssessmentPackageBuilder passes validationReport to confirmAssessmentPackage', () => {
    assert.ok(
      builderContent.includes('confirmAssessmentPackage(activePackage, validationContext, validationReport)'),
      'Builder must supply validationReport to confirmAssessmentPackage'
    );
  });

  // ----------------------------------------------------
  // TEST 15 — UI CURRENT-REPORT GUARD RETAINED
  // ----------------------------------------------------
  test('TEST 15: assessmentGenerationUIStateResolver retains exact package identity and revision guards', () => {
    assert.ok(
      uiResolverContent.includes('validationReport.assessmentPackageId === activePackage.id') ||
      uiResolverContent.includes('validationReport.assessmentPackageId ===\n      activePackage.id') ||
      uiResolverContent.includes('activePackage.id'),
      'UI resolver must check assessmentPackageId against activePackage.id'
    );
    assert.ok(
      uiResolverContent.includes('validationReport.packageRevision === pkgRevision') ||
      uiResolverContent.includes('validationReport.packageRevision ===\n      pkgRevision') ||
      uiResolverContent.includes('pkgRevision'),
      'UI resolver must check packageRevision against pkgRevision'
    );
    assert.ok(
      uiResolverContent.includes("validationReport?.overallStatus === 'PASS'") &&
      uiResolverContent.includes("validationReport?.overallStatus === 'REVIEW'"),
      'UI resolver must require PASS or REVIEW'
    );
  });

  // ----------------------------------------------------
  // TEST 16 — FAIL NEVER READY FOR CONFIRMATION
  // ----------------------------------------------------
  test('TEST 16: FAIL validation report resolves to DRAFT_REVIEW in UI resolver, never READY_FOR_CONFIRMATION', () => {
    const pkg = createValidPackage();
    const failReport = createValidationReportFixture(pkg, { overallStatus: 'FAIL' });

    const state = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: plan,
      academicSetting: setting,
      tp: tpData,
      activePackage: pkg,
      validationReport: failReport,
      confirmationEligible: true,
    });

    assert.strictEqual(state, 'DRAFT_REVIEW', 'FAIL report must yield DRAFT_REVIEW');
    assert.notStrictEqual(state, 'READY_FOR_CONFIRMATION', 'Must never yield READY_FOR_CONFIRMATION on FAIL');
  });

  // ----------------------------------------------------
  // TEST 17 — VALIDATION ITSELF DOES NOT AUTO-SIAP
  // ----------------------------------------------------
  test('TEST 17: Package remains DRAFT after validation until explicit teacher confirmation', () => {
    const pkg = createValidPackage({ workflowStatus: 'DRAFT' });
    const passReport = createValidationReportFixture(pkg, { overallStatus: 'PASS' });

    const uiState = resolveAssessmentGenerationUIState({
      selectedPlanId: 'plan-1',
      assessmentPlan: plan,
      academicSetting: setting,
      tp: tpData,
      activePackage: pkg,
      validationReport: passReport,
      confirmationEligible: true,
    });

    assert.strictEqual(uiState, 'READY_FOR_CONFIRMATION', 'UI becomes READY_FOR_CONFIRMATION');
    assert.strictEqual(pkg.workflowStatus, 'DRAFT', 'Package workflowStatus remains DRAFT until confirm is called');
  });

  // ----------------------------------------------------
  // TEST 18 — NO UI BOOLEAN TRUST
  // ----------------------------------------------------
  test('TEST 18: Service confirmation gate performs authoritative checks and does not trust arbitrary UI flags', () => {
    assert.strictEqual(
      packageServiceContent.includes('confirmationEligible'),
      false,
      'Package service must not accept or reference external confirmationEligible flag'
    );
  });

  // ----------------------------------------------------
  // TEST 19 — NO TYPE ESCAPE IN NEW REGRESSION
  // ----------------------------------------------------
  test('TEST 19: Canonical typing enforced with zero type escapes in regression file', () => {
    const forbiddenTokens = ['as' + ' any', 'as' + ' unknown' + ' as', '@ts-' + 'ignore', '@ts-' + 'expect-error'];

    for (const token of forbiddenTokens) {
      const occurrences = regressionContent.split(token).length - 1;
      assert.strictEqual(
        occurrences,
        0,
        `Regression file must contain zero occurrences of "${token}"`
      );
    }
  });

  console.log(`\nRegression results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
