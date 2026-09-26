import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  AssessmentPackage,
  SchoolData,
  TeacherProfile,
  AcademicSetting,
  AssessmentPlan,
} from '../src/types';
import {
  createAssessmentDocumentSnapshot,
  createAssessmentPreviewSnapshot,
  createAssessmentPreviewModel,
  checkAssessmentExportEligibility,
  buildNormalizedAssessmentDocumentModel,
  sanitizeAssessmentVisibleTitle,
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

  console.log('=== B.1.2h FINAL PRIVACY & TYPOGRAPHY REGRESSION SUITE ===\n');

  const generatorFilePath = path.resolve('src/services/assessmentPackageGeneratorService.ts');
  const exportServiceFilePath = path.resolve('src/services/documentEngine/assessmentExportService.ts');

  // ----------------------------------------------------
  // TEST 1 — GENERATOR CLEAN
  // ----------------------------------------------------
  test('TEST 1: Generator visible "(Draf AI)" suffix occurrence is 0', () => {
    const code = fs.readFileSync(generatorFilePath, 'utf8');
    const drafAiOccurrences = (code.match(/\(Draf AI\)/gi) || []).length;
    assert.strictEqual(
      drafAiOccurrences,
      0,
      `Expected 0 occurrences of "(Draf AI)" in generator service, found ${drafAiOccurrences}`
    );
  });

  // ----------------------------------------------------
  // TEST 2 — INTERNAL PROVENANCE RETAINED
  // ----------------------------------------------------
  test('TEST 2: Generator retains internal provenance (DRAFT, needsReview, generatedBy: AI)', () => {
    const code = fs.readFileSync(generatorFilePath, 'utf8');
    assert.ok(code.includes("workflowStatus: 'DRAFT'"), 'workflowStatus DRAFT must be retained in generator');
    assert.ok(code.includes('needsReview: true'), 'needsReview true must be retained in generator');
    assert.ok(code.includes("generatedBy: 'AI'"), "generatedBy: 'AI' must be retained in generator");
  });

  // Base snapshot fixture for normalization tests
  function createMockSnapshot(overrides: Partial<any> = {}) {
    return {
      snapshotId: 'snap-1',
      documentType: 'ASESMEN' as const,
      generatedAt: '2025-02-01T10:00:00.000Z',
      documentDate: '2025-02-01',
      formattedDocumentDate: '1 Februari 2025',
      academicSettingId: 'setting-1',
      academicYear: '2024/2025',
      semester: '1 (Ganjil)',
      grade: 'X',
      phase: 'E',
      subject: 'PJOK',
      curriculum: 'Kurikulum Merdeka',
      schoolName: 'SMA Bintang Bangsa',
      npsn: '12345678',
      schoolAddress: 'Jl. Merdeka No. 45',
      teacherName: 'Budi Santoso, S.Pd.',
      teacherNip: '198501012010011001',
      principalName: 'Drs. H. Mulyadi, M.Pd.',
      principalNip: '197001011995031002',
      assessmentPackageId: 'pkg-1',
      assessmentPackageRevision: 1,
      packageTitle: 'Perangkat Asesmen - PJOK',
      workflowStatus: 'SIAP',
      needsReview: false,
      provenance: { generatedBy: 'USER', generatedAt: '2025-02-01T10:00:00.000Z' },
      blueprintItems: [],
      resolvedObjectives: {},
      kisiKisiRows: [],
      instruments: [],
      answerKeys: [],
      scoringGuides: [],
      rubrics: [],
      documentMode: 'data' as const,
      mode: 'CANONICAL_PACKAGE' as const,
      ...overrides,
    };
  }

  // ----------------------------------------------------
  // TEST 3 — PACKAGE LEGACY TITLE
  // ----------------------------------------------------
  test('TEST 3: Package title with legacy "(Draf AI)" is sanitized during normalization', () => {
    const raw = 'Perangkat Asesmen - PJOK (Draf AI)';
    assert.strictEqual(sanitizeAssessmentVisibleTitle(raw), 'Perangkat Asesmen - PJOK');

    const snapshot = createMockSnapshot({ packageTitle: raw });
    const model = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(model.metadata.subTitle, 'Perangkat Asesmen - PJOK');
  });

  // ----------------------------------------------------
  // TEST 4 — INSTRUMENT LEGACY TITLE
  // ----------------------------------------------------
  test('TEST 4: Instrument title with "(Draf AI)" is sanitized', () => {
    const raw = 'Instrumen Tes Tertulis (Draf AI)';
    assert.strictEqual(sanitizeAssessmentVisibleTitle(raw), 'Instrumen Tes Tertulis');

    const snapshot = createMockSnapshot({
      instruments: [
        {
          id: 'inst-1',
          type: 'WRITTEN_TEST',
          title: raw,
          items: [],
        },
      ],
    });
    const model = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(model.instruments.list[0].title, 'Instrumen Tes Tertulis');
  });

  // ----------------------------------------------------
  // TEST 5 — RUBRIC LEGACY TITLE
  // ----------------------------------------------------
  test('TEST 5: Rubric title with "(Draf AI)" is sanitized', () => {
    const raw = 'Rubrik Proyek (Draf AI)';
    assert.strictEqual(sanitizeAssessmentVisibleTitle(raw), 'Rubrik Proyek');

    const snapshot = createMockSnapshot({
      rubrics: [
        {
          id: 'rub-1',
          title: raw,
          scale: [{ label: 'Baik', score: 3 }],
          criteria: [{ label: 'Kualitas', descriptors: ['Sangat baik'] }],
        },
      ],
    });
    const model = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(model.rubrics.list[0].title, 'Rubrik Proyek');
  });

  // ----------------------------------------------------
  // TEST 6 — SCORING GUIDE LEGACY TITLE
  // ----------------------------------------------------
  test('TEST 6: Scoring guide title with "- AI Draft" is sanitized', () => {
    const raw = 'Pedoman Penskoran - AI Draft';
    assert.strictEqual(sanitizeAssessmentVisibleTitle(raw), 'Pedoman Penskoran');

    const snapshot = createMockSnapshot({
      scoringGuides: [
        {
          id: 'sg-1',
          title: raw,
          guideType: 'OBJECTIVE',
        },
      ],
    });
    const model = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(model.scoringGuides.list[0].title, 'Pedoman Penskoran');
  });

  // ----------------------------------------------------
  // TEST 7 — BARE DRAF AI
  // ----------------------------------------------------
  test('TEST 7: Bare trailing "Draf AI" is sanitized', () => {
    const raw = 'Instrumen Tes Tertulis Draf AI';
    assert.strictEqual(sanitizeAssessmentVisibleTitle(raw), 'Instrumen Tes Tertulis');
  });

  // ----------------------------------------------------
  // TEST 8 — BARE DRAFT AI
  // ----------------------------------------------------
  test('TEST 8: Bare trailing "Draft AI" is sanitized', () => {
    const raw = 'Rubrik Produk Draft AI';
    assert.strictEqual(sanitizeAssessmentVisibleTitle(raw), 'Rubrik Produk');
  });

  // ----------------------------------------------------
  // TEST 9 — BARE AI DRAFT
  // ----------------------------------------------------
  test('TEST 9: Bare trailing "AI Draft" and "AI-Draft" are sanitized', () => {
    assert.strictEqual(sanitizeAssessmentVisibleTitle('Pedoman Penskoran AI Draft'), 'Pedoman Penskoran');
    assert.strictEqual(sanitizeAssessmentVisibleTitle('Pedoman Penskoran AI-Draft'), 'Pedoman Penskoran');
    assert.strictEqual(sanitizeAssessmentVisibleTitle('Rubrik Proyek Draft AI'), 'Rubrik Proyek');
  });

  // ----------------------------------------------------
  // TEST 10 — LEGITIMATE AI PRESERVED
  // ----------------------------------------------------
  test('TEST 10: Legitimate "Asesmen Literasi AI" title is preserved intact', () => {
    const raw = 'Asesmen Literasi AI';
    assert.strictEqual(sanitizeAssessmentVisibleTitle(raw), 'Asesmen Literasi AI');
  });

  // ----------------------------------------------------
  // TEST 11 — PEDAGOGICAL AI PRESERVED
  // ----------------------------------------------------
  test('TEST 11: Pedagogical phrases containing AI or Draft are preserved', () => {
    assert.strictEqual(
      sanitizeAssessmentVisibleTitle('Pemanfaatan AI dalam Pembelajaran'),
      'Pemanfaatan AI dalam Pembelajaran'
    );
    assert.strictEqual(
      sanitizeAssessmentVisibleTitle('Draft Rencana Pembelajaran'),
      'Draft Rencana Pembelajaran'
    );
  });

  // ----------------------------------------------------
  // TEST 12 — DOCX TIMES NEW ROMAN
  // ----------------------------------------------------
  test('TEST 12: DOCX export uses Times New Roman font and contains no Arial', () => {
    const exportCode = fs.readFileSync(exportServiceFilePath, 'utf8');
    assert.ok(
      exportCode.includes('Times New Roman'),
      'exportService must specify "Times New Roman" for DOCX export'
    );
    assert.strictEqual(
      exportCode.includes("font: 'Arial'") || exportCode.includes('font: "Arial"'),
      false,
      'exportService must not contain any "font: Arial" assignments'
    );
  });

  // ----------------------------------------------------
  // TEST 13 — DOCX NO LEGACY NAVY
  // ----------------------------------------------------
  test('TEST 13: DOCX export contains no legacy navy (1E3A8A) or stale slate colors', () => {
    const exportCode = fs.readFileSync(exportServiceFilePath, 'utf8');
    assert.strictEqual(exportCode.includes('1E3A8A'), false, 'Navy 1E3A8A must not be present');
    assert.strictEqual(exportCode.includes('475569'), false, 'Slate 475569 must not be present');
    assert.strictEqual(exportCode.includes('64748B'), false, 'Slate 64748B must not be present');
    assert.strictEqual(exportCode.includes('1E293B'), false, 'Slate 1E293B must not be present');
    assert.strictEqual(exportCode.includes('0F172A'), false, 'Slate 0F172A must not be present');
  });

  // ----------------------------------------------------
  // TEST 14 — DOCX TYPOGRAPHY CONTRACT
  // ----------------------------------------------------
  test('TEST 14: DOCX typography contract (title 14pt, heading 12pt, body 12pt, table 10pt, justified indent)', () => {
    const exportCode = fs.readFileSync(exportServiceFilePath, 'utf8');

    assert.ok(
      /FONT_SIZE_DOCX_TITLE\s*=\s*28/.test(exportCode),
      'Title font size must be 28 half-points (14 pt)'
    );
    assert.ok(
      /FONT_SIZE_DOCX_HEADING\s*=\s*24/.test(exportCode),
      'Heading font size must be 24 half-points (12 pt)'
    );
    assert.ok(
      /FONT_SIZE_DOCX_BODY\s*=\s*24/.test(exportCode),
      'Body font size must be 24 half-points (12 pt)'
    );
    assert.ok(
      /FONT_SIZE_DOCX_TABLE\s*=\s*20/.test(exportCode),
      'Table font size must be 20 half-points (10 pt)'
    );

    assert.ok(exportCode.includes('AlignmentType.JUSTIFIED'), 'Narrative must use AlignmentType.JUSTIFIED');
    assert.ok(
      /INDENT_FIRST_LINE_1_25CM\s*=\s*709/.test(exportCode) &&
      exportCode.includes('firstLine: INDENT_FIRST_LINE_1_25CM'),
      'Narrative must use first-line indent 709 dxa (1.25 cm)'
    );
    assert.ok(
      /LINE_SPACING_1_15\s*=\s*276/.test(exportCode) &&
      exportCode.includes('line: LINE_SPACING_1_15'),
      'Narrative must use line spacing 276 (1.15 multiple)'
    );
    assert.ok(
      /SPACING_AFTER_6PT\s*=\s*120/.test(exportCode) &&
      exportCode.includes('after: SPACING_AFTER_6PT'),
      'Narrative must use after spacing 120 (6 pt)'
    );
  });

  // ----------------------------------------------------
  // TEST 15 — DOCX LOCAL STYLE
  // ----------------------------------------------------
  test('TEST 15: DOCX assessment renderer uses dedicated local helpers, not generic shared helpers', () => {
    const exportCode = fs.readFileSync(exportServiceFilePath, 'utf8');
    assert.strictEqual(
      exportCode.includes('createDocumentHeader('),
      false,
      'Must not use shared createDocumentHeader in assessment renderer'
    );
    assert.strictEqual(
      exportCode.includes('createTableHeaderCell('),
      false,
      'Must not use shared createTableHeaderCell in assessment renderer'
    );
    assert.strictEqual(
      exportCode.includes('createTableDataCell('),
      false,
      'Must not use shared createTableDataCell in assessment renderer'
    );
  });

  // ----------------------------------------------------
  // TEST 16 — PDF FORMAL NEUTRAL
  // ----------------------------------------------------
  test('TEST 16: PDF renderer instantiates PdfDocumentBuilder with "FORMAL_NEUTRAL"', () => {
    const exportCode = fs.readFileSync(exportServiceFilePath, 'utf8');
    assert.ok(
      exportCode.includes("new PdfDocumentBuilder('portrait', 'FORMAL_NEUTRAL')"),
      'renderAssessmentPdf must instantiate PdfDocumentBuilder with FORMAL_NEUTRAL profile'
    );
  });

  // ----------------------------------------------------
  // TEST 17 — PDF LEGACY COLOR REMOVED
  // ----------------------------------------------------
  test('TEST 17: renderAssessmentPdf contains no legacy explicit color overrides', () => {
    const exportCode = fs.readFileSync(exportServiceFilePath, 'utf8');
    const renderPdfIndex = exportCode.indexOf('function renderAssessmentPdf(');
    assert.ok(renderPdfIndex !== -1, 'renderAssessmentPdf function must exist');
    const renderPdfBody = exportCode.slice(renderPdfIndex);

    assert.strictEqual(
      renderPdfBody.includes('[100, 116, 139]'),
      false,
      'renderAssessmentPdf must not override color with [100, 116, 139]'
    );
    assert.strictEqual(
      renderPdfBody.includes('[71, 85, 105]'),
      false,
      'renderAssessmentPdf must not override color with [71, 85, 105]'
    );
  });

  // ----------------------------------------------------
  // TEST 18 — EXPORT PIPELINE
  // ----------------------------------------------------
  test('TEST 18: Export pipeline enforces createAssessmentDocumentSnapshot -> buildNormalized -> renderer', () => {
    const exportCode = fs.readFileSync(exportServiceFilePath, 'utf8');
    assert.ok(
      exportCode.includes('export async function exportAssessmentDocx('),
      'exportAssessmentDocx must exist'
    );
    assert.ok(
      exportCode.includes('export async function exportAssessmentPdf('),
      'exportAssessmentPdf must exist'
    );

    const docxSection = exportCode.slice(exportCode.indexOf('export async function exportAssessmentDocx('));
    assert.ok(docxSection.includes('createAssessmentDocumentSnapshot(context, options)'));
    assert.ok(docxSection.includes('buildNormalizedAssessmentDocumentModel(snapshot)'));
    assert.ok(docxSection.includes('renderAssessmentDocx(model)'));

    const pdfSection = exportCode.slice(exportCode.indexOf('export async function exportAssessmentPdf('));
    assert.ok(pdfSection.includes('createAssessmentDocumentSnapshot(context, options)'));
    assert.ok(pdfSection.includes('buildNormalizedAssessmentDocumentModel(snapshot)'));
    assert.ok(pdfSection.includes('renderAssessmentPdf(model)'));
  });

  // ----------------------------------------------------
  // TEST 19 — PREVIEW PIPELINE
  // ----------------------------------------------------
  test('TEST 19: Preview pipeline uses createAssessmentPreviewSnapshot -> buildNormalizedAssessmentDocumentModel', () => {
    const exportCode = fs.readFileSync(exportServiceFilePath, 'utf8');
    assert.ok(
      exportCode.includes('export function createAssessmentPreviewModel('),
      'createAssessmentPreviewModel must exist'
    );
    const previewSection = exportCode.slice(exportCode.indexOf('export function createAssessmentPreviewModel('));
    assert.ok(previewSection.includes('createAssessmentPreviewSnapshot('));
    assert.ok(previewSection.includes('buildNormalizedAssessmentDocumentModel(snapshot)'));
  });

  // ----------------------------------------------------
  // TEST 20 — EXPORT ELIGIBILITY
  // ----------------------------------------------------
  test('TEST 20: checkAssessmentExportEligibility strictly blocks DRAFT and needsReview packages', () => {
    const exportCode = fs.readFileSync(exportServiceFilePath, 'utf8');
    assert.ok(
      exportCode.includes("resolvedPkg.workflowStatus !== 'SIAP'"),
      'Export eligibility must check that workflowStatus is SIAP'
    );
    assert.ok(
      exportCode.includes('resolvedPkg.needsReview'),
      'Export eligibility must check that needsReview is false'
    );

    const baseContext: DocumentGenerationContext = {
      academicSetting: {
        id: 'set-1',
        academicYear: '2024/2025',
        semester: '1 (Ganjil)',
        grade: 'X',
        phase: 'E',
        subject: 'PJOK',
        curriculum: 'Kurikulum Merdeka',
      } as AcademicSetting,
      school: {
        name: 'SMA Bintang Bangsa',
        npsn: '12345678',
        address: 'Jl. Merdeka',
        district: 'Gambir',
        regency: 'Jakarta Pusat',
        province: 'DKI Jakarta',
        principalName: 'Budi, M.Pd.',
      } as SchoolData,
      profile: {
        name: 'Siti, S.Pd.',
        nip: '19800101',
        status: 'PNS',
      } as TeacherProfile,
      activeAssessmentPackageId: 'pkg-draft',
      tp: {
        id: 'tp-data-1',
        academicSettingId: 'set-1',
        workflowStatus: 'SIAP',
        needsReview: false,
        items: [
          {
            id: 'tp-1',
            code: 'TP 10.1',
            statement: 'Memahami kebugaran jasmani',
            competence: 'Memahami',
            contentScope: 'Kebugaran',
            order: 1,
          },
        ],
        updatedAt: '2025-01-01',
      } as any,
      assessmentPlans: [
        {
          id: 'plan-1',
          academicSettingId: 'set-1',
          title: 'Rencana PJOK',
          purpose: 'SUMMATIVE',
          timing: 'POST',
          scopeType: 'TP',
          tpIds: ['tp-1'],
          criterionIds: [],
          workflowStatus: 'SIAP',
          instruments: [{ id: 'pi-1', type: 'WRITTEN_TEST', label: 'Tes Tertulis' }],
          needsReview: false,
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        } as any,
      ],
      assessmentPackages: [
        {
          id: 'pkg-draft',
          assessmentPlanId: 'plan-1',
          academicSettingId: 'set-1',
          title: 'Perangkat Draf',
          workflowStatus: 'DRAFT',
          needsReview: true,
          revision: 1,
          blueprintItems: [],
          instruments: [],
          answerKeys: [],
          scoringGuides: [],
          rubrics: [],
          provenance: { generatedBy: 'USER', generatedAt: '2025-01-01' },
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
      ],
    };

    const draftEligibility = checkAssessmentExportEligibility(baseContext);
    assert.strictEqual(draftEligibility.eligible, false, 'DRAFT package must not be eligible for export');
    assert.ok(
      draftEligibility.blockers.some((b) => b.includes('DRAFT')),
      'Must contain blocker regarding DRAFT status'
    );

    // needsReview blocker
    const needsReviewContext: DocumentGenerationContext = {
      ...baseContext,
      assessmentPackages: [
        {
          ...baseContext.assessmentPackages![0],
          workflowStatus: 'SIAP',
          needsReview: true,
        },
      ],
    };
    const needsReviewEligibility = checkAssessmentExportEligibility(needsReviewContext);
    assert.strictEqual(needsReviewEligibility.eligible, false, 'needsReview package must not be eligible');
    assert.ok(
      needsReviewEligibility.blockers.some((b) => b.includes('needsReview')),
      'Must contain blocker regarding needsReview'
    );

    // Eligible package
    const validContext: DocumentGenerationContext = {
      ...baseContext,
      assessmentPackages: [
        {
          ...baseContext.assessmentPackages![0],
          workflowStatus: 'SIAP',
          needsReview: false,
          blueprintItems: [
            {
              id: 'bp-1',
              objectiveRefId: 'tp-1',
              assessmentIndicator: 'Peserta didik memahami kebugaran jasmani.',
              materialOrContext: 'Kebugaran',
              instrumentType: 'WRITTEN_TEST',
              instrumentItemIds: ['item-1'],
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
                  id: 'item-1',
                  blueprintItemId: 'bp-1',
                  itemType: 'MULTIPLE_CHOICE',
                  prompt: 'Soal 1',
                  options: [
                    { id: 'opt-a', label: 'A', text: 'Jawaban A', isCorrect: true },
                    { id: 'opt-b', label: 'B', text: 'Jawaban B' },
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
              value: 'A',
            },
          ],
        },
      ],
    };
    const validEligibility = checkAssessmentExportEligibility(validContext);
    assert.strictEqual(validEligibility.eligible, true, 'Clean SIAP package must be eligible for export');
  });

  // ----------------------------------------------------
  // TEST 21 — OLD REGRESSION EXACT RESTORE
  // ----------------------------------------------------
  test('TEST 21: Restored regressions contain exact parent contract without contamination', () => {
    // 1. Audit No 9C.5 contains coverageUnitId: 'cu-oral-1'
    const audit9c5Path = path.resolve('scripts/testAuditNo9C5AssessmentValidationRegression.ts');
    const audit9c5Content = fs.readFileSync(audit9c5Path, 'utf8');
    assert.ok(
      audit9c5Content.includes("coverageUnitId: 'cu-oral-1'"),
      "testAuditNo9C5 must have coverageUnitId: 'cu-oral-1' restored"
    );

    // 2. B12e contains typed basePlan and contract, and canonical provenance
    const b12ePath = path.resolve('scripts/testB12eAssessmentContentFidelityRegression.ts');
    const b12eContent = fs.readFileSync(b12ePath, 'utf8');
    assert.ok(
      b12eContent.includes('const basePlan: AssessmentGenerationPlan = {'),
      'testB12e must have basePlan: AssessmentGenerationPlan'
    );
    assert.ok(
      b12eContent.includes('AssessmentGenerationContract'),
      'testB12e must have AssessmentGenerationContract'
    );
    assert.ok(
      b12eContent.includes("generatedBy: 'USER'"),
      "testB12e must retain canonical generatedBy: 'USER'"
    );

    // 3. B12g does not contain fixture type casts
    const b12gPath = path.resolve('scripts/testB12gAssessmentPreviewRegression.ts');
    const b12gContent = fs.readFileSync(b12gPath, 'utf8');
    assert.strictEqual(
      b12gContent.includes('as unknown as SchoolData'),
      false,
      'testB12g must not have "as unknown as SchoolData" cast'
    );
    assert.strictEqual(
      b12gContent.includes('as unknown as TeacherProfile'),
      false,
      'testB12g must not have "as unknown as TeacherProfile" cast'
    );
    assert.strictEqual(
      b12gContent.includes('as unknown as AcademicSetting'),
      false,
      'testB12g must not have "as unknown as AcademicSetting" cast'
    );
    assert.strictEqual(
      b12gContent.includes('as unknown as AssessmentPlan'),
      false,
      'testB12g must not have "as unknown as AssessmentPlan" cast'
    );
  });

  // ----------------------------------------------------
  // TEST 22 — COLON PRESERVED
  // ----------------------------------------------------
  test('TEST 22: Terminal colon in visible title is preserved', () => {
    assert.strictEqual(
      sanitizeAssessmentVisibleTitle('Instrumen Praktik:'),
      'Instrumen Praktik:'
    );
  });

  // ----------------------------------------------------
  // TEST 23 — HYPHEN PRESERVED
  // ----------------------------------------------------
  test('TEST 23: Terminal hyphen in visible title is preserved', () => {
    assert.strictEqual(
      sanitizeAssessmentVisibleTitle('Bab 1 -'),
      'Bab 1 -'
    );
  });

  // ----------------------------------------------------
  // TEST 24 — SLASH PRESERVED
  // ----------------------------------------------------
  test('TEST 24: Terminal slash in visible title is preserved', () => {
    assert.strictEqual(
      sanitizeAssessmentVisibleTitle('Rubrik /'),
      'Rubrik /'
    );
  });

  // ----------------------------------------------------
  // TEST 25 — PIPE PRESERVED
  // ----------------------------------------------------
  test('TEST 25: Terminal pipe in visible title is preserved', () => {
    assert.strictEqual(
      sanitizeAssessmentVisibleTitle('Instrumen |'),
      'Instrumen |'
    );
  });

  // ----------------------------------------------------
  // TEST 26 — AI MARKER WITH DELIMITER STILL CLEAN
  // ----------------------------------------------------
  test('TEST 26: AI draft marker with delimiter is still properly cleaned', () => {
    assert.strictEqual(
      sanitizeAssessmentVisibleTitle('Pedoman Penskoran - AI Draft'),
      'Pedoman Penskoran'
    );
  });

  // ----------------------------------------------------
  // TEST 27 — BARE AI MARKER STILL CLEAN
  // ----------------------------------------------------
  test('TEST 27: Bare AI draft marker is still properly cleaned', () => {
    assert.strictEqual(
      sanitizeAssessmentVisibleTitle('Pedoman Penskoran AI-Draft'),
      'Pedoman Penskoran'
    );
  });

  console.log(`\nRegression results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
