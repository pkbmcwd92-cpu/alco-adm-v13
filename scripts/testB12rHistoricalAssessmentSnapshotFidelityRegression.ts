import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  createAssessmentDocumentSnapshot,
  buildNormalizedAssessmentDocumentModel,
  exportAssessmentDocx,
  exportAssessmentPdf,
  isAssessmentDocumentSnapshot,
} from '../src/services/documentEngine/assessmentExportService';
import {
  generateDocument,
  generateDocumentFormatted,
} from '../src/services/documentEngine/index';
import type {
  AcademicSetting,
  AssessmentPackage,
  AssessmentPlan,
  TPData,
  SchoolData,
  TeacherProfile,
  AssessmentDocumentSnapshot,
  CanonicalAssessmentDocumentSnapshot,
  WrittenAssessmentInstrument,
  DocumentSnapshot,
} from '../src/types';
import type { DocumentGenerationContext } from '../src/services/documentEngine/types';

console.log('=== B.1.2r HISTORICAL ASSESSMENT SNAPSHOT FIDELITY REGRESSION SUITE ===');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          console.log(`  [PASS] ${name}`);
          passed++;
        })
        .catch((err) => {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`  [FAIL] ${name}:`, errorMsg);
          failed++;
        });
    }
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`  [FAIL] ${name}:`, errorMsg);
    failed++;
  }
}

function createBaseFixture() {
  const school: SchoolData = {
    id: 'school-1',
    name: 'SD Negeri Percobaan 1',
    npsn: '20101234',
    address: 'Jl. Pendidikan No. 10',
    village: 'Kampung Baru',
    district: 'Kec. Jebres',
    regency: 'Kota Surakarta',
    province: 'Jawa Tengah',
    principalName: 'Dr. H. Bambang Subroto, M.Pd.',
    principalNip: '196501011990031002',
    principalSource: 'OFFICIAL',
    createdAt: '2026-09-24T00:00:00.000Z',
    updatedAt: '2026-09-24T00:00:00.000Z',
  };

  const profile: TeacherProfile = {
    id: 'prof-1',
    name: 'Adzani Kusumawardani, S.Pd.',
    nip: '199208152019032014',
    status: 'PNS',
    defaultSubject: 'PJOK',
    defaultLevel: 'SD',
    createdAt: '2026-09-24T00:00:00.000Z',
    updatedAt: '2026-09-24T00:00:00.000Z',
  };

  const academicSetting: AcademicSetting = {
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
  };

  const tp: TPData = {
    id: 'tp-data-1',
    academicSettingId: 'setting-1',
    workflowStatus: 'SIAP',
    needsReview: false,
    items: [
      {
        id: 'tp-1',
        code: 'TP-1',
        statement: 'Mempraktikkan gerak dasar manipulatif bola basket',
        competence: 'Mempraktikkan',
        contentScope: 'Bola Basket',
        order: 1,
      },
    ],
    updatedAt: '2026-09-24T00:00:00.000Z',
  };

  const plan: AssessmentPlan = {
    id: 'plan-1',
    academicSettingId: 'setting-1',
    title: 'Rencana Asesmen Sumatif Bab 1',
    purpose: 'SUMMATIVE',
    timing: 'POST',
    scopeType: 'TP',
    tpIds: ['tp-1'],
    criterionIds: [],
    instruments: [
      {
        id: 'inst-1',
        type: 'WRITTEN_TEST',
        label: 'Tes Tertulis Utama',
      },
    ],
    workflowStatus: 'SIAP',
    needsReview: false,
    revision: 1,
    createdAt: '2026-09-24T00:00:00.000Z',
    updatedAt: '2026-09-24T00:00:00.000Z',
  };

  const pkg: AssessmentPackage = {
    id: 'pkg-1',
    assessmentPlanId: 'plan-1',
    academicSettingId: 'setting-1',
    title: 'Perangkat Asesmen Sumatif PJOK Bab 1',
    workflowStatus: 'SIAP',
    needsReview: false,
    revision: 1,
    blueprintItems: [
      {
        id: 'bp-1',
        objectiveRefId: 'tp-1',
        instrumentType: 'WRITTEN_TEST',
        instrumentItemIds: ['item-1'],
        order: 1,
        assessmentIndicator: 'Siswa mampu menyebutkan teknik dasar menggiring bola',
      },
    ],
    instruments: [
      {
        id: 'inst-1',
        type: 'WRITTEN_TEST',
        title: 'Tes Tertulis PJOK',
        items: [
          {
            id: 'item-1',
            itemType: 'MULTIPLE_CHOICE',
            prompt: 'Teknik memantulkan bola basket ke lantai disebut?',
            options: [
              { id: 'opt-a', label: 'A', text: 'Dribbling' },
              { id: 'opt-b', label: 'B', text: 'Passing' },
            ],
            order: 1,
          },
        ],
      },
    ],
    answerKeys: [
      {
        id: 'ak-1',
        instrumentId: 'inst-1',
        instrumentItemId: 'item-1',
        answerType: 'OPTION',
        optionIds: ['opt-a'],
      },
    ],
    scoringGuides: [],
    rubrics: [],
    createdAt: '2026-09-24T00:00:00.000Z',
    updatedAt: '2026-09-24T00:00:00.000Z',
  };

  const context: DocumentGenerationContext = {
    school,
    profile,
    academicSetting,
    tp,
    assessmentPlans: [plan],
    assessmentPackages: [pkg],
    activeAssessmentPackageId: pkg.id,
    documentDate: '2026-09-24',
    documentMode: 'data',
    skipDownload: true,
  };

  return { school, profile, academicSetting, tp, plan, pkg, context };
}

async function runRegression() {
  // ----------------------------------------------------
  // TEST 1 — FULL CANONICAL PAYLOAD IN SNAPSHOT
  // ----------------------------------------------------
  await test('TEST 1: Assessment snapshot contains full canonical content payload', () => {
    const { context, pkg } = createBaseFixture();
    const snapshot = createAssessmentDocumentSnapshot(context);

    assert.ok(isAssessmentDocumentSnapshot(snapshot), 'Must satisfy isAssessmentDocumentSnapshot');
    assert.strictEqual(snapshot.documentType, 'ASESMEN');
    assert.strictEqual(snapshot.mode, 'CANONICAL_PACKAGE');
    assert.strictEqual(snapshot.assessmentPackageId, pkg.id);
    assert.strictEqual(snapshot.assessmentPackageRevision, 1);
    assert.strictEqual(snapshot.packageTitle, pkg.title);
    assert.strictEqual(snapshot.documentDate, '2026-09-24');
    assert.strictEqual(snapshot.blueprintItems.length, 1);
    assert.strictEqual(snapshot.instruments.length, 1);
    assert.strictEqual(snapshot.answerKeys.length, 1);
    assert.ok(snapshot.resolvedObjectives['tp-1'], 'Resolved objectives must include tp-1');
  });

  // ----------------------------------------------------
  // TEST 2 — HISTORICAL SNAPSHOT IS AUTHORITATIVE
  // ----------------------------------------------------
  await test('TEST 2: Historical snapshot is authoritative against mutated live package', async () => {
    const { context, pkg } = createBaseFixture();
    const historicalSnapshot = createAssessmentDocumentSnapshot(context);

    // Mutate live package dramatically
    pkg.title = 'Judul Paket Baru Setelah Mutasi';
    const writtenInst = pkg.instruments[0] as WrittenAssessmentInstrument;
    writtenInst.items[0].prompt = 'Soal yang diubah total';
    pkg.answerKeys[0].optionIds = ['opt-b'];

    // Export using historical context containing historicalSnapshot
    const historicalContext: DocumentGenerationContext = {
      ...context,
      snapshot: historicalSnapshot,
      assessmentPackages: [pkg], // Live package is present but mutated
    };

    const docxResult = await exportAssessmentDocx(historicalContext);
    const model = buildNormalizedAssessmentDocumentModel(docxResult.snapshot);

    // Model must reflect historical snapshot, NOT mutated live package
    assert.strictEqual(docxResult.snapshot.packageTitle, 'Perangkat Asesmen Sumatif PJOK Bab 1');
    const normWritten = model.instruments.list.find((i) => i.type === 'WRITTEN_TEST');
    assert.strictEqual(normWritten?.writtenItems?.[0].prompt, 'Teknik memantulkan bola basket ke lantai disebut?');
    assert.strictEqual(model.answerKeys.list[0].value, 'A');
  });

  // ----------------------------------------------------
  // TEST 3 — LIVE PACKAGE DELETED
  // ----------------------------------------------------
  await test('TEST 3: Historical assessment export succeeds when live assessmentPackages array is empty', async () => {
    const { context } = createBaseFixture();
    const historicalSnapshot = createAssessmentDocumentSnapshot(context);

    const historicalContext: DocumentGenerationContext = {
      ...context,
      snapshot: historicalSnapshot,
      assessmentPackages: [], // Live packages completely deleted
      activeAssessmentPackageId: undefined,
    };

    const docxResult = await exportAssessmentDocx(historicalContext);
    assert.ok(docxResult.blob, 'DOCX blob must be generated');
    assert.strictEqual(docxResult.snapshot.assessmentPackageId, 'pkg-1');

    const pdfResult = await exportAssessmentPdf(historicalContext);
    assert.ok(pdfResult.blob, 'PDF blob must be generated');
    assert.strictEqual(pdfResult.snapshot.assessmentPackageId, 'pkg-1');
  });

  // ----------------------------------------------------
  // TEST 4 — LIVE PACKAGE BECOMES DRAFT
  // ----------------------------------------------------
  await test('TEST 4: Historical assessment export succeeds when live package is DRAFT and needsReview=true', async () => {
    const { context, pkg } = createBaseFixture();
    const historicalSnapshot = createAssessmentDocumentSnapshot(context);

    // Mutate live package to DRAFT
    pkg.workflowStatus = 'DRAFT';
    pkg.needsReview = true;
    pkg.reviewReason = 'Paket sedang diedit oleh guru';

    const historicalContext: DocumentGenerationContext = {
      ...context,
      snapshot: historicalSnapshot,
      assessmentPackages: [pkg],
    };

    const docxResult = await exportAssessmentDocx(historicalContext);
    assert.strictEqual(docxResult.snapshot.mode, 'CANONICAL_PACKAGE');
    assert.strictEqual(docxResult.snapshot.assessmentPackageRevision, 1);
  });

  // ----------------------------------------------------
  // TEST 5 — REVISION DRIFT
  // ----------------------------------------------------
  await test('TEST 5: Historical export preserves historical revision 3 even if live package bumped to revision 4', async () => {
    const { context, pkg } = createBaseFixture();
    pkg.revision = 3;
    const historicalSnapshot = createAssessmentDocumentSnapshot(context);

    // Live package revision advances to 4
    pkg.revision = 4;

    const historicalContext: DocumentGenerationContext = {
      ...context,
      snapshot: historicalSnapshot,
      assessmentPackages: [pkg],
    };

    const docxResult = await exportAssessmentDocx(historicalContext);
    assert.strictEqual(docxResult.snapshot.assessmentPackageRevision, 3);
    assert.ok(docxResult.fileName.includes('Rev3'), `Filename must contain Rev3, got: ${docxResult.fileName}`);

    const pdfResult = await exportAssessmentPdf(historicalContext);
    assert.strictEqual(pdfResult.snapshot.assessmentPackageRevision, 3);
    assert.ok(pdfResult.fileName.includes('Rev3'), `Filename must contain Rev3, got: ${pdfResult.fileName}`);
  });

  // ----------------------------------------------------
  // TEST 6 — DOCUMENT DATE DRIFT
  // ----------------------------------------------------
  await test('TEST 6: Historical export preserves historical documentDate against live workspace date change', async () => {
    const { context } = createBaseFixture();
    context.documentDate = '2026-09-24';
    const historicalSnapshot = createAssessmentDocumentSnapshot(context);

    const historicalContext: DocumentGenerationContext = {
      ...context,
      snapshot: historicalSnapshot,
      documentDate: '2026-10-15', // Live workspace changed date to next month
    };

    const docxResult = await exportAssessmentDocx(historicalContext);
    assert.strictEqual(docxResult.snapshot.documentDate, '2026-09-24');
    assert.ok(docxResult.snapshot.formattedDocumentDate.includes('24 September 2026'));
  });

  // ----------------------------------------------------
  // TEST 7 — DOCX DISPATCHER PRESERVES ASSESSMENT SNAPSHOT
  // ----------------------------------------------------
  await test('TEST 7: generateDocument("ASESMEN") preserves canonical AssessmentDocumentSnapshot in record.snapshot', async () => {
    const { context } = createBaseFixture();
    const result = await generateDocument('ASESMEN', context);

    assert.strictEqual(result.type, 'ASESMEN');
    assert.ok(result.record, 'Record must exist');
    assert.ok(isAssessmentDocumentSnapshot(result.record.snapshot), 'record.snapshot must be AssessmentDocumentSnapshot');

    const snap = result.record.snapshot as CanonicalAssessmentDocumentSnapshot;
    assert.strictEqual(snap.assessmentPackageId, 'pkg-1');
    assert.strictEqual(snap.assessmentPackageRevision, 1);
    assert.strictEqual(snap.blueprintItems.length, 1);
    assert.strictEqual(snap.instruments.length, 1);
    assert.strictEqual(snap.answerKeys.length, 1);
  });

  // ----------------------------------------------------
  // TEST 8 — FORMATTED DOCX PRESERVES SNAPSHOT
  // ----------------------------------------------------
  await test('TEST 8: generateDocumentFormatted("ASESMEN", "docx") preserves canonical AssessmentDocumentSnapshot', async () => {
    const { context } = createBaseFixture();
    const result = await generateDocumentFormatted('ASESMEN', context, 'docx');

    assert.strictEqual(result.format, 'docx');
    assert.ok(isAssessmentDocumentSnapshot(result.snapshot), 'result.snapshot must be AssessmentDocumentSnapshot');
    assert.ok(isAssessmentDocumentSnapshot(result.record.snapshot), 'result.record.snapshot must be AssessmentDocumentSnapshot');

    const snap = result.snapshot as CanonicalAssessmentDocumentSnapshot;
    assert.strictEqual(snap.assessmentPackageId, 'pkg-1');
    assert.strictEqual(snap.instruments.length, 1);
  });

  // ----------------------------------------------------
  // TEST 9 — FORMATTED PDF PRESERVES SNAPSHOT
  // ----------------------------------------------------
  await test('TEST 9: generateDocumentFormatted("ASESMEN", "pdf") preserves canonical AssessmentDocumentSnapshot', async () => {
    const { context } = createBaseFixture();
    const result = await generateDocumentFormatted('ASESMEN', context, 'pdf');

    assert.strictEqual(result.format, 'pdf');
    assert.ok(isAssessmentDocumentSnapshot(result.snapshot), 'result.snapshot must be AssessmentDocumentSnapshot');
    assert.ok(isAssessmentDocumentSnapshot(result.record.snapshot), 'result.record.snapshot must be AssessmentDocumentSnapshot');

    const snap = result.snapshot as CanonicalAssessmentDocumentSnapshot;
    assert.strictEqual(snap.assessmentPackageId, 'pkg-1');
    assert.strictEqual(snap.blueprintItems.length, 1);
  });

  // ----------------------------------------------------
  // TEST 10 — BLOB/SNAPSHOT REVISION CONSISTENCY
  // ----------------------------------------------------
  await test('TEST 10: Revision consistency between filename and snapshot is strictly preserved', async () => {
    const { context, pkg } = createBaseFixture();
    pkg.revision = 2;
    const docxResult = await exportAssessmentDocx(context);
    assert.ok(docxResult.fileName.includes('Rev2'));
    assert.strictEqual(docxResult.snapshot.assessmentPackageRevision, 2);

    const pdfResult = await exportAssessmentPdf(context);
    assert.ok(pdfResult.fileName.includes('Rev2'));
    assert.strictEqual(pdfResult.snapshot.assessmentPackageRevision, 2);
  });

  // ----------------------------------------------------
  // TEST 11 — NON-ASSESSMENT DISPATCHER PRESERVATION
  // ----------------------------------------------------
  await test('TEST 11: Non-assessment document dispatcher continues to use generic DocumentSnapshot', async () => {
    const { context } = createBaseFixture();
    // Add ATP data for non-assessment document generation
    const atpContext: DocumentGenerationContext = {
      ...context,
      atp: {
        id: 'atp-1',
        academicSettingId: 'setting-1',
        workflowStatus: 'SIAP',
        needsReview: false,
        items: [
          {
            id: 'atp-item-1',
            tpId: 'tp-1',
            stepNumber: 1,
            allocatedJP: 4,
            semester: 1,
            p3Dimensions: ['Mandiri'],
            assessmentPlan: 'Tes Tertulis',
          },
        ],
        updatedAt: '2026-09-24T00:00:00.000Z',
      },
    };

    const atpDocx = await generateDocumentFormatted('ATP', atpContext, 'docx');
    assert.strictEqual(atpDocx.type, 'ATP');
    assert.strictEqual(atpDocx.format, 'docx');
    assert.ok(atpDocx.snapshot, 'ATP snapshot must exist');
    assert.strictEqual(atpDocx.snapshot.schoolName, 'SD Negeri Percobaan 1');
  });

  // ----------------------------------------------------
  // TEST 13 — GENERATE DOCUMENT WITH DELETED LIVE PACKAGE
  // ----------------------------------------------------
  await test('TEST 13: generateDocument("ASESMEN") succeeds with historical snapshot when live packages are deleted', async () => {
    const { context } = createBaseFixture();
    const historicalSnapshot = createAssessmentDocumentSnapshot(context);

    const historicalContext: DocumentGenerationContext = {
      ...context,
      assessmentPackages: [],
      activeAssessmentPackageId: undefined,
      snapshot: historicalSnapshot,
    };

    const docResult = await generateDocument('ASESMEN', historicalContext);
    assert.ok(docResult.record, 'docResult.record must exist');
    assert.ok(isAssessmentDocumentSnapshot(docResult.record.snapshot), 'record.snapshot must be AssessmentDocumentSnapshot');

    const snap = docResult.record.snapshot as CanonicalAssessmentDocumentSnapshot;
    assert.strictEqual(snap.assessmentPackageId, 'pkg-1');
    assert.strictEqual(snap.assessmentPackageRevision, 1);
  });

  // ----------------------------------------------------
  // TEST 14 — FORMATTED DOCX WITH DELETED LIVE PACKAGE
  // ----------------------------------------------------
  await test('TEST 14: generateDocumentFormatted("ASESMEN", "docx") succeeds with historical snapshot when live package deleted', async () => {
    const { context } = createBaseFixture();
    const historicalSnapshot = createAssessmentDocumentSnapshot(context);

    const historicalContext: DocumentGenerationContext = {
      ...context,
      assessmentPackages: [],
      activeAssessmentPackageId: undefined,
      snapshot: historicalSnapshot,
    };

    const result = await generateDocumentFormatted('ASESMEN', historicalContext, 'docx');
    assert.strictEqual(result.format, 'docx');
    assert.ok(isAssessmentDocumentSnapshot(result.snapshot), 'result.snapshot must be AssessmentDocumentSnapshot');
    assert.ok(isAssessmentDocumentSnapshot(result.record.snapshot), 'result.record.snapshot must be AssessmentDocumentSnapshot');

    const snap = result.snapshot as CanonicalAssessmentDocumentSnapshot;
    assert.strictEqual(snap.assessmentPackageId, 'pkg-1');
  });

  // ----------------------------------------------------
  // TEST 15 — FORMATTED PDF WITH DELETED LIVE PACKAGE
  // ----------------------------------------------------
  await test('TEST 15: generateDocumentFormatted("ASESMEN", "pdf") succeeds with historical snapshot when live package deleted', async () => {
    const { context } = createBaseFixture();
    const historicalSnapshot = createAssessmentDocumentSnapshot(context);

    const historicalContext: DocumentGenerationContext = {
      ...context,
      assessmentPackages: [],
      activeAssessmentPackageId: undefined,
      snapshot: historicalSnapshot,
    };

    const result = await generateDocumentFormatted('ASESMEN', historicalContext, 'pdf');
    assert.strictEqual(result.format, 'pdf');
    assert.ok(isAssessmentDocumentSnapshot(result.snapshot), 'result.snapshot must be AssessmentDocumentSnapshot');
    assert.ok(isAssessmentDocumentSnapshot(result.record.snapshot), 'result.record.snapshot must be AssessmentDocumentSnapshot');

    const snap = result.snapshot as CanonicalAssessmentDocumentSnapshot;
    assert.strictEqual(snap.assessmentPackageId, 'pkg-1');
  });

  // ----------------------------------------------------
  // TEST 16 — LIVE PACKAGE BECOMES DRAFT / NEEDS REVIEW
  // ----------------------------------------------------
  await test('TEST 16: Historical export unaffected when live package changes to DRAFT / needsReview=true', async () => {
    const { context, pkg } = createBaseFixture();
    const historicalSnapshot = createAssessmentDocumentSnapshot(context);

    // Modify live package to invalid/draft state
    pkg.workflowStatus = 'DRAFT';
    pkg.needsReview = true;

    const historicalContext: DocumentGenerationContext = {
      ...context,
      assessmentPackages: [pkg],
      activeAssessmentPackageId: pkg.id,
      snapshot: historicalSnapshot,
    };

    const docxResult = await generateDocumentFormatted('ASESMEN', historicalContext, 'docx');
    assert.ok(docxResult.success);
    assert.ok(isAssessmentDocumentSnapshot(docxResult.snapshot));

    const pdfResult = await generateDocumentFormatted('ASESMEN', historicalContext, 'pdf');
    assert.ok(pdfResult.success);
    assert.ok(isAssessmentDocumentSnapshot(pdfResult.snapshot));
  });

  // ----------------------------------------------------
  // TEST 17 — LIVE PACKAGE REVISION DRIFT
  // ----------------------------------------------------
  await test('TEST 17: Live package revision drift does not alter historical snapshot revision in filename/record', async () => {
    const { context, pkg } = createBaseFixture();
    pkg.revision = 2;
    const historicalSnapshot = createAssessmentDocumentSnapshot(context);

    // Live package increments to revision 3
    pkg.revision = 3;

    const historicalContext: DocumentGenerationContext = {
      ...context,
      assessmentPackages: [pkg],
      activeAssessmentPackageId: pkg.id,
      snapshot: historicalSnapshot,
    };

    const docxResult = await generateDocumentFormatted('ASESMEN', historicalContext, 'docx');
    const snap = docxResult.snapshot as CanonicalAssessmentDocumentSnapshot;
    assert.strictEqual(snap.assessmentPackageRevision, 2);
    assert.ok(docxResult.fileName.includes('Rev2'), `Expected filename to include Rev2, got: ${docxResult.fileName}`);
  });

  // ----------------------------------------------------
  // TEST 19 — LIVE ASESMEN WITHOUT SNAPSHOT AND WITHOUT LIVE PACKAGE FAILS CLOSED
  // ----------------------------------------------------
  await test('TEST 19: Live ASESMEN without historical snapshot and without live package must fail closed', async () => {
    const { context } = createBaseFixture();
    const liveContext: DocumentGenerationContext = {
      ...context,
      snapshot: undefined,
      assessmentPackages: [],
      activeAssessmentPackageId: undefined,
    };

    let threw = false;
    try {
      await generateDocument('ASESMEN', liveContext);
    } catch {
      threw = true;
    }

    assert.strictEqual(
      threw,
      true,
      'TEST 19: Live ASESMEN without historical snapshot and without live package must fail closed'
    );
  });

  // ----------------------------------------------------
  // TEST 20 — GENERIC SNAPSHOT DOES NOT BYPASS ASSESSMENT ELIGIBILITY
  // ----------------------------------------------------
  await test('TEST 20: Generic DocumentSnapshot without canonical ASESMEN type does not bypass eligibility', async () => {
    const { context } = createBaseFixture();
    const genericSnapshot: DocumentSnapshot = {
      schoolName: context.school.name,
      teacherName: context.profile.name,
      principalName: context.school.principalName || '',
      academicYear: context.academicSetting.academicYear,
      semester: context.academicSetting.semester,
      subject: context.academicSetting.subject,
      grade: context.academicSetting.grade,
      generatedAt: '2026-09-24T00:00:00.000Z',
      documentDate: '2026-09-24',
      formattedDocumentDate: '24 September 2026',
    };

    const contextWithGenericSnapshot: DocumentGenerationContext = {
      ...context,
      snapshot: genericSnapshot,
      assessmentPackages: [],
      activeAssessmentPackageId: undefined,
    };

    let threw = false;
    try {
      await generateDocument('ASESMEN', contextWithGenericSnapshot);
    } catch {
      threw = true;
    }

    assert.strictEqual(
      threw,
      true,
      'TEST 20: Generic DocumentSnapshot must fail closed for ASESMEN generation when live package is missing'
    );
  });

  // ----------------------------------------------------
  // TEST 21 — GENERIC SNAPSHOT FORMATTED PDF FAILS CLOSED
  // ----------------------------------------------------
  await test('TEST 21: Generic DocumentSnapshot fails closed on generateDocumentFormatted("ASESMEN", "pdf")', async () => {
    const { context } = createBaseFixture();
    const genericSnapshot: DocumentSnapshot = {
      schoolName: context.school.name,
      teacherName: context.profile.name,
      principalName: context.school.principalName || '',
      academicYear: context.academicSetting.academicYear,
      semester: context.academicSetting.semester,
      subject: context.academicSetting.subject,
      grade: context.academicSetting.grade,
      generatedAt: '2026-09-24T00:00:00.000Z',
      documentDate: '2026-09-24',
      formattedDocumentDate: '24 September 2026',
    };

    const contextWithGenericSnapshot: DocumentGenerationContext = {
      ...context,
      snapshot: genericSnapshot,
      assessmentPackages: [],
      activeAssessmentPackageId: undefined,
    };

    let threw = false;
    try {
      await generateDocumentFormatted('ASESMEN', contextWithGenericSnapshot, 'pdf');
    } catch {
      threw = true;
    }

    assert.strictEqual(
      threw,
      true,
      'TEST 21: Generic DocumentSnapshot must fail closed on generateDocumentFormatted for ASESMEN'
    );
  });

  // ----------------------------------------------------
  // TEST 18 — ZERO FORBIDDEN TYPE ESCAPES
  // ----------------------------------------------------
  await test('TEST 18: Zero forbidden type escapes across modified services and regression suite', () => {
    const forbiddenTokens = [
      ['as', 'any'].join(' '),
      ['as', 'unknown', 'as'].join(' '),
      ['@ts', 'ignore'].join('-'),
      ['@ts', 'expect-error'].join('-'),
    ];

    const files = [
      'src/services/documentEngine/assessmentExportService.ts',
      'src/services/documentEngine/index.ts',
      'scripts/testB12rHistoricalAssessmentSnapshotFidelityRegression.ts',
    ];

    for (const file of files) {
      const content = fs.readFileSync(path.resolve(file), 'utf8');
      for (const token of forbiddenTokens) {
        const occurrences = content.split(token).length - 1;
        assert.strictEqual(
          occurrences,
          0,
          `File "${file}" must contain zero occurrences of "${token}"`
        );
      }
    }
  });

  console.log(`\nRegression results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runRegression();
