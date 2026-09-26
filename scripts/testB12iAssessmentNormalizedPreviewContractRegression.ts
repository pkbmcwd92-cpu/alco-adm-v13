import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import type { NormalizedAssessmentDocument } from '../src/types/assessmentExport';

console.log('=== B.1.2i NORMALIZED PREVIEW CONTRACT REGRESSION SUITE ===');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] ${name}:`, err.message);
    failed++;
  }
}

function runTests() {
  const previewPath = path.resolve('src/components/administration/AssessmentDocumentPreview.tsx');
  const previewContent = fs.readFileSync(previewPath, 'utf8');

  const exportTypesPath = path.resolve('src/types/assessmentExport.ts');
  const exportTypesContent = fs.readFileSync(exportTypesPath, 'utf8');

  const exportServicePath = path.resolve('src/services/documentEngine/assessmentExportService.ts');
  const exportServiceContent = fs.readFileSync(exportServicePath, 'utf8');

  // ----------------------------------------------------
  // TEST 1 — PREVIEW CONSUMES NORMALIZED TYPE
  // ----------------------------------------------------
  test('TEST 1: Preview source imports and consumes NormalizedAssessmentDocument', () => {
    assert.ok(
      previewContent.includes("import { NormalizedAssessmentDocument } from '../../types/assessmentExport'"),
      'Preview must import NormalizedAssessmentDocument'
    );
    assert.ok(
      previewContent.includes('model: NormalizedAssessmentDocument;'),
      'Props must type model as NormalizedAssessmentDocument'
    );
  });

  // ----------------------------------------------------
  // TEST 2 — NO item.itemNumber
  // ----------------------------------------------------
  test('TEST 2: Preview source does not contain item.itemNumber and uses canonical item.no', () => {
    assert.strictEqual(
      previewContent.includes('item.itemNumber'),
      false,
      'Preview must NOT reference item.itemNumber'
    );
    assert.ok(
      previewContent.includes('item.no'),
      'Preview must reference canonical item.no'
    );
  });

  // ----------------------------------------------------
  // TEST 3 — NO opt.key
  // ----------------------------------------------------
  test('TEST 3: Preview source does not contain opt.key and uses canonical opt.label', () => {
    assert.strictEqual(
      previewContent.includes('opt.key'),
      false,
      'Preview must NOT reference opt.key'
    );
    assert.ok(
      previewContent.includes('opt.label'),
      'Preview must reference canonical opt.label'
    );
  });

  // ----------------------------------------------------
  // TEST 4 — NO WRITTEN/ORAL/SELF-PEER ITEM ID DEPENDENCY
  // ----------------------------------------------------
  test('TEST 4: Preview does not depend on item.id for child item rendering and keys', () => {
    assert.strictEqual(
      previewContent.includes('item.id'),
      false,
      'Preview must NOT reference item.id for normalized item mapping'
    );
    assert.ok(
      previewContent.includes('inst.id'),
      'inst.id must be preserved as valid canonical identifier'
    );
  });

  // ----------------------------------------------------
  // TEST 5 — NO guide.id
  // ----------------------------------------------------
  test('TEST 5: Preview source does not contain guide.id', () => {
    assert.strictEqual(
      previewContent.includes('guide.id'),
      false,
      'Preview must NOT reference guide.id'
    );
  });

  // ----------------------------------------------------
  // TEST 6 — NO rub.id
  // ----------------------------------------------------
  test('TEST 6: Preview source does not contain rub.id', () => {
    assert.strictEqual(
      previewContent.includes('rub.id'),
      false,
      'Preview must NOT reference rub.id'
    );
  });

  // ----------------------------------------------------
  // TEST 7 — NO crit.id
  // ----------------------------------------------------
  test('TEST 7: Preview source does not contain crit.id', () => {
    assert.strictEqual(
      previewContent.includes('crit.id'),
      false,
      'Preview must NOT reference crit.id'
    );
  });

  // ----------------------------------------------------
  // TEST 8 — CANONICAL WRITTEN FIELDS
  // ----------------------------------------------------
  test('TEST 8: Written items use canonical fields (item.no, prompt, stimulus, item.itemType, opt.label, opt.text)', () => {
    assert.ok(previewContent.includes('item.no'), 'must use item.no');
    assert.ok(previewContent.includes('item.prompt'), 'must use item.prompt');
    assert.ok(previewContent.includes('item.stimulus'), 'must use item.stimulus');
    assert.ok(previewContent.includes('item.itemType'), 'must use item.itemType');
    assert.ok(previewContent.includes('opt.label'), 'must use opt.label');
    assert.ok(previewContent.includes('opt.text'), 'must use opt.text');
  });

  // ----------------------------------------------------
  // TEST 9 — CANONICAL ORAL FIELDS
  // ----------------------------------------------------
  test('TEST 9: Oral items use canonical fields (item.no, prompt, expectedResponse)', () => {
    assert.ok(previewContent.includes('item.no'), 'must use item.no');
    assert.ok(previewContent.includes('item.prompt'), 'must use item.prompt');
    assert.ok(previewContent.includes('item.expectedResponse'), 'must use item.expectedResponse');
  });

  // ----------------------------------------------------
  // TEST 10 — SCORING GUIDE FIELDS
  // ----------------------------------------------------
  test('TEST 10: Scoring guide uses canonical fields without requiring id', () => {
    assert.ok(previewContent.includes('guide.title'), 'must use guide.title');
    assert.ok(previewContent.includes('guide.guideType'), 'must use guide.guideType');
    assert.ok(previewContent.includes('guide.instructions'), 'must use guide.instructions');
    assert.ok(previewContent.includes('guide.maxScore'), 'must use guide.maxScore');
    assert.ok(previewContent.includes('guide.notes'), 'must use guide.notes');
    assert.strictEqual(previewContent.includes('guide.id'), false, 'must not use guide.id');
  });

  // ----------------------------------------------------
  // TEST 11 — RUBRIC FIELDS
  // ----------------------------------------------------
  test('TEST 11: Rubric uses canonical fields (rub.title, criteria, scale, crit.label, descriptors, weight)', () => {
    assert.ok(previewContent.includes('rub.title'), 'must use rub.title');
    assert.ok(previewContent.includes('rub.criteria'), 'must use rub.criteria');
    assert.ok(previewContent.includes('rub.scale'), 'must use rub.scale');
    assert.ok(previewContent.includes('crit.label'), 'must use crit.label');
    assert.ok(previewContent.includes('crit.descriptors'), 'must use crit.descriptors');
    assert.ok(previewContent.includes('crit.weight'), 'must use crit.weight');
  });

  // ----------------------------------------------------
  // TEST 12 — READ ONLY
  // ----------------------------------------------------
  test('TEST 12: AssessmentDocumentPreview is strictly read-only with no mutator inputs or handlers', () => {
    assert.strictEqual(previewContent.includes('<input'), false, 'must not have <input');
    assert.strictEqual(previewContent.includes('<textarea'), false, 'must not have <textarea');
    assert.strictEqual(previewContent.includes('<select'), false, 'must not have <select');
    assert.strictEqual(previewContent.includes('onChange='), false, 'must not have onChange=');
    assert.strictEqual(previewContent.includes('updatePackage('), false, 'must not have updatePackage(');
    assert.strictEqual(previewContent.includes('onSaveAssessmentPackage('), false, 'must not have onSaveAssessmentPackage(');
  });

  // ----------------------------------------------------
  // TEST 13 — ALL CANONICAL INSTRUMENT TYPES
  // ----------------------------------------------------
  test('TEST 13: Preview retains handling for all 10 canonical instrument types', () => {
    const requiredTypes = [
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
    for (const type of requiredTypes) {
      assert.ok(
        previewContent.includes(`inst.type === '${type}'`) ||
        previewContent.includes(`inst.type === '${type}' ||`),
        `Preview must handle instrument type: ${type}`
      );
    }
  });

  // ----------------------------------------------------
  // TEST 14 — STATUS CONTEXT RETAINED
  // ----------------------------------------------------
  test('TEST 14: Status banner context (workflowStatus: DRAFT | PERLU_DILENGKAPI | SIAP, needsReview) is retained', () => {
    assert.ok(
      previewContent.includes("workflowStatus: 'DRAFT' | 'PERLU_DILENGKAPI' | 'SIAP';"),
      'Preview must retain workflowStatus union type'
    );
    assert.ok(
      previewContent.includes('needsReview?: boolean;'),
      'Preview must retain needsReview prop'
    );
    assert.ok(previewContent.includes("workflowStatus === 'SIAP'"), 'must render SIAP state');
    assert.ok(previewContent.includes("workflowStatus === 'PERLU_DILENGKAPI'"), 'must render PERLU_DILENGKAPI state');
    assert.ok(previewContent.includes("workflowStatus === 'DRAFT'"), 'must render DRAFT state');
    assert.ok(previewContent.includes('needsReview &&'), 'must render needsReview notice');
  });

  // ----------------------------------------------------
  // TEST 15 — NO SCHEMA EXPANSION
  // ----------------------------------------------------
  test('TEST 15: assessmentExport.ts is unchanged and Normalized child types do not expand with redundant IDs', () => {
    // Check NormalizedWrittenItem has no id
    assert.ok(
      exportTypesContent.includes('export interface NormalizedWrittenItem {\n  no: number;\n  prompt: string;'),
      'NormalizedWrittenItem contract must remain unchanged'
    );
    // Check NormalizedOralItem has no id
    assert.ok(
      exportTypesContent.includes('export interface NormalizedOralItem {\n  no: number;\n  prompt: string;'),
      'NormalizedOralItem contract must remain unchanged'
    );
    // Check NormalizedAssessmentScoringGuide has no id
    assert.ok(
      exportTypesContent.includes('export interface NormalizedAssessmentScoringGuide {\n  title: string;'),
      'NormalizedAssessmentScoringGuide contract must remain unchanged'
    );
    // Check NormalizedAssessmentRubric has no id
    assert.ok(
      exportTypesContent.includes('export interface NormalizedAssessmentRubric {\n  title: string;'),
      'NormalizedAssessmentRubric contract must remain unchanged'
    );
    // Check NormalizedAssessmentRubricCriterion has no id
    assert.ok(
      exportTypesContent.includes('export interface NormalizedAssessmentRubricCriterion {\n  label: string;'),
      'NormalizedAssessmentRubricCriterion contract must remain unchanged'
    );
  });

  // ----------------------------------------------------
  // TEST 16 — EXISTING PREVIEW PIPELINE RETAINED
  // ----------------------------------------------------
  test('TEST 16: Preview pipeline (createAssessmentPreviewModel -> createAssessmentPreviewSnapshot -> buildNormalizedAssessmentDocumentModel) is preserved', () => {
    assert.ok(
      exportServiceContent.includes('export function createAssessmentPreviewModel('),
      'createAssessmentPreviewModel must be exported'
    );
    assert.ok(
      exportServiceContent.includes('createAssessmentPreviewSnapshot('),
      'createAssessmentPreviewSnapshot must be called'
    );
    assert.ok(
      exportServiceContent.includes('buildNormalizedAssessmentDocumentModel('),
      'buildNormalizedAssessmentDocumentModel must be used'
    );
  });

  // ----------------------------------------------------
  // TEST 17 — EXPORT PIPELINE UNCHANGED
  // ----------------------------------------------------
  test('TEST 17: DOCX and PDF export pipeline continues using buildNormalizedAssessmentDocumentModel', () => {
    assert.ok(
      exportServiceContent.includes('const model = buildNormalizedAssessmentDocumentModel(snapshot);'),
      'Export pipeline must build canonical normalized document model'
    );
    assert.ok(
      exportServiceContent.includes('renderAssessmentDocx(model)'),
      'DOCX renderer consumes canonical normalized model'
    );
    assert.ok(
      exportServiceContent.includes('renderAssessmentPdf(model)'),
      'PDF renderer consumes canonical normalized model'
    );
  });

  // ----------------------------------------------------
  // TEST 18 — TYPE CORRECT DUMMY MODEL COMPLIANCE
  // ----------------------------------------------------
  test('TEST 18: Complete canonical NormalizedAssessmentDocument dummy model conforms to type contract', () => {
    const dummyModel: NormalizedAssessmentDocument = {
      metadata: {
        title: 'PERANGKAT ASESMEN PEMBELAJARAN',
        subTitle: 'Paket Asesmen PJOK',
        schoolName: 'SD Negeri Nusantara',
        curriculum: 'MERDEKA',
        subject: 'PJOK',
        grade: '5',
        academicYear: '2026/2027',
        semester: '1',
        teacherName: 'Guru Penjas',
        formattedDocumentDate: '23 September 2026',
        isBlankMode: false,
        mode: 'CANONICAL_PACKAGE',
      },
      kisiKisi: {
        title: 'Kisi-Kisi Asesmen',
        rows: [
          {
            no: 1,
            tpCodeAndStatement: '[TP 10.1] Mempraktikkan pola gerak dasar',
            indicator: 'Siswa mampu menjelaskan teknik dasar',
            material: 'Pola Gerak Dasar',
            instrumentType: 'WRITTEN_TEST',
          },
        ],
      },
      instruments: {
        title: 'Instrumen Asesmen',
        list: [
          {
            id: 'inst-1',
            type: 'WRITTEN_TEST',
            typeLabel: 'Tes Tertulis',
            title: 'Tes Tertulis Penjas',
            writtenItems: [
              {
                no: 1,
                prompt: 'Apa fungsi pemanasan?',
                stimulus: 'Sebelum melakukan aktivitas fisik...',
                itemType: 'MULTIPLE_CHOICE',
                options: [
                  { label: 'A', text: 'Mencegah cedera' },
                  { label: 'B', text: 'Menambah lelah' },
                ],
              },
            ],
          },
          {
            id: 'inst-2',
            type: 'ORAL_TEST',
            typeLabel: 'Tes Lisan',
            title: 'Tes Lisan Aturan Permainan',
            oralItems: [
              {
                no: 1,
                prompt: 'Sebutkan 3 aturan sepak bola!',
                expectedResponse: 'Offside, lemparan ke dalam, kartu kuning/merah',
              },
            ],
          },
          {
            id: 'inst-3',
            type: 'PERFORMANCE',
            typeLabel: 'Kinerja / Praktik',
            title: 'Praktik Lari Cepat',
            task: 'Lakukan lari sprint 50 meter',
            instructions: 'Bersiap di garis start',
            performanceAspects: [
              { label: 'Start', weight: 30, description: 'Sikap start jongkok' },
              { label: 'Lari', weight: 70, description: 'Kecepatan dan ayunan lengan' },
            ],
          },
          {
            id: 'inst-4',
            type: 'OBSERVATION',
            typeLabel: 'Lembar Observasi',
            title: 'Observasi Perilaku Sportif',
            instructions: 'Amati selama permainan berlangsung',
            recordingScheme: 'Checklist',
            observationAspects: [
              { label: 'Menghargai lawan', indicator: 'Bersalaman setelah selesai' },
            ],
          },
          {
            id: 'inst-5',
            type: 'ASSIGNMENT',
            typeLabel: 'Penugasan',
            title: 'Tugas Analisis Pertandingan',
            instructions: 'Tonton pertandingan dan catat taktiknya',
            expectedOutput: 'Laporan ringkas 1 halaman',
          },
          {
            id: 'inst-6',
            type: 'PROJECT',
            typeLabel: 'Proyek',
            title: 'Proyek Pola Hidup Sehat',
            projectBrief: 'Rancang jadwal kebugaran 1 minggu',
            expectedDeliverable: 'Poster jadwal kebugaran',
          },
          {
            id: 'inst-7',
            type: 'PRODUCT',
            typeLabel: 'Produk',
            title: 'Video Teknik Push-Up',
            productBrief: 'Rekam video peragaan push-up yang benar',
            expectedProduct: 'Video berdurasi 60 detik',
          },
          {
            id: 'inst-8',
            type: 'PORTFOLIO',
            typeLabel: 'Portofolio',
            title: 'Kumpulan Lembar Kerja Penjas',
            instructions: 'Kumpulkan semua refleksi kebugaran',
            evidenceRequirements: ['Lembar refleksi', 'Log aktivitas fisik'],
          },
          {
            id: 'inst-9',
            type: 'SELF_ASSESSMENT',
            typeLabel: 'Penilaian Diri',
            title: 'Refleksi Diri Kebugaran',
            instructions: 'Isilah secara jujur',
            selfPeerItems: [
              { no: 1, statement: 'Saya rutin berolahraga', category: 'Kebiasaan' },
            ],
          },
          {
            id: 'inst-10',
            type: 'PEER_ASSESSMENT',
            typeLabel: 'Penilaian Antarteman',
            title: 'Penilaian Teman Saat Kerja Sama',
            instructions: 'Nilai teman sekelompokmu',
            selfPeerItems: [
              { no: 1, statement: 'Teman saya membantu tim', category: 'Kerjasama' },
            ],
          },
        ],
      },
      answerKeys: {
        title: 'Kunci Jawaban',
        list: [
          {
            itemNumber: 1,
            instrumentType: 'WRITTEN_TEST',
            answerType: 'OPTION',
            value: 'A',
            notes: 'Pemanasan mempersiapkan otot tubuh',
          },
        ],
      },
      scoringGuides: {
        title: 'Pedoman Penskoran',
        list: [
          {
            title: 'Pedoman Penskoran Pilihan Ganda',
            guideType: 'ANALYTIC',
            maxScore: 100,
            instructions: 'Setiap jawaban benar bernilai 100',
            notes: 'Nilai akhir = (Skor diperoleh / Skor maks) x 100',
          },
        ],
      },
      rubrics: {
        title: 'Rubrik Penilaian',
        list: [
          {
            title: 'Rubrik Kinerja Sprint',
            scale: [
              { label: 'Kurang', score: 1 },
              { label: 'Cukup', score: 2 },
              { label: 'Baik', score: 3 },
              { label: 'Sangat Baik', score: 4 },
            ],
            criteria: [
              {
                label: 'Teknik Start',
                descriptors: ['Tidak siap', 'Ragu-ragu', 'Cukup sigap', 'Sangat responsif'],
                weight: 40,
              },
            ],
          },
        ],
      },
      signoff: {
        locationAndDate: 'Semarang, 23 September 2026',
        principalTitle: 'Kepala Sekolah',
        principalName: 'Dra. Hj. Siti Rahayu, M.Pd.',
        principalNip: '197001011995032001',
        teacherTitle: 'Guru PJOK',
        teacherName: 'Ahmad Fauzi, S.Pd.',
        teacherNip: '198505052010011015',
        isBlankMode: false,
      },
    };

    assert.strictEqual(dummyModel.instruments.list.length, 10);
    assert.strictEqual(dummyModel.answerKeys.list[0].value, 'A');
    assert.strictEqual(dummyModel.scoringGuides.list[0].maxScore, 100);
    assert.strictEqual(dummyModel.rubrics.list[0].criteria[0].weight, 40);
  });

  console.log(`\nRegression results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
