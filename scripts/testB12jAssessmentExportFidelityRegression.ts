import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildNormalizedAssessmentDocumentModel,
  checkAssessmentExportEligibility,
} from '../src/services/documentEngine/assessmentExportService';
import type { CanonicalAssessmentDocumentSnapshot } from '../src/types/assessmentExport';
import type {
  AssessmentPackage,
  SelfPeerAssessmentInstrument,
  OralAssessmentInstrument,
  PerformanceAssessmentInstrument,
  AssessmentAnswerKey,
  AssessmentScoringGuide,
  SchoolData,
  TeacherProfile,
  AcademicSetting,
} from '../src/types';
import type { DocumentGenerationContext } from '../src/services/documentEngine/types';

console.log('=== B.1.2j ASSESSMENT EXPORT FIDELITY REGRESSION SUITE ===');

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

function createBaseSnapshotFixture(
  overrides?: Partial<CanonicalAssessmentDocumentSnapshot>
): CanonicalAssessmentDocumentSnapshot {
  return {
    snapshotId: 'snap-test-01',
    mode: 'CANONICAL_PACKAGE',
    documentType: 'ASESMEN',
    documentMode: 'data',
    documentDate: '2026-09-23',
    formattedDocumentDate: '23 September 2026',
    assessmentPackageId: 'pkg-test-01',
    assessmentPackageRevision: 1,
    packageTitle: 'Paket Asesmen PJOK',
    schoolName: 'SD Negeri Nusantara',
    npsn: '12345678',
    schoolAddress: 'Jl. Pemuda No. 10',
    curriculum: 'MERDEKA',
    subject: 'PJOK',
    grade: '5',
    phase: 'C',
    academicYear: '2026/2027',
    semester: '1',
    principalName: 'Kepala Sekolah',
    teacherName: 'Guru Penjas',
    teacherNip: '198505052010011015',
    blueprintItems: [],
    instruments: [],
    answerKeys: [],
    scoringGuides: [],
    rubrics: [],
    resolvedObjectives: {},
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createBasePackageFixture(
  overrides?: Partial<AssessmentPackage>
): AssessmentPackage {
  return {
    id: 'pkg-default',
    assessmentPlanId: 'plan-default',
    academicSettingId: 'setting-default',
    title: 'Paket Asesmen',
    blueprintItems: [],
    instruments: [],
    answerKeys: [],
    scoringGuides: [],
    rubrics: [],
    workflowStatus: 'SIAP',
    needsReview: false,
    revision: 1,
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

function runTests() {
  const exportTypesPath = path.resolve('src/types/assessmentExport.ts');
  const exportTypesContent = fs.readFileSync(exportTypesPath, 'utf8');

  const exportServicePath = path.resolve('src/services/documentEngine/assessmentExportService.ts');
  const exportServiceContent = fs.readFileSync(exportServicePath, 'utf8');

  const previewPath = path.resolve('src/components/administration/AssessmentDocumentPreview.tsx');
  const previewContent = fs.readFileSync(previewPath, 'utf8');

  // ----------------------------------------------------
  // TEST 1 — NORMALIZED responseScheme TYPE
  // ----------------------------------------------------
  test('TEST 1: NormalizedAssessmentInstrument interface defines responseScheme?: string', () => {
    assert.ok(
      exportTypesContent.includes('responseScheme?: string;'),
      'NormalizedAssessmentInstrument must define responseScheme?: string;'
    );
  });

  // ----------------------------------------------------
  // TEST 2 — SELF responseScheme NORMALIZATION
  // ----------------------------------------------------
  test('TEST 2: SELF_ASSESSMENT normalization preserves responseScheme', () => {
    const selfInst: SelfPeerAssessmentInstrument = {
      id: 'self-1',
      type: 'SELF_ASSESSMENT',
      title: 'Refleksi Diri Sikap',
      instructions: 'Isilah dengan jujur',
      responseScheme: 'Skala Likert 1-4',
      items: [
        { id: 'sp-1', statement: 'Saya berdoa sebelum olahraga', category: 'Spiritual' },
      ],
    };
    const snapshot = createBaseSnapshotFixture({
      instruments: [selfInst],
    });

    const normalized = buildNormalizedAssessmentDocumentModel(snapshot);
    const inst = normalized.instruments.list.find((i) => i.id === 'self-1');
    assert.ok(inst, 'Instrument must be present');
    assert.strictEqual(inst.responseScheme, 'Skala Likert 1-4');
  });

  // ----------------------------------------------------
  // TEST 3 — PEER responseScheme NORMALIZATION
  // ----------------------------------------------------
  test('TEST 3: PEER_ASSESSMENT normalization preserves responseScheme', () => {
    const peerInst: SelfPeerAssessmentInstrument = {
      id: 'peer-1',
      type: 'PEER_ASSESSMENT',
      title: 'Penilaian Teman Sejawat',
      instructions: 'Amati temanmu',
      responseScheme: 'Ya / Tidak',
      items: [
        { id: 'sp-2', statement: 'Teman saya sportif', category: 'Sosial' },
      ],
    };
    const snapshot = createBaseSnapshotFixture({
      instruments: [peerInst],
    });

    const normalized = buildNormalizedAssessmentDocumentModel(snapshot);
    const inst = normalized.instruments.list.find((i) => i.id === 'peer-1');
    assert.ok(inst, 'Instrument must be present');
    assert.strictEqual(inst.responseScheme, 'Ya / Tidak');
  });

  // ----------------------------------------------------
  // TEST 4 — responseScheme PREVIEW
  // ----------------------------------------------------
  test('TEST 4: Preview consumes inst.responseScheme and renders Skema Respon label', () => {
    assert.ok(
      previewContent.includes('inst.responseScheme'),
      'Preview must consume inst.responseScheme'
    );
    assert.ok(
      previewContent.includes('Skema Respon:'),
      'Preview must display Skema Respon: label'
    );
  });

  // ----------------------------------------------------
  // TEST 5 — responseScheme DOCX
  // ----------------------------------------------------
  test('TEST 5: DOCX export consumes inst.responseScheme and renders semantic label', () => {
    assert.ok(
      exportServiceContent.includes('inst.responseScheme'),
      'DOCX export must check inst.responseScheme'
    );
    assert.ok(
      exportServiceContent.includes('Skema Respon:'),
      'DOCX export must include Skema Respon: text'
    );
  });

  // ----------------------------------------------------
  // TEST 6 — responseScheme PDF
  // ----------------------------------------------------
  test('TEST 6: PDF export branch consumes inst.responseScheme', () => {
    const matches = exportServiceContent.match(/Skema Respon:/g);
    assert.ok(matches && matches.length >= 2, 'Both DOCX and PDF must render Skema Respon:');
  });

  // ----------------------------------------------------
  // TEST 7 — ORAL expectedResponse NORMALIZED
  // ----------------------------------------------------
  test('TEST 7: Normalization preserves oral expectedResponse', () => {
    const oralInst: OralAssessmentInstrument = {
      id: 'oral-1',
      type: 'ORAL_TEST',
      title: 'Tes Lisan Peraturan',
      items: [
        {
          id: 'oi-1',
          prompt: 'Sebutkan 3 macam start!',
          expectedResponse: 'Start jongkok, melayang, dan berdiri',
          order: 1,
        },
      ],
    };
    const snapshot = createBaseSnapshotFixture({
      instruments: [oralInst],
    });

    const normalized = buildNormalizedAssessmentDocumentModel(snapshot);
    const inst = normalized.instruments.list.find((i) => i.id === 'oral-1');
    assert.ok(inst && inst.oralItems);
    assert.strictEqual(inst.oralItems[0].expectedResponse, 'Start jongkok, melayang, dan berdiri');
  });

  // ----------------------------------------------------
  // TEST 8 — ORAL expectedResponse PREVIEW
  // ----------------------------------------------------
  test('TEST 8: Preview preserves item.expectedResponse rendering', () => {
    assert.ok(
      previewContent.includes('item.expectedResponse'),
      'Preview must reference item.expectedResponse'
    );
    assert.ok(
      previewContent.includes('Respons yang Diharapkan:'),
      'Preview must display Respons yang Diharapkan: label'
    );
  });

  // ----------------------------------------------------
  // TEST 9 — ORAL expectedResponse DOCX
  // ----------------------------------------------------
  test('TEST 9: DOCX ORAL renderer uses it.expectedResponse with semantic label', () => {
    assert.ok(
      exportServiceContent.includes('it.expectedResponse'),
      'DOCX ORAL renderer must use it.expectedResponse'
    );
    assert.ok(
      exportServiceContent.includes('Respons yang Diharapkan:'),
      'DOCX ORAL renderer must display Respons yang Diharapkan: label'
    );
  });

  // ----------------------------------------------------
  // TEST 10 — ORAL expectedResponse PDF
  // ----------------------------------------------------
  test('TEST 10: PDF ORAL renderer uses it.expectedResponse', () => {
    const oralExpectedMatches = exportServiceContent.match(/Respons yang Diharapkan:/g);
    assert.ok(
      oralExpectedMatches && oralExpectedMatches.length >= 2,
      'Both DOCX and PDF must render Respons yang Diharapkan:'
    );
  });

  // ----------------------------------------------------
  // TEST 11 — SCORING GUIDE notes NORMALIZED
  // ----------------------------------------------------
  test('TEST 11: Normalization preserves scoring guide notes', () => {
    const scoringGuide: AssessmentScoringGuide = {
      id: 'sg-1',
      title: 'Pedoman Penilaian Praktik',
      guideType: 'RUBRIC_BASED',
      maxScore: 100,
      instructions: 'Nilai seluruh aspek secara menyeluruh',
      notes: 'Dibulatkan ke bilangan bulat terdekat',
    };
    const snapshot = createBaseSnapshotFixture({
      scoringGuides: [scoringGuide],
    });

    const normalized = buildNormalizedAssessmentDocumentModel(snapshot);
    const sg = normalized.scoringGuides.list[0];
    assert.ok(sg);
    assert.strictEqual(sg.notes, 'Dibulatkan ke bilangan bulat terdekat');
  });

  // ----------------------------------------------------
  // TEST 12 — SCORING GUIDE notes PREVIEW
  // ----------------------------------------------------
  test('TEST 12: Preview preserves guide.notes rendering', () => {
    assert.ok(
      previewContent.includes('guide.notes'),
      'Preview must reference guide.notes'
    );
  });

  // ----------------------------------------------------
  // TEST 13 — SCORING GUIDE notes DOCX
  // ----------------------------------------------------
  test('TEST 13: DOCX scoring guide renderer consumes sg.notes', () => {
    assert.ok(
      exportServiceContent.includes('sg.notes'),
      'DOCX scoring guide renderer must consume sg.notes'
    );
    assert.ok(
      exportServiceContent.includes('Catatan:'),
      'DOCX scoring guide renderer must display Catatan:'
    );
  });

  // ----------------------------------------------------
  // TEST 14 — SCORING GUIDE notes PDF
  // ----------------------------------------------------
  test('TEST 14: PDF scoring guide renderer consumes sg.notes', () => {
    const notesMatches = exportServiceContent.match(/Catatan:\s*\$\{sg\.notes\}/g);
    assert.ok(
      notesMatches && notesMatches.length >= 2,
      'Both DOCX and PDF must render Catatan: ${sg.notes}'
    );
  });

  // ----------------------------------------------------
  // TEST 15 — NO HARDCODED WRITTEN instrumentType
  // ----------------------------------------------------
  test('TEST 15: Normalization does not contain hardcoded instrumentType: WRITTEN_TEST', () => {
    assert.strictEqual(
      exportServiceContent.includes("instrumentType: 'WRITTEN_TEST'"),
      false,
      'Normalization must not hardcode instrumentType to WRITTEN_TEST'
    );
  });

  // ----------------------------------------------------
  // TEST 16 — ANSWER KEY EXACT INSTRUMENT RESOLUTION
  // ----------------------------------------------------
  test('TEST 16: Answer key resolves exact instrumentType from linked instrument (ORAL_TEST)', () => {
    const oralInst: OralAssessmentInstrument = {
      id: 'oral-inst-1',
      type: 'ORAL_TEST',
      title: 'Tes Lisan',
      items: [{ id: 'oi-1', prompt: 'Pertanyaan', expectedResponse: 'Kunci', order: 1 }],
    };
    const answerKey: AssessmentAnswerKey = {
      id: 'ak-1',
      instrumentId: 'oral-inst-1',
      instrumentItemId: 'oi-1',
      answerType: 'EXPECTED_RESPONSE',
      value: 'Kunci jawaban lisan',
    };
    const snapshot = createBaseSnapshotFixture({
      instruments: [oralInst],
      answerKeys: [answerKey],
    });

    const normalized = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(normalized.answerKeys.list[0].instrumentType, 'ORAL_TEST');
  });

  // ----------------------------------------------------
  // TEST 17 — NON-WRITTEN SEMANTIC CASE
  // ----------------------------------------------------
  test('TEST 17: Answer key resolves exact instrumentType for SELF_ASSESSMENT and PEER_ASSESSMENT', () => {
    const selfInst: SelfPeerAssessmentInstrument = {
      id: 'self-inst-1',
      type: 'SELF_ASSESSMENT',
      title: 'Penilaian Diri',
      items: [{ id: 'si-1', statement: 'Pernyataan' }],
    };
    const peerInst: SelfPeerAssessmentInstrument = {
      id: 'peer-inst-1',
      type: 'PEER_ASSESSMENT',
      title: 'Penilaian Teman',
      items: [{ id: 'pi-1', statement: 'Pernyataan' }],
    };
    const akSelf: AssessmentAnswerKey = {
      id: 'ak-self',
      instrumentId: 'self-inst-1',
      instrumentItemId: 'si-1',
      answerType: 'CATEGORY_RESPONSE',
      value: 'Kunci Self',
    };
    const akPeer: AssessmentAnswerKey = {
      id: 'ak-peer',
      instrumentId: 'peer-inst-1',
      instrumentItemId: 'pi-1',
      answerType: 'CATEGORY_RESPONSE',
      value: 'Kunci Peer',
    };
    const snapshot = createBaseSnapshotFixture({
      instruments: [selfInst, peerInst],
      answerKeys: [akSelf, akPeer],
    });

    const normalized = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(normalized.answerKeys.list[0].instrumentType, 'SELF_ASSESSMENT');
    assert.strictEqual(normalized.answerKeys.list[1].instrumentType, 'PEER_ASSESSMENT');
  });

  // ----------------------------------------------------
  // TEST 18 — DANGLING instrumentId DOES NOT FAKE WRITTEN
  // ----------------------------------------------------
  test('TEST 18: Dangling instrumentId resolves to explicit unknown "-" without faking WRITTEN_TEST', () => {
    const perfInst: PerformanceAssessmentInstrument = {
      id: 'perf-inst-1',
      type: 'PERFORMANCE',
      title: 'Praktik',
      task: 'Lakukan tugas praktik.',
    };
    const danglingAk: AssessmentAnswerKey = {
      id: 'ak-dangling',
      instrumentId: 'non-existent-id',
      instrumentItemId: 'item-none',
      answerType: 'OPTION',
      value: 'A',
    };
    const snapshot = createBaseSnapshotFixture({
      instruments: [perfInst],
      answerKeys: [danglingAk],
    });

    const normalized = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(normalized.answerKeys.list[0].instrumentType, '-');
    assert.notStrictEqual(normalized.answerKeys.list[0].instrumentType, 'WRITTEN_TEST');
  });

  // ----------------------------------------------------
  // TEST 19 — ANSWER KEY PREVIEW VISIBILITY
  // ----------------------------------------------------
  test('TEST 19: Preview table displays ak.instrumentType and ak.answerType as separate fields', () => {
    assert.ok(
      previewContent.includes('ak.instrumentType'),
      'Preview must render ak.instrumentType'
    );
    assert.ok(
      previewContent.includes('ak.answerType'),
      'Preview must render ak.answerType'
    );
    assert.ok(
      previewContent.includes('>Instrumen<'),
      'Preview must have an Instrumen column header'
    );
  });

  // ----------------------------------------------------
  // TEST 20 — ANSWER KEY DOCX VISIBILITY
  // ----------------------------------------------------
  test('TEST 20: DOCX table has Instrumen and Tipe Kunci columns using ak.instrumentType and ak.answerType', () => {
    assert.ok(
      exportServiceContent.includes("createAssessmentTableHeaderCell('Instrumen'"),
      'DOCX table must have Instrumen header cell'
    );
    assert.ok(
      exportServiceContent.includes("createAssessmentTableHeaderCell('Tipe Kunci'"),
      'DOCX table must have Tipe Kunci header cell'
    );
    assert.ok(
      exportServiceContent.includes('createAssessmentTableDataCell(ak.instrumentType'),
      'DOCX table must render ak.instrumentType'
    );
    assert.ok(
      exportServiceContent.includes('createAssessmentTableDataCell(ak.answerType'),
      'DOCX table must render ak.answerType'
    );
  });

  // ----------------------------------------------------
  // TEST 21 — ANSWER KEY PDF VISIBILITY
  // ----------------------------------------------------
  test('TEST 21: PDF table has Instrumen column and renders ak.instrumentType alongside ak.answerType', () => {
    assert.ok(
      exportServiceContent.includes("{ header: 'Instrumen', dataKey: 'instrumentType'"),
      'PDF table must define Instrumen column with dataKey instrumentType'
    );
    assert.ok(
      exportServiceContent.includes("{ header: 'Tipe Kunci', dataKey: 'answerType'"),
      'PDF table must define Tipe Kunci column with dataKey answerType'
    );
  });

  // ----------------------------------------------------
  // TEST 22 — PREVIEW REMAINS READ ONLY
  // ----------------------------------------------------
  test('TEST 22: AssessmentDocumentPreview is strictly read-only with no mutators', () => {
    assert.strictEqual(previewContent.includes('<input'), false, 'must not contain <input');
    assert.strictEqual(previewContent.includes('<textarea'), false, 'must not contain <textarea');
    assert.strictEqual(previewContent.includes('<select'), false, 'must not contain <select');
    assert.strictEqual(previewContent.includes('onChange='), false, 'must not contain onChange=');
    assert.strictEqual(previewContent.includes('updatePackage('), false, 'must not contain updatePackage(');
  });

  // ----------------------------------------------------
  // TEST 23 — PDF PROFILE RETAINED
  // ----------------------------------------------------
  test('TEST 23: PDF renderer retains PdfDocumentBuilder portrait FORMAL_NEUTRAL profile', () => {
    assert.ok(
      exportServiceContent.includes("new PdfDocumentBuilder(\n    'portrait',\n    'FORMAL_NEUTRAL'") ||
      exportServiceContent.includes("new PdfDocumentBuilder('portrait', 'FORMAL_NEUTRAL')"),
      'PDF renderer must instantiate with FORMAL_NEUTRAL profile'
    );
  });

  // ----------------------------------------------------
  // TEST 24 — DOCX TYPOGRAPHY RETAINED
  // ----------------------------------------------------
  test('TEST 24: DOCX export retains Times New Roman font and contains no Arial or legacy 1E3A8A', () => {
    assert.ok(
      exportServiceContent.includes("ASSESSMENT_DOCX_FONT = 'Times New Roman'"),
      'DOCX must define Times New Roman font'
    );
    assert.strictEqual(
      exportServiceContent.includes("'Arial'"),
      false,
      'DOCX must not reference Arial'
    );
    assert.strictEqual(
      exportServiceContent.includes('1E3A8A'),
      false,
      'DOCX must not reference legacy 1E3A8A color'
    );
  });

  // ----------------------------------------------------
  // TEST 25 — EXPORT ELIGIBILITY UNCHANGED
  // ----------------------------------------------------
  test('TEST 25: checkAssessmentExportEligibility strictly blocks non-SIAP and needsReview packages', () => {
    const mockSchool: SchoolData = {
      id: 'school-1',
      name: 'SD Negeri Nusantara',
      npsn: '12345678',
      address: 'Jl. Pemuda No. 10',
      village: 'Gambir',
      district: 'Kec. Gambir',
      regency: 'Jakarta Pusat',
      province: 'DKI Jakarta',
      principalName: 'Kepala Sekolah',
      principalNip: '197001011995011001',
      createdAt: '2026-09-23T00:00:00.000Z',
      updatedAt: '2026-09-23T00:00:00.000Z',
    };
    const mockProfile: TeacherProfile = {
      id: 'profile-1',
      name: 'Guru Penjas',
      nip: '198505052010011015',
      status: 'PNS',
      defaultSubject: 'PJOK',
      defaultLevel: 'SD',
      createdAt: '2026-09-23T00:00:00.000Z',
      updatedAt: '2026-09-23T00:00:00.000Z',
    };
    const mockSetting: AcademicSetting = {
      id: 'setting-1',
      profileId: 'profile-1',
      academicYear: '2026/2027',
      semester: '1 (Ganjil)',
      grade: 'Kelas 5',
      phase: 'C',
      subject: 'PJOK',
      curriculum: 'Kurikulum Merdeka',
      level: 'SD',
      updatedAt: '2026-09-23T00:00:00.000Z',
    };

    const draftPkg: AssessmentPackage = createBasePackageFixture({
      id: 'pkg-draft',
      workflowStatus: 'DRAFT',
      needsReview: false,
    });

    const ctxDraft: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockSetting,
      assessmentPackages: [draftPkg],
    };

    const resDraft = checkAssessmentExportEligibility(ctxDraft);
    assert.strictEqual(resDraft.eligible, false);

    const reviewPkg: AssessmentPackage = createBasePackageFixture({
      id: 'pkg-review',
      workflowStatus: 'SIAP',
      needsReview: true,
    });

    const ctxReview: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockSetting,
      assessmentPackages: [reviewPkg],
    };

    const resReview = checkAssessmentExportEligibility(ctxReview);
    assert.strictEqual(resReview.eligible, false);
  });

  // ----------------------------------------------------
  // TEST 26 — PREVIEW PIPELINE UNCHANGED
  // ----------------------------------------------------
  test('TEST 26: Preview pipeline uses createAssessmentPreviewSnapshot -> buildNormalizedAssessmentDocumentModel', () => {
    assert.ok(
      exportServiceContent.includes('export function createAssessmentPreviewModel('),
      'Preview pipeline must export createAssessmentPreviewModel'
    );
    assert.ok(
      exportServiceContent.includes('createAssessmentPreviewSnapshot('),
      'Preview pipeline must call createAssessmentPreviewSnapshot'
    );
    assert.ok(
      exportServiceContent.includes('buildNormalizedAssessmentDocumentModel('),
      'Preview pipeline must call buildNormalizedAssessmentDocumentModel'
    );
  });

  // ----------------------------------------------------
  // TEST 27 — EXPORT PIPELINE UNCHANGED
  // ----------------------------------------------------
  test('TEST 27: Export pipeline uses createAssessmentDocumentSnapshot -> buildNormalizedAssessmentDocumentModel', () => {
    assert.ok(
      exportServiceContent.includes('export async function exportAssessmentDocx('),
      'Must export exportAssessmentDocx'
    );
    assert.ok(
      exportServiceContent.includes('createAssessmentDocumentSnapshot(context, options);'),
      'Export pipeline must call createAssessmentDocumentSnapshot'
    );
    assert.ok(
      exportServiceContent.includes('const model = buildNormalizedAssessmentDocumentModel(snapshot);'),
      'Export pipeline must call buildNormalizedAssessmentDocumentModel'
    );
  });

  console.log(`\nRegression results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
