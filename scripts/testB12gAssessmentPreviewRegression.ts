import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  AssessmentPackage,
  SchoolData,
  TeacherProfile,
  AcademicSetting,
  AssessmentPlan,
  WrittenAssessmentInstrument,
} from '../src/types';
import {
  createAssessmentDocumentSnapshot,
  createAssessmentPreviewSnapshot,
  createAssessmentPreviewModel,
  checkAssessmentExportEligibility,
  buildNormalizedAssessmentDocumentModel,
} from '../src/services/documentEngine/assessmentExportService';
import { DocumentGenerationContext } from '../src/services/documentEngine/types';

function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      console.log(`  [PASS] ${name}`);
    } catch (err: any) {
      failed++;
      console.error(`  [FAIL] ${name}: ${err.stack || err.message}`);
    }
  }

  console.log('=== B.1.2g ASSESSMENT PREVIEW REGRESSION SUITE ===\n');

  // Base fixtures
  const mockSchool: SchoolData = {
    id: 'school-1',
    name: 'SMA Bintang Bangsa',
    npsn: '12345678',
    address: 'Jl. Merdeka No. 45',
    village: 'Gambir',
    district: 'Kec. Gambir',
    regency: 'Kota Administrasi Jakarta Pusat',
    province: 'DKI Jakarta',
    principalName: 'Budi Santoso, M.Pd.',
    principalNip: '197001011995011001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockProfile: TeacherProfile = {
    id: 'profile-1',
    name: 'Siti Rahma, S.Pd.',
    nip: '198501012010012001',
    status: 'PNS',
    defaultSubject: 'Biologi',
    defaultLevel: 'SMA',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockAcademicSetting: AcademicSetting = {
    id: 'setting-1',
    profileId: 'profile-1',
    academicYear: '2024/2025',
    semester: '1 (Ganjil)',
    level: 'SMA',
    grade: 'Kelas 10',
    phase: 'E',
    subject: 'Biologi',
    curriculum: 'Kurikulum Merdeka',
    curriculumType: 'KURIKULUM_MERDEKA',
    updatedAt: new Date().toISOString(),
  };

  const mockPlan: AssessmentPlan = {
    id: 'plan-1',
    title: 'Rencana Asesmen Ekologi',
    academicSettingId: 'setting-1',
    workflowStatus: 'SIAP',
    purpose: 'SUMMATIVE',
    timing: 'POST',
    scopeType: 'TP',
    instruments: [
      { id: 'inst-p1', type: 'WRITTEN_TEST', label: 'Tes Tertulis' },
    ],
    tpIds: ['tp-1'],
    criterionIds: [],
    needsReview: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const draftPackage: AssessmentPackage = {
    id: 'pkg-draft-1',
    assessmentPlanId: 'plan-1',
    title: 'Perangkat Asesmen Draf Ekologi',
    workflowStatus: 'DRAFT',
    revision: 1,
    needsReview: true,
    academicSettingId: 'setting-1',
    blueprintItems: [],
    instruments: [
      {
        id: 'inst-1',
        type: 'WRITTEN_TEST',
        title: 'Tes Tertulis Draf',
        items: [],
      } as WrittenAssessmentInstrument,
    ],
    answerKeys: [],
    scoringGuides: [],
    rubrics: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const perluDilengkapiPackage: AssessmentPackage = {
    id: 'pkg-perlu-1',
    assessmentPlanId: 'plan-1',
    title: 'Perangkat Asesmen Perlu Dilengkapi',
    workflowStatus: 'PERLU_DILENGKAPI',
    revision: 1,
    needsReview: true,
    academicSettingId: 'setting-1',
    blueprintItems: [],
    instruments: [],
    answerKeys: [],
    scoringGuides: [],
    rubrics: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const baseContext: DocumentGenerationContext = {
    school: mockSchool,
    profile: mockProfile,
    academicSetting: mockAcademicSetting,
    workspace: {
      id: 'ws-1',
      profileId: 'profile-1',
      schoolId: 'school-1',
      academicSettingId: 'setting-1',
      name: 'Biologi - Kelas 10',
      documentDate: '2025-01-15',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    assessmentPlans: [mockPlan],
    assessmentPackages: [draftPackage, perluDilengkapiPackage],
    documentMode: 'data',
  };

  // ----------------------------------------------------
  // TEST 1 — DRAFT PREVIEW ALLOWED
  // ----------------------------------------------------
  test('TEST 1: DRAFT preview is allowed without throwing', () => {
    const ctx: DocumentGenerationContext = {
      ...baseContext,
      activeAssessmentPackageId: draftPackage.id,
    };

    const snapshot = createAssessmentPreviewSnapshot(ctx, { documentMode: 'data' });
    assert.strictEqual(snapshot.assessmentPackageId, draftPackage.id);
    assert.strictEqual(snapshot.packageTitle, draftPackage.title);

    const model = createAssessmentPreviewModel(ctx, { documentMode: 'data' });
    assert.strictEqual(model.metadata.packageRevision, 1);
    assert.strictEqual(model.metadata.subject, 'Biologi');
  });

  // ----------------------------------------------------
  // TEST 2 — PERLU_DILENGKAPI PREVIEW ALLOWED
  // ----------------------------------------------------
  test('TEST 2: PERLU_DILENGKAPI preview is allowed and resolves exact package', () => {
    const ctx: DocumentGenerationContext = {
      ...baseContext,
      activeAssessmentPackageId: perluDilengkapiPackage.id,
    };

    const snapshot = createAssessmentPreviewSnapshot(ctx, { documentMode: 'data' });
    assert.strictEqual(snapshot.assessmentPackageId, perluDilengkapiPackage.id);
    assert.strictEqual(snapshot.packageTitle, perluDilengkapiPackage.title);
  });

  // ----------------------------------------------------
  // TEST 3 — EXACT IDENTITY
  // ----------------------------------------------------
  test('TEST 3: Preview strictly uses activeAssessmentPackageId (exact package identity)', () => {
    const pkgB: AssessmentPackage = {
      ...draftPackage,
      id: 'pkg-draft-2',
      title: 'Perangkat B Berbeda',
    };

    const ctx: DocumentGenerationContext = {
      ...baseContext,
      assessmentPackages: [draftPackage, pkgB],
      activeAssessmentPackageId: pkgB.id,
    };

    const snapshot = createAssessmentPreviewSnapshot(ctx, { documentMode: 'data' });
    assert.strictEqual(snapshot.assessmentPackageId, 'pkg-draft-2');
    assert.strictEqual(snapshot.packageTitle, 'Perangkat B Berbeda');
  });

  // ----------------------------------------------------
  // TEST 4 — MISSING EXACT ID FAILS
  // ----------------------------------------------------
  test('TEST 4: Missing or invalid activeAssessmentPackageId throws clear error (fail-closed)', () => {
    const ctxWithoutId: DocumentGenerationContext = {
      ...baseContext,
      activeAssessmentPackageId: undefined,
    };

    assert.throws(
      () => createAssessmentPreviewSnapshot(ctxWithoutId),
      /Pratinjau asesmen memerlukan ID paket aktif yang spesifik/
    );

    const ctxWithNonExistentId: DocumentGenerationContext = {
      ...baseContext,
      activeAssessmentPackageId: 'pkg-non-existent',
    };

    assert.throws(
      () => createAssessmentPreviewSnapshot(ctxWithNonExistentId),
      /tidak ditemukan/
    );
  });

  // ----------------------------------------------------
  // TEST 5 — EXPORT DRAFT STILL BLOCKED
  // ----------------------------------------------------
  test('TEST 5: Export eligibility still strictly blocks DRAFT and PERLU_DILENGKAPI', () => {
    const draftCtx: DocumentGenerationContext = {
      ...baseContext,
      activeAssessmentPackageId: draftPackage.id,
    };

    const draftEligibility = checkAssessmentExportEligibility(draftCtx);
    assert.strictEqual(draftEligibility.eligible, false);
    assert(draftEligibility.blockers.some((b) => b.includes('DRAFT')));

    const perluCtx: DocumentGenerationContext = {
      ...baseContext,
      activeAssessmentPackageId: perluDilengkapiPackage.id,
    };

    const perluEligibility = checkAssessmentExportEligibility(perluCtx);
    assert.strictEqual(perluEligibility.eligible, false);
    assert(perluEligibility.blockers.some((b) => b.includes('PERLU_DILENGKAPI')));
  });

  // ----------------------------------------------------
  // TEST 6 — OFFICIAL SNAPSHOT STILL USES EXPORT ELIGIBILITY
  // ----------------------------------------------------
  test('TEST 6: createAssessmentDocumentSnapshot checks export eligibility and throws on DRAFT', () => {
    const draftCtx: DocumentGenerationContext = {
      ...baseContext,
      activeAssessmentPackageId: draftPackage.id,
    };

    assert.throws(
      () => createAssessmentDocumentSnapshot(draftCtx),
      /Gagal membuat snapshot asesmen.*DRAFT/
    );

    const exportServicePath = path.resolve('src/services/documentEngine/assessmentExportService.ts');
    const source = fs.readFileSync(exportServicePath, 'utf8');
    assert(
      source.includes('const eligibility = checkAssessmentExportEligibility(context);'),
      'createAssessmentDocumentSnapshot must call checkAssessmentExportEligibility'
    );
  });

  // ----------------------------------------------------
  // TEST 7 — EXPORT ORCHESTRATORS STILL OFFICIAL
  // ----------------------------------------------------
  test('TEST 7: exportAssessmentDocx and exportAssessmentPdf use createAssessmentDocumentSnapshot, not preview snapshot', () => {
    const exportServicePath = path.resolve('src/services/documentEngine/assessmentExportService.ts');
    const source = fs.readFileSync(exportServicePath, 'utf8');

    const docxBlock = source.substring(source.indexOf('export async function exportAssessmentDocx'));
    assert(
      docxBlock.includes('createAssessmentDocumentSnapshot(context, options)'),
      'exportAssessmentDocx must call createAssessmentDocumentSnapshot'
    );
    assert(
      !docxBlock.includes('createAssessmentPreviewSnapshot'),
      'exportAssessmentDocx must NOT call createAssessmentPreviewSnapshot'
    );

    const pdfBlock = source.substring(source.indexOf('export async function exportAssessmentPdf'));
    assert(
      pdfBlock.includes('createAssessmentDocumentSnapshot(context, options)'),
      'exportAssessmentPdf must call createAssessmentDocumentSnapshot'
    );
    assert(
      !pdfBlock.includes('createAssessmentPreviewSnapshot'),
      'exportAssessmentPdf must NOT call createAssessmentPreviewSnapshot'
    );
  });

  // ----------------------------------------------------
  // TEST 8 — SHARED SNAPSHOT CORE
  // ----------------------------------------------------
  test('TEST 8: Official and preview snapshot functions share createCanonicalAssessmentSnapshotFromPackage helper', () => {
    const exportServicePath = path.resolve('src/services/documentEngine/assessmentExportService.ts');
    const source = fs.readFileSync(exportServicePath, 'utf8');

    assert(
      source.includes('function createCanonicalAssessmentSnapshotFromPackage('),
      'Shared helper createCanonicalAssessmentSnapshotFromPackage must exist'
    );

    const matches = source.match(/createCanonicalAssessmentSnapshotFromPackage\(/g) || [];
    assert(
      matches.length >= 3,
      `Expected declaration and calls from official and preview snapshots, found ${matches.length} matches`
    );
  });

  // ----------------------------------------------------
  // TEST 9 — NORMALIZED MODEL SHARED
  // ----------------------------------------------------
  test('TEST 9: createAssessmentPreviewModel uses standard buildNormalizedAssessmentDocumentModel', () => {
    const exportServicePath = path.resolve('src/services/documentEngine/assessmentExportService.ts');
    const source = fs.readFileSync(exportServicePath, 'utf8');

    const previewModelBlock = source.substring(source.indexOf('export function createAssessmentPreviewModel'));
    assert(
      previewModelBlock.includes('buildNormalizedAssessmentDocumentModel('),
      'createAssessmentPreviewModel must call buildNormalizedAssessmentDocumentModel'
    );
  });

  // ----------------------------------------------------
  // TEST 10 — SIAP PREVIEW/EXPORT PARITY (SHARED CORE INTEGRATION)
  // ----------------------------------------------------
  test('TEST 10: Snapshot parity between preview and export when using shared canonical builder', () => {
    const exportServicePath = path.resolve('src/services/documentEngine/assessmentExportService.ts');
    const source = fs.readFileSync(exportServicePath, 'utf8');

    // Verify that createAssessmentDocumentSnapshot delegates directly to createCanonicalAssessmentSnapshotFromPackage
    const officialSnapshotFn = source.substring(
      source.indexOf('export function createAssessmentDocumentSnapshot'),
      source.indexOf('export function createAssessmentPreviewSnapshot')
    );
    assert(
      officialSnapshotFn.includes('return createCanonicalAssessmentSnapshotFromPackage('),
      'Official snapshot must return createCanonicalAssessmentSnapshotFromPackage'
    );

    // Verify preview snapshot also delegates directly to createCanonicalAssessmentSnapshotFromPackage
    const previewSnapshotFn = source.substring(
      source.indexOf('export function createAssessmentPreviewSnapshot'),
      source.indexOf('export function createAssessmentPreviewModel')
    );
    assert(
      previewSnapshotFn.includes('return createCanonicalAssessmentSnapshotFromPackage('),
      'Preview snapshot must return createCanonicalAssessmentSnapshotFromPackage'
    );
  });

  // ----------------------------------------------------
  // TEST 11 — PREVIEW COMPONENT MODEL ONLY
  // ----------------------------------------------------
  test('TEST 11: AssessmentDocumentPreview consumes NormalizedAssessmentDocument, not raw AssessmentPackage', () => {
    const previewPath = path.resolve('src/components/administration/AssessmentDocumentPreview.tsx');
    const source = fs.readFileSync(previewPath, 'utf8');

    assert(
      source.includes('model: NormalizedAssessmentDocument'),
      'AssessmentDocumentPreview must accept model of type NormalizedAssessmentDocument'
    );
    assert(
      !source.includes('AssessmentPackage'),
      'AssessmentDocumentPreview must not accept or import AssessmentPackage'
    );
    assert(
      !source.includes('DocumentGenerationContext'),
      'AssessmentDocumentPreview must not accept or import DocumentGenerationContext'
    );
  });

  // ----------------------------------------------------
  // TEST 12 — PREVIEW READ ONLY
  // ----------------------------------------------------
  test('TEST 12: AssessmentDocumentPreview is strictly read-only with no mutator handlers', () => {
    const previewPath = path.resolve('src/components/administration/AssessmentDocumentPreview.tsx');
    const source = fs.readFileSync(previewPath, 'utf8');

    assert(!source.includes('onChange='), 'Preview component must have no onChange handlers');
    assert(!source.includes('updatePackage('), 'Preview component must have no updatePackage calls');
    assert(!source.includes('onSaveAssessmentPackage('), 'Preview component must have no onSaveAssessmentPackage calls');
  });

  // ----------------------------------------------------
  // TEST 13 — ALL DOCUMENT SECTIONS
  // ----------------------------------------------------
  test('TEST 13: AssessmentDocumentPreview renders all canonical document sections', () => {
    const previewPath = path.resolve('src/components/administration/AssessmentDocumentPreview.tsx');
    const source = fs.readFileSync(previewPath, 'utf8');

    assert(source.includes('model.metadata'), 'Must render metadata');
    assert(source.includes('model.kisiKisi'), 'Must render kisiKisi');
    assert(source.includes('model.instruments'), 'Must render instruments');
    assert(source.includes('model.answerKeys'), 'Must render answerKeys');
    assert(source.includes('model.scoringGuides'), 'Must render scoringGuides');
    assert(source.includes('model.rubrics'), 'Must render rubrics');
    assert(source.includes('model.signoff'), 'Must render signoff');
  });

  // ----------------------------------------------------
  // TEST 14 — ALL INSTRUMENT TYPES
  // ----------------------------------------------------
  test('TEST 14: AssessmentDocumentPreview renders all canonical instrument types', () => {
    const previewPath = path.resolve('src/components/administration/AssessmentDocumentPreview.tsx');
    const source = fs.readFileSync(previewPath, 'utf8');

    const canonicalTypes = [
      'WRITTEN_TEST',
      'ORAL_TEST',
      'PERFORMANCE',
      'OBSERVATION',
      'ASSIGNMENT',
      'PROJECT',
      'PRODUCT',
      'PORTFOLIO',
      'SELF_ASSESSMENT',
      'PEER_ASSESSMENT',
    ];

    for (const t of canonicalTypes) {
      assert(source.includes(t), `AssessmentDocumentPreview must handle instrument type ${t}`);
    }
  });

  // ----------------------------------------------------
  // TEST 15 — BUILDER TAB INTEGRATION
  // ----------------------------------------------------
  test('TEST 15: AssessmentPackageBuilder integrates Tab 5 Pratinjau and renumbers Tab 6 Validasi Status', () => {
    const builderPath = path.resolve('src/components/administration/AssessmentPackageBuilder.tsx');
    const source = fs.readFileSync(builderPath, 'utf8');

    assert(source.includes("activeTab === 'preview'"), "Builder must support activeTab === 'preview'");
    assert(source.includes('5. Pratinjau'), "Builder must render tab button '5. Pratinjau'");
    assert(source.includes('6. Validasi Status'), "Builder must render tab button '6. Validasi Status'");
  });

  // ----------------------------------------------------
  // TEST 16 — OPENING PREVIEW DOES NOT SAVE
  // ----------------------------------------------------
  test('TEST 16: Preview section in AssessmentPackageBuilder does not mutate or save package', () => {
    const builderPath = path.resolve('src/components/administration/AssessmentPackageBuilder.tsx');
    const source = fs.readFileSync(builderPath, 'utf8');

    const previewSection = source.substring(
      source.indexOf("{activeTab === 'preview'"),
      source.indexOf("{activeTab === 'validation'")
    );

    assert(!previewSection.includes('updatePackage('), 'Preview section must not call updatePackage');
    assert(!previewSection.includes('onSaveAssessmentPackage('), 'Preview section must not call onSaveAssessmentPackage');
  });

  // ----------------------------------------------------
  // TEST 17 — NO DRAFT EXPORT UI
  // ----------------------------------------------------
  test('TEST 17: Official export triggers in Builder strictly guard against non-SIAP packages', () => {
    const builderPath = path.resolve('src/components/administration/AssessmentPackageBuilder.tsx');
    const source = fs.readFileSync(builderPath, 'utf8');

    assert(
      source.includes("if (!activePackage || activePackage.workflowStatus !== 'SIAP') return;"),
      'handleExportDocx and handleExportPdf must guard against non-SIAP packages'
    );
  });

  console.log(`\nRegression results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
