import assert from 'node:assert';
import {
  AcademicEntityKind,
  getAcademicEntityScope,
  isAnnualEntity,
  isSemesterEntity,
} from '../src/services/academicScope';
import { validateDocumentRequirements } from '../src/services/documentEngine';
import { generatePdfDocument } from '../src/services/documentEngine/renderers/pdf/pdfDocGenerators';
import { generateATP } from '../src/services/documentEngine/generators/atpGenerator';
import { generateCP } from '../src/services/documentEngine/generators/cpGenerator';
import { generateTP } from '../src/services/documentEngine/generators/tpGenerator';
import { generatePROTA } from '../src/services/documentEngine/generators/protaGenerator';
import { generateZipBundle } from '../src/services/documentEngine/zipBundle';
import { DocumentGenerationContext } from '../src/services/documentEngine/types';
import {
  SchoolData,
  TeacherProfile,
  AcademicSetting,
  LearningPlan,
} from '../src/types';

console.log('=== RUNNING AUDIT: EXPORT BASELINE & SCOPE REGRESSION ===\n');

let totalTests = 0;
let passedTests = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] ${totalTests}. ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`[FAIL] ${totalTests}. ${name}:`, err.message);
    throw err;
  }
}

const mockSchool: SchoolData = {
  id: 'sch-1',
  name: 'SMP Negeri 1 Nusantara',
  npsn: '12345678',
  address: 'Jl. Pendidikan No. 1',
  village: 'Mekar',
  district: 'Kec. Cibinong',
  regency: 'Bogor',
  province: 'Jawa Barat',
  principalName: 'Dr. H. Ahmad Fauzi, M.Pd.',
  principalNip: '197001011995031001',
  createdAt: '2026-07-20T08:00:00Z',
  updatedAt: '2026-07-20T08:00:00Z',
};

const mockProfile: TeacherProfile = {
  id: 'prof-1',
  name: 'Budi Santoso, S.Pd.',
  nip: '198501012010011002',
  nuptk: '1234567890123456',
  status: 'PNS',
  defaultSubject: 'PJOK',
  defaultLevel: 'SMP',
  createdAt: '2026-07-20T08:00:00Z',
  updatedAt: '2026-07-20T08:00:00Z',
};

const mockSetting: AcademicSetting = {
  id: 'set-1',
  profileId: 'prof-1',
  academicYear: '2026/2027',
  semester: '1 (Ganjil)',
  curriculum: 'Kurikulum Merdeka',
  curriculumType: 'KURIKULUM_MERDEKA',
  level: 'SMP',
  grade: 'Kelas 7',
  phase: 'Fase D',
  subject: 'PJOK',
  updatedAt: '2026-07-20T08:00:00Z',
};

async function main() {
  // =========================================================================
  // TEST 1: Canonical academic scope only uses ACADEMIC_CALENDAR (CALENDAR removed)
  // =========================================================================
  await runTest('Canonical academic scope: uses ACADEMIC_CALENDAR and rejects legacy CALENDAR', () => {
    // ACADEMIC_CALENDAR must resolve to SEMESTER
    const calendarScope = getAcademicEntityScope('ACADEMIC_CALENDAR');
    assert.strictEqual(calendarScope, 'SEMESTER');
    assert.strictEqual(isSemesterEntity('ACADEMIC_CALENDAR'), true);
    assert.strictEqual(isAnnualEntity('ACADEMIC_CALENDAR'), false);

    // Casting invalid kind 'CALENDAR' must throw fail-closed error
    assert.throws(
      () => getAcademicEntityScope('CALENDAR' as any),
      /Unknown academic entity kind/,
      'Legacy alias CALENDAR must not exist in canonical registry'
    );
  });

  // =========================================================================
  // TEST 2: CP standalone validation fails-closed & does not fabricate dummy CP in data mode
  // =========================================================================
  await runTest('CP standalone: validation fails-closed (SKIPPED) when CP is empty in data mode', async () => {
    const emptyContext: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockSetting,
      documentMode: 'data',
      documentDate: '2026-07-20',
      cp: {
        id: 'cp-empty',
        academicSettingId: 'set-1',
        generalDescription: '',
        elements: [],
        updatedAt: '2026-07-20T08:00:00Z',
      },
    };

    const validation = validateDocumentRequirements('CP', emptyContext);
    assert.strictEqual(validation.isValid, false, 'Validation must fail when CP has no content');
    assert.ok(
      validation.missingFields.some((f) => f.includes('Capaian Pembelajaran (CP) belum tersedia')),
      'Must report missing CP content'
    );

    // Standalone generation in data mode must produce empty notice, never fake learning elements
    const pdfRes = await generatePdfDocument('CP', emptyContext);
    assert.ok(pdfRes.blob.size > 0);
    assert.ok(!pdfRes.title.includes('Semester'), 'CP document title must not assert semester authority');

    const docxRes = await generateCP({
      ...emptyContext,
      skipDownload: true,
    });
    assert.ok(docxRes.blob.size > 0);
    assert.ok(!docxRes.title.includes('Semester'), 'CP DOCX title must not assert semester authority');
  });

  // =========================================================================
  // TEST 3: TP standalone validation fails-closed & does not fabricate dummy TP in data mode
  // =========================================================================
  await runTest('TP standalone: validation fails-closed (SKIPPED) when TP is empty in data mode', async () => {
    const emptyTpContext: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockSetting,
      documentMode: 'data',
      documentDate: '2026-07-20',
      tp: {
        id: 'tp-empty',
        academicSettingId: 'set-1',
        updatedAt: '2026-07-20T08:00:00Z',
        items: [],
      },
    };

    const validation = validateDocumentRequirements('TP', emptyTpContext);
    assert.strictEqual(validation.isValid, false, 'Validation must fail when TP is empty');
    assert.ok(
      validation.missingFields.some((f) => f.includes('Tujuan Pembelajaran (TP) belum disusun')),
      'Must report missing TP items'
    );

    const pdfRes = await generatePdfDocument('TP', emptyTpContext);
    assert.ok(pdfRes.blob.size > 0);
    assert.ok(!pdfRes.title.includes('Semester'), 'TP document title must not assert semester authority');

    const docxRes = await generateTP({
      ...emptyTpContext,
      skipDownload: true,
    });
    assert.ok(docxRes.blob.size > 0);
    assert.ok(!docxRes.title.includes('Semester'), 'TP DOCX title must not assert semester authority');
  });

  // =========================================================================
  // TEST 4: ATP export does not use synthetic JP fallback (e.g. 72)
  // =========================================================================
  await runTest('ATP export: does not use synthetic JP fallback (72) when JP is unresolved', async () => {
    const atpContext: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockSetting,
      documentMode: 'data',
      documentDate: '2026-07-20',
      tp: {
        id: 'tp-1',
        academicSettingId: 'set-1',
        updatedAt: '2026-07-20T08:00:00Z',
        items: [
          {
            id: 'tp-item-1',
            order: 1,
            code: 'TP.7.1',
            statement: 'Mempraktikkan variasi pola gerak dasar lokomotor',
            competence: 'Mempraktikkan',
            contentScope: 'Pola Gerak Dasar',
            p3Dimensions: ['Mandiri', 'Gotong Royong'],
          },
        ],
      },
      atp: {
        id: 'atp-1',
        academicSettingId: 'set-1',
        updatedAt: '2026-07-20T08:00:00Z',
        totalJP: undefined, // Explicitly undefined!
        items: [
          {
            id: 'atp-item-1',
            stepNumber: 1,
            tpCode: 'TP.7.1',
            tpStatement: 'Mempraktikkan variasi pola gerak dasar lokomotor',
            materialScope: 'Pola Gerak Dasar',
            allocatedJP: null, // Explicitly null!
            jp: null,
            semester: null,
          },
        ],
      },
    };

    const pdfRes = await generatePdfDocument('ATP', atpContext);
    assert.ok(pdfRes.blob.size > 0);
    // Subtitle should say 'Belum ditetapkan', never '72 JP'
    assert.ok(!pdfRes.title.includes('72 JP'), 'ATP title must not contain synthetic 72 JP');

    const docxRes = await generateATP({
      ...atpContext,
      skipDownload: true,
    });
    assert.ok(docxRes.blob.size > 0);
  });

  // =========================================================================
  // TEST 5: Annual document titles do not contain hardcoded semester override
  // =========================================================================
  await runTest('Annual document titles: CP, TP, ATP, PROTA do not assert semester authority in title/subtitle', async () => {
    const fullContext: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: {
        ...mockSetting,
        semester: '1 (Ganjil)', // Should be ignored in annual document titles
      },
      documentMode: 'data',
      documentDate: '2026-07-20',
      cp: {
        id: 'cp-1',
        academicSettingId: 'set-1',
        generalDescription: 'Peserta didik dapat menganalisis keterampilan gerak.',
        elements: [{ id: 'elem-1', name: 'Keterampilan Gerak', content: 'Menganalisis keterampilan gerak' }],
        updatedAt: '2026-07-20T08:00:00Z',
      },
      tp: {
        id: 'tp-1',
        academicSettingId: 'set-1',
        updatedAt: '2026-07-20T08:00:00Z',
        items: [
          {
            id: 'tp-item-1',
            order: 1,
            code: 'TP.7.1',
            statement: 'Mempraktikkan variasi pola gerak dasar lokomotor',
            competence: 'Mempraktikkan',
            contentScope: 'Pola Gerak Dasar',
            p3Dimensions: ['Mandiri'],
          },
        ],
      },
      atp: {
        id: 'atp-1',
        academicSettingId: 'set-1',
        updatedAt: '2026-07-20T08:00:00Z',
        totalJP: 108,
        items: [
          {
            id: 'atp-item-1',
            stepNumber: 1,
            tpCode: 'TP.7.1',
            tpStatement: 'Mempraktikkan variasi gerak',
            allocatedJP: 6,
            semester: 1,
          },
          {
            id: 'atp-item-2',
            stepNumber: 2,
            tpCode: 'TP.7.2',
            tpStatement: 'Mempraktikkan variasi permainan bola besar',
            allocatedJP: null, // unassigned
            semester: null, // unassigned
          },
        ],
      },
    };

    // 1. CP PDF
    const cpPdf = await generatePdfDocument('CP', fullContext);
    assert.strictEqual(cpPdf.title.includes('Semester'), false, 'CP PDF title must not assert semester');

    // 2. TP PDF
    const tpPdf = await generatePdfDocument('TP', fullContext);
    assert.strictEqual(tpPdf.title.includes('Semester'), false, 'TP PDF title must not assert semester');

    // 3. ATP PDF
    const atpPdf = await generatePdfDocument('ATP', fullContext);
    assert.strictEqual(atpPdf.title.includes('Semester'), false, 'ATP PDF title must not assert semester');

    // 4. PROTA PDF
    const protaPdf = await generatePdfDocument('PROTA', fullContext);
    assert.strictEqual(protaPdf.title.includes('Semester'), false, 'PROTA PDF title must not assert semester');

    // 5. PROTA DOCX
    const protaDocx = await generatePROTA({
      ...fullContext,
      skipDownload: true,
    });
    assert.ok(protaDocx.blob.size > 0);
  });

  // =========================================================================
  // TEST 6: Multi-instance Modul Ajar produces unique entries in zip bundle
  // =========================================================================
  await runTest('Multi-instance export: Modul Ajar produces distinct entries with unique filenames in ZIP bundle', async () => {
    const plans: LearningPlan[] = [
      {
        id: 'lp-topic-1',
        academicSettingId: mockSetting.id!,
        curriculumType: 'KURIKULUM_MERDEKA',
        title: 'Modul Ajar Atletik',
        topic: 'Atletik dan Lari Jarak Pendek',
        status: 'SIAP',
        sourceType: 'MANUAL',
        confirmedAt: '2026-07-20T08:00:00Z',
        initialCompetency: 'Peserta didik memahami konsep gerak dasar.',
        graduateProfileDimensions: ['Kemandirian', 'Kolaborasi'],
        resources: [{ id: 'res-1', title: 'Buku Siswa PJOK Kelas 7' }],
        tpIds: ['tp-item-1'],
        atpItemIds: ['atp-item-1'],
        objectives: [
          {
            id: 'obj-1',
            tpId: 'tp-item-1',
            code: 'TP.7.1',
            statement: 'Mempraktikkan lari jarak pendek',
          },
        ],
        learningExperiences: [
          { id: 'exp-1-u', phase: 'UNDERSTAND', description: 'Memahami teknik start lari jarak pendek' },
          { id: 'exp-1-a', phase: 'APPLY', description: 'Mempraktikkan teknik lari di lintasan' },
          { id: 'exp-1-r', phase: 'REFLECT', description: 'Merefleksikan pencapaian waktu dan teknik' },
        ],
        assessmentPlan: {
          formative: [{ id: 'asm-1', type: 'FORMATIVE', description: 'Observasi Gerak', linkedTpIds: ['tp-item-1'] }],
        },
        learningModel: 'Problem Based Learning',
        createdAt: '2026-07-20T08:00:00Z',
        updatedAt: '2026-07-20T08:00:00Z',
      },
      {
        id: 'lp-topic-2',
        academicSettingId: mockSetting.id!,
        curriculumType: 'KURIKULUM_MERDEKA',
        title: 'Modul Ajar Bola Voli',
        topic: 'Permainan Bola Voli',
        status: 'SIAP',
        sourceType: 'MANUAL',
        confirmedAt: '2026-07-20T08:00:00Z',
        initialCompetency: 'Peserta didik mengenal permainan bola besar.',
        graduateProfileDimensions: ['Kemandirian', 'Kolaborasi'],
        resources: [{ id: 'res-2', title: 'Buku Siswa PJOK Kelas 7' }],
        tpIds: ['tp-item-2'],
        atpItemIds: ['atp-item-2'],
        objectives: [
          {
            id: 'obj-2',
            tpId: 'tp-item-2',
            code: 'TP.7.2',
            statement: 'Mempraktikkan passing bawah bola voli',
          },
        ],
        learningExperiences: [
          { id: 'exp-2-u', phase: 'UNDERSTAND', description: 'Memahami posisi lengan dan badan saat passing' },
          { id: 'exp-2-a', phase: 'APPLY', description: 'Mempraktikkan passing bawah berpasangan' },
          { id: 'exp-2-r', phase: 'REFLECT', description: 'Mengevaluasi akurasi passing bola voli' },
        ],
        assessmentPlan: {
          formative: [{ id: 'asm-2', type: 'FORMATIVE', description: 'Observasi Passing', linkedTpIds: ['tp-item-2'] }],
        },
        learningModel: 'Project Based Learning',
        createdAt: '2026-07-20T08:00:00Z',
        updatedAt: '2026-07-20T08:00:00Z',
      },
    ];

    const zipContext: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockSetting,
      documentMode: 'data',
      documentDate: '2026-07-20',
      learningPlans: plans,
      tp: {
        id: 'tp-1',
        academicSettingId: 'set-1',
        updatedAt: '2026-07-20T08:00:00Z',
        workflowStatus: 'SIAP',
        needsReview: false,
        items: [
          {
            id: 'tp-item-1',
            order: 1,
            code: 'TP.7.1',
            statement: 'Mempraktikkan lari jarak pendek',
            competence: 'Mempraktikkan',
            contentScope: 'Lari Jarak Pendek',
          },
          {
            id: 'tp-item-2',
            order: 2,
            code: 'TP.7.2',
            statement: 'Mempraktikkan passing bawah bola voli',
            competence: 'Mempraktikkan',
            contentScope: 'Bola Voli',
          },
        ],
      },
      atp: {
        id: 'atp-1',
        academicSettingId: 'set-1',
        tpId: 'tp-1',
        basedOnTpUpdatedAt: '2026-07-20T08:00:00Z',
        updatedAt: '2026-07-20T08:00:00Z',
        workflowStatus: 'SIAP',
        needsReview: false,
        items: [
          {
            id: 'atp-item-1',
            tpId: 'tp-item-1',
            stepNumber: 1,
            tpCode: 'TP.7.1',
            tpStatement: 'Mempraktikkan lari jarak pendek',
            allocatedJP: 6,
          },
          {
            id: 'atp-item-2',
            tpId: 'tp-item-2',
            stepNumber: 2,
            tpCode: 'TP.7.2',
            tpStatement: 'Mempraktikkan passing bawah bola voli',
            allocatedJP: 6,
          },
        ],
      },
    };

    const zipResult = await generateZipBundle(
      {
        types: ['MODUL_AJAR'],
        format: 'pdf',
        documentMode: 'data',
      },
      zipContext
    );

    assert.strictEqual(zipResult.success, true);
    assert.strictEqual(zipResult.exportedCount, 2, 'Must export both SIAP learning plans');

    const modulAjarItems = (zipResult.itemResults || []).filter((s) => s.type === 'MODUL_AJAR');
    assert.strictEqual(modulAjarItems.length, 2, 'Must have 2 Modul Ajar item statuses');

    // Check unique instanceId and instanceTitle
    assert.strictEqual(modulAjarItems[0].instanceId, 'lp-topic-1');
    assert.strictEqual(modulAjarItems[1].instanceId, 'lp-topic-2');
    assert.notStrictEqual(modulAjarItems[0].instanceTitle, modulAjarItems[1].instanceTitle);

    // Verify all generated files across instances are distinct
    const allFiles = modulAjarItems.flatMap((i) => i.filesGenerated || []);
    assert.strictEqual(allFiles.length, 2);
    assert.notStrictEqual(allFiles[0], allFiles[1], 'Generated file names must be unique');
  });

  console.log(`\n========================================`);
  console.log(`ALL EXPORT BASELINE REGRESSION TESTS PASSED (${passedTests}/${totalTests})`);
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error('Fatal error in testExportBaselineRegression:', err);
  process.exit(1);
});
