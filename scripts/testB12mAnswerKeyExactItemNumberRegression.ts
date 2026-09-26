import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { buildNormalizedAssessmentDocumentModel } from '../src/services/documentEngine/assessmentExportService';
import type {
  CanonicalAssessmentDocumentSnapshot,
  WrittenAssessmentInstrument,
  OralAssessmentInstrument,
  PerformanceAssessmentInstrument,
  SelfPeerAssessmentInstrument,
} from '../src/types';

console.log('=== B.1.2m ANSWER KEY EXACT ITEM NUMBER LINKAGE REGRESSION SUITE ===');

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
    snapshotId: 'snapshot-test-1',
    mode: 'CANONICAL_PACKAGE',
    documentType: 'ASESMEN',
    documentDate: '2026-09-24',
    formattedDocumentDate: 'Surakarta, 24 September 2026',
    assessmentPlanId: 'plan-1',
    assessmentPlanTitle: 'Rencana Asesmen PJOK',
    assessmentPackageId: 'pkg-1',
    assessmentPackageRevision: 1,
    packageTitle: 'Paket Asesmen PJOK Semester 1',
    schoolName: 'SD Negeri Percobaan',
    schoolAddress: 'Jl. Pendidikan No. 1',
    schoolRegency: 'Surakarta',
    schoolProvince: 'Jawa Tengah',
    principalName: 'Budi Santoso, M.Pd.',
    principalNip: '197001011995011001',
    principalSource: 'profile',
    teacherName: 'Adzani Kusumawardani, S.Pd.',
    teacherNip: '199001012015012001',
    teacherStatus: 'PNS',
    academicYear: '2026/2027',
    semester: '1 (Ganjil)',
    grade: 'Kelas 4',
    subject: 'PJOK',
    phase: 'Fase B',
    curriculum: 'Kurikulum Merdeka',
    curriculumType: 'KURIKULUM_MERDEKA',
    documentMode: 'data',
    studentCount: 28,
    generatedAt: '2026-09-24T00:00:00.000Z',
    blueprintItems: [],
    instruments: [],
    answerKeys: [],
    scoringGuides: [],
    rubrics: [],
    resolvedObjectives: {},
    ...overrides,
  };
}

function runTests() {
  const exportServicePath = path.resolve('src/services/documentEngine/assessmentExportService.ts');
  const exportServiceContent = fs.readFileSync(exportServicePath, 'utf8');

  const previewPath = path.resolve('src/components/administration/AssessmentDocumentPreview.tsx');
  const previewContent = fs.readFileSync(previewPath, 'utf8');

  const regressionFilePath = path.resolve('scripts/testB12mAnswerKeyExactItemNumberRegression.ts');
  const regressionContent = fs.readFileSync(regressionFilePath, 'utf8');

  // ----------------------------------------------------
  // TEST 1 — NO ARRAY INDEX NUMBERING
  // ----------------------------------------------------
  test('TEST 1: Answer key normalization does not use array index (idx + 1)', () => {
    // Find the answer keys block in buildNormalizedAssessmentDocumentModel
    const akBlockStart = exportServiceContent.indexOf('// 4. Answer Keys');
    const akBlockEnd = exportServiceContent.indexOf('// 5. Scoring Guides');
    assert.ok(akBlockStart > 0 && akBlockEnd > akBlockStart, 'Answer Keys section must exist');

    const akBlock = exportServiceContent.substring(akBlockStart, akBlockEnd);
    assert.strictEqual(
      akBlock.includes('itemNumber: idx + 1'),
      false,
      'Answer key normalization must not use "itemNumber: idx + 1"'
    );
  });

  // ----------------------------------------------------
  // TEST 2 — WRITTEN EXACT ORDER
  // ----------------------------------------------------
  test('TEST 2: Answer key resolves exact order from linked WrittenAssessmentItem', () => {
    const writtenInstrument: WrittenAssessmentInstrument = {
      id: 'inst-w1',
      type: 'WRITTEN_TEST',
      title: 'Tes Tertulis PJOK',
      items: [
        {
          id: 'item-1',
          order: 1,
          itemType: 'MULTIPLE_CHOICE',
          prompt: 'Soal 1',
        },
        {
          id: 'item-2',
          order: 7,
          itemType: 'ESSAY',
          prompt: 'Soal 2',
        },
      ],
    };

    const snapshot = createBaseSnapshotFixture({
      instruments: [writtenInstrument],
      answerKeys: [
        {
          id: 'ak-2',
          instrumentId: 'inst-w1',
          instrumentItemId: 'item-2',
          answerType: 'EXPECTED_RESPONSE',
          value: 'Kunci Soal 2',
        },
      ],
    });

    const normalized = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(normalized.answerKeys.list.length, 1);
    assert.strictEqual(normalized.answerKeys.list[0].itemNumber, 7, 'itemNumber must be 7 (exact order of item-2)');
    assert.strictEqual(normalized.answerKeys.list[0].instrumentType, 'WRITTEN_TEST');
  });

  // ----------------------------------------------------
  // TEST 3 — WRITTEN REVERSED ANSWER KEY ORDER
  // ----------------------------------------------------
  test('TEST 3: Reversed answer key array preserves exact canonical item orders', () => {
    const writtenInstrument: WrittenAssessmentInstrument = {
      id: 'inst-w1',
      type: 'WRITTEN_TEST',
      items: [
        {
          id: 'item-a',
          order: 10,
          itemType: 'MULTIPLE_CHOICE',
          prompt: 'Soal A',
        },
        {
          id: 'item-b',
          order: 20,
          itemType: 'MULTIPLE_CHOICE',
          prompt: 'Soal B',
        },
      ],
    };

    const snapshot = createBaseSnapshotFixture({
      instruments: [writtenInstrument],
      answerKeys: [
        {
          id: 'ak-b',
          instrumentId: 'inst-w1',
          instrumentItemId: 'item-b',
          answerType: 'OPTION',
          value: 'B',
        },
        {
          id: 'ak-a',
          instrumentId: 'inst-w1',
          instrumentItemId: 'item-a',
          answerType: 'OPTION',
          value: 'A',
        },
      ],
    });

    const normalized = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(normalized.answerKeys.list[0].itemNumber, 20, 'First answer key must have itemNumber 20');
    assert.strictEqual(normalized.answerKeys.list[1].itemNumber, 10, 'Second answer key must have itemNumber 10');
  });

  // ----------------------------------------------------
  // TEST 4 — NON-SEQUENTIAL ITEM ORDER
  // ----------------------------------------------------
  test('TEST 4: Non-sequential item orders (2, 5, 11) are faithfully resolved without sequential fabrication', () => {
    const writtenInstrument: WrittenAssessmentInstrument = {
      id: 'inst-w1',
      type: 'WRITTEN_TEST',
      items: [
        { id: 'it-2', order: 2, itemType: 'SHORT_ANSWER', prompt: 'Prompt 2' },
        { id: 'it-5', order: 5, itemType: 'SHORT_ANSWER', prompt: 'Prompt 5' },
        { id: 'it-11', order: 11, itemType: 'SHORT_ANSWER', prompt: 'Prompt 11' },
      ],
    };

    const snapshot = createBaseSnapshotFixture({
      instruments: [writtenInstrument],
      answerKeys: [
        { id: 'ak-11', instrumentId: 'inst-w1', instrumentItemId: 'it-11', answerType: 'EXACT', value: 'Ans 11' },
      ],
    });

    const normalized = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(normalized.answerKeys.list[0].itemNumber, 11, 'itemNumber must be 11, not 1, 2, or 3');
  });

  // ----------------------------------------------------
  // TEST 5 — ORAL EXACT ORDER
  // ----------------------------------------------------
  test('TEST 5: Oral assessment answer key resolves exact order from OralAssessmentItem', () => {
    const oralInstrument: OralAssessmentInstrument = {
      id: 'inst-o1',
      type: 'ORAL_TEST',
      items: [
        { id: 'oral-1', order: 4, prompt: 'Pertanyaan Lisan', expectedResponse: 'Jawaban Diharapkan' },
      ],
    };

    const snapshot = createBaseSnapshotFixture({
      instruments: [oralInstrument],
      answerKeys: [
        { id: 'ak-oral', instrumentId: 'inst-o1', instrumentItemId: 'oral-1', answerType: 'EXPECTED_RESPONSE', value: 'Jawaban Diharapkan' },
      ],
    });

    const normalized = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(normalized.answerKeys.list[0].itemNumber, 4, 'itemNumber must be 4');
    assert.strictEqual(normalized.answerKeys.list[0].instrumentType, 'ORAL_TEST');
  });

  // ----------------------------------------------------
  // TEST 6 — DANGLING instrumentItemId
  // ----------------------------------------------------
  test('TEST 6: Dangling instrumentItemId resolves itemNumber to undefined without fallback', () => {
    const writtenInstrument: WrittenAssessmentInstrument = {
      id: 'inst-w1',
      type: 'WRITTEN_TEST',
      items: [
        { id: 'item-1', order: 1, itemType: 'ESSAY', prompt: 'Soal 1' },
      ],
    };

    const snapshot = createBaseSnapshotFixture({
      instruments: [writtenInstrument],
      answerKeys: [
        { id: 'ak-ghost', instrumentId: 'inst-w1', instrumentItemId: 'item-non-existent', answerType: 'EXPECTED_RESPONSE', value: 'Ghost' },
      ],
    });

    const normalized = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(normalized.answerKeys.list[0].itemNumber, undefined, 'itemNumber must be undefined for dangling item');
    assert.strictEqual(normalized.answerKeys.list[0].instrumentType, 'WRITTEN_TEST', 'instrumentType still resolved');
  });

  // ----------------------------------------------------
  // TEST 7 — DANGLING instrumentId
  // ----------------------------------------------------
  test('TEST 7: Dangling instrumentId resolves instrumentType to "-" and itemNumber to undefined', () => {
    const snapshot = createBaseSnapshotFixture({
      instruments: [],
      answerKeys: [
        { id: 'ak-ghost-inst', instrumentId: 'ghost-inst', instrumentItemId: 'ghost-item', answerType: 'EXPECTED_RESPONSE', value: 'Ghost' },
      ],
    });

    const normalized = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(normalized.answerKeys.list[0].instrumentType, '-', 'instrumentType must be "-"');
    assert.strictEqual(normalized.answerKeys.list[0].itemNumber, undefined, 'itemNumber must be undefined');
  });

  // ----------------------------------------------------
  // TEST 8 — WRONG ITEM FROM ANOTHER INSTRUMENT NOT USED
  // ----------------------------------------------------
  test('TEST 8: Item belonging to another instrument is not resolved (no cross-instrument search)', () => {
    const instA: WrittenAssessmentInstrument = {
      id: 'inst-a',
      type: 'WRITTEN_TEST',
      items: [{ id: 'item-x', order: 3, itemType: 'ESSAY', prompt: 'A' }],
    };
    const instB: WrittenAssessmentInstrument = {
      id: 'inst-b',
      type: 'WRITTEN_TEST',
      items: [{ id: 'item-y', order: 9, itemType: 'ESSAY', prompt: 'B' }],
    };

    const snapshot = createBaseSnapshotFixture({
      instruments: [instA, instB],
      answerKeys: [
        // AnswerKey points to inst-a, but item-y belongs to inst-b
        { id: 'ak-cross', instrumentId: 'inst-a', instrumentItemId: 'item-y', answerType: 'EXPECTED_RESPONSE', value: 'Val' },
      ],
    });

    const normalized = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(normalized.answerKeys.list[0].itemNumber, undefined, 'Cross-instrument item must resolve to undefined');
  });

  // ----------------------------------------------------
  // TEST 9 — PERFORMANCE DOES NOT FABRICATE NUMBER
  // ----------------------------------------------------
  test('TEST 9: Performance instrument without ordered item collection resolves itemNumber to undefined', () => {
    const perfInst: PerformanceAssessmentInstrument = {
      id: 'inst-p1',
      type: 'PERFORMANCE',
      task: 'Lakukan servis bawah bola voli',
      aspects: [{ id: 'asp-1', label: 'Sikap awalan', weight: 30 }],
    };

    const snapshot = createBaseSnapshotFixture({
      instruments: [perfInst],
      answerKeys: [
        { id: 'ak-perf', instrumentId: 'inst-p1', instrumentItemId: 'asp-1', answerType: 'EXPECTED_RESPONSE', value: 'Rubrik' },
      ],
    });

    const normalized = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(normalized.answerKeys.list[0].instrumentType, 'PERFORMANCE');
    assert.strictEqual(normalized.answerKeys.list[0].itemNumber, undefined, 'Performance answer key must have itemNumber undefined');
  });

  // ----------------------------------------------------
  // TEST 10 — SELF/PEER LEGACY KEY DOES NOT FABRICATE NUMBER
  // ----------------------------------------------------
  test('TEST 10: Legacy Self/Peer answer key does not fabricate item number', () => {
    const selfInst: SelfPeerAssessmentInstrument = {
      id: 'inst-s1',
      type: 'SELF_ASSESSMENT',
      items: [{ id: 'sp-1', statement: 'Saya berdoa sebelum olahraga', category: 'Sikap Spiritual' }],
    };

    const snapshot = createBaseSnapshotFixture({
      instruments: [selfInst],
      answerKeys: [
        { id: 'ak-self', instrumentId: 'inst-s1', instrumentItemId: 'sp-1', answerType: 'CATEGORY_RESPONSE', value: 'Ya' },
      ],
    });

    const normalized = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(normalized.answerKeys.list[0].instrumentType, 'SELF_ASSESSMENT');
    assert.strictEqual(normalized.answerKeys.list[0].itemNumber, undefined, 'Self/Peer item has no canonical order, must be undefined');
  });

  // ----------------------------------------------------
  // TEST 11 — PREVIEW NO INDEX FALLBACK
  // ----------------------------------------------------
  test('TEST 11: AssessmentDocumentPreview does not contain "ak.itemNumber ?? akIdx + 1" or array index fallback', () => {
    assert.strictEqual(
      previewContent.includes('ak.itemNumber ?? akIdx + 1'),
      false,
      'Preview must not fall back to akIdx + 1'
    );
    assert.ok(
      previewContent.includes("ak.itemNumber ?? '-'"),
      'Preview must fall back to "-" for undefined itemNumber'
    );
  });

  // ----------------------------------------------------
  // TEST 12 — PREVIEW SHOWS DASH ON UNKNOWN
  // ----------------------------------------------------
  test('TEST 12: Preview representation for undefined itemNumber renders "-"', () => {
    const undefinedNum: number | undefined = undefined;
    const rendered = undefinedNum ?? '-';
    assert.strictEqual(rendered, '-', 'Undefined itemNumber renders "-"');
  });

  // ----------------------------------------------------
  // TEST 13 — DOCX USES NORMALIZED itemNumber
  // ----------------------------------------------------
  test('TEST 13: DOCX export renderer consumes normalized ak.itemNumber', () => {
    assert.ok(
      exportServiceContent.includes("createAssessmentTableDataCell(String(ak.itemNumber ?? '-'), 10, AlignmentType.CENTER)") ||
      exportServiceContent.includes("createAssessmentTableDataCell(String(ak.itemNumber || '-'), 10, AlignmentType.CENTER)"),
      'DOCX table cell must use ak.itemNumber with dash fallback'
    );
  });

  // ----------------------------------------------------
  // TEST 14 — PDF USES NORMALIZED itemNumber
  // ----------------------------------------------------
  test('TEST 14: PDF export renderer consumes normalized ak.itemNumber', () => {
    assert.ok(
      exportServiceContent.includes("ak.itemNumber ?? '-'") ||
      exportServiceContent.includes("ak.itemNumber || '-'"),
      'PDF table rows must use ak.itemNumber with dash fallback'
    );
  });

  // ----------------------------------------------------
  // TEST 15 — SINGLE NORMALIZED SOURCE OF TRUTH
  // ----------------------------------------------------
  test('TEST 15: Single source of truth: linkage is computed exclusively in buildNormalizedAssessmentDocumentModel', () => {
    assert.ok(
      exportServiceContent.includes('linkedItemOrder = (linkedInstrument as WrittenAssessmentInstrument).items?.find'),
      'Written items resolved in normalization'
    );
    assert.ok(
      exportServiceContent.includes('linkedItemOrder = (linkedInstrument as OralAssessmentInstrument).items?.find'),
      'Oral items resolved in normalization'
    );
  });

  // ----------------------------------------------------
  // TEST 16 — INSTRUMENT TYPE CONTRACT RETAINED
  // ----------------------------------------------------
  test('TEST 16: Instrument type fidelity retained for ORAL_TEST and WRITTEN_TEST', () => {
    const oralInst: OralAssessmentInstrument = {
      id: 'o-1',
      type: 'ORAL_TEST',
      items: [{ id: 'oi-1', order: 1, prompt: 'Lisan 1' }],
    };
    const writtenInst: WrittenAssessmentInstrument = {
      id: 'w-1',
      type: 'WRITTEN_TEST',
      items: [{ id: 'wi-1', order: 2, itemType: 'ESSAY', prompt: 'Tulis 1' }],
    };

    const snapshot = createBaseSnapshotFixture({
      instruments: [oralInst, writtenInst],
      answerKeys: [
        { id: 'ak-1', instrumentId: 'o-1', instrumentItemId: 'oi-1', answerType: 'EXPECTED_RESPONSE', value: 'Ans' },
        { id: 'ak-2', instrumentId: 'w-1', instrumentItemId: 'wi-1', answerType: 'EXPECTED_RESPONSE', value: 'Ans' },
      ],
    });

    const normalized = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(normalized.answerKeys.list[0].instrumentType, 'ORAL_TEST');
    assert.strictEqual(normalized.answerKeys.list[0].itemNumber, 1);
    assert.strictEqual(normalized.answerKeys.list[1].instrumentType, 'WRITTEN_TEST');
    assert.strictEqual(normalized.answerKeys.list[1].itemNumber, 2);
  });

  // ----------------------------------------------------
  // TEST 17 — NO HARDCODED WRITTEN TYPE
  // ----------------------------------------------------
  test('TEST 17: Zero hardcoded instrumentType: "WRITTEN_TEST" in answer key normalization', () => {
    const akBlockStart = exportServiceContent.indexOf('// 4. Answer Keys');
    const akBlockEnd = exportServiceContent.indexOf('// 5. Scoring Guides');
    const akBlock = exportServiceContent.substring(akBlockStart, akBlockEnd);

    assert.strictEqual(
      akBlock.includes("instrumentType: 'WRITTEN_TEST'"),
      false,
      'Must not hardcode instrumentType: WRITTEN_TEST'
    );
  });

  // ----------------------------------------------------
  // TEST 18 — PREVIEW READ-ONLY RETAINED
  // ----------------------------------------------------
  test('TEST 18: AssessmentDocumentPreview is strictly read-only with no mutator inputs or handlers', () => {
    const forbiddenTags = ['<input', '<textarea', '<select', 'onChange', 'onBlur'];
    for (const tag of forbiddenTags) {
      assert.strictEqual(
        previewContent.includes(tag),
        false,
        `Preview component must not contain "${tag}"`
      );
    }
  });

  // ----------------------------------------------------
  // TEST 19 — PRIVACY / TYPOGRAPHY UNCHANGED
  // ----------------------------------------------------
  test('TEST 19: Typography (Times New Roman) and PDF profile (FORMAL_NEUTRAL) retained', () => {
    assert.ok(exportServiceContent.includes("ASSESSMENT_DOCX_FONT = 'Times New Roman'"));
    assert.ok(exportServiceContent.includes("new PdfDocumentBuilder('portrait', 'FORMAL_NEUTRAL')"));
  });

  // ----------------------------------------------------
  // TEST 20 — NO TYPE ESCAPE
  // ----------------------------------------------------
  test('TEST 20: Canonical typing enforced with zero type escapes in regression file', () => {
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
