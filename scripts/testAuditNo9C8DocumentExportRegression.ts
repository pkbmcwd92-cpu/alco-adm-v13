import {
  AssessmentPackage,
  AssessmentPlan,
  AcademicSetting,
  SchoolData,
  TeacherProfile,
  TPData,
  AssessmentInstrument,
  AssessmentAnswerKey,
  AssessmentScoringGuide,
  AssessmentRubric,
} from '../src/types';
import { DocumentGenerationContext } from '../src/services/documentEngine/types';
import {
  checkAssessmentExportEligibility,
  createAssessmentDocumentSnapshot,
  buildNormalizedAssessmentDocumentModel,
  exportAssessmentDocx,
  exportAssessmentPdf,
  renderAssessmentDocx,
  renderAssessmentPdf,
  formatDocumentDate,
  isValidAssessmentPackageRevision,
  generateAssessmentDocumentFileName,
} from '../src/services/documentEngine/assessmentExportService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

let passedCount = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passedCount++;
    console.log(`[PASS] ${passedCount}. ${name}`);
  } catch (err: any) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// Fixtures
const mockSchool: SchoolData = {
  id: 'school-1',
  name: 'SMA Negeri 1 Nusantara',
  npsn: '12345678',
  address: 'Jl. Merdeka No. 45',
  village: 'Sukamaju',
  district: 'Cilandak',
  regency: 'Jakarta Selatan',
  province: 'DKI Jakarta',
  principalName: 'Drs. H. Ahmad Dahlan, M.Pd.',
  principalNip: '197001011995011001',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockProfile: TeacherProfile = {
  id: 'teacher-1',
  schoolId: 'school-1',
  name: 'Budi Santoso, S.Pd.',
  nip: '198502022010011002',
  status: 'PNS',
  defaultSubject: 'Informatika',
  defaultLevel: 'SMA',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockAcademicSetting: AcademicSetting = {
  id: 'setting-1',
  profileId: 'teacher-1',
  curriculum: 'Kurikulum Merdeka',
  curriculumType: 'KURIKULUM_MERDEKA',
  subject: 'Informatika',
  level: 'SMA',
  grade: 'Kelas 10',
  phase: 'Fase E',
  academicYear: '2025/2026',
  semester: '1 (Ganjil)',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockTP: TPData = {
  id: 'tp-data-1',
  academicSettingId: 'setting-1',
  workflowStatus: 'SIAP',
  needsReview: false,
  items: [
    {
      id: 'tp-1',
      code: 'TP 10.1',
      statement: 'Memahami konsep dasar algoritma dan pemrograman prosedural',
      competence: 'Memahami',
      contentScope: 'Algoritma dan Pemrograman',
      order: 1,
    },
    {
      id: 'tp-2',
      code: 'TP 10.2',
      statement: 'Menerapkan struktur kontrol percabangan dan perulangan dalam bahasa pemrograman',
      competence: 'Menerapkan',
      contentScope: 'Struktur Kontrol',
      order: 2,
    },
    {
      id: 'tp-3',
      code: 'TP 10.3',
      statement: 'Merancang proyek aplikasi sederhana',
      competence: 'Merancang',
      contentScope: 'Proyek',
      order: 3,
    },
  ],
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockPlan: AssessmentPlan = {
  id: 'plan-1',
  academicSettingId: 'setting-1',
  title: 'Rencana Asesmen Formatif & Sumatif Informatika',
  purpose: 'SUMMATIVE',
  timing: 'POST',
  scopeType: 'TP',
  tpIds: ['tp-1', 'tp-2', 'tp-3'],
  criterionIds: [],
  workflowStatus: 'SIAP',
  instruments: [{ id: 'pi-1', type: 'WRITTEN_TEST', label: 'Tes Tertulis' }],
  revision: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockValidSiapPackage: AssessmentPackage = {
  id: 'pkg-siap-1',
  assessmentPlanId: 'plan-1',
  academicSettingId: 'setting-1',
  title: 'Perangkat Asesmen Sumatif Informatika Kelas 10',
  workflowStatus: 'SIAP',
  needsReview: false,
  revision: 2,
  blueprintItems: [
    {
      id: 'bp-1',
      objectiveRefId: 'tp-1',
      assessmentIndicator: 'Peserta didik dapat mendefinisikan konsep variabel dan tipe data.',
      materialOrContext: 'Dasar Pemrograman',
      instrumentType: 'WRITTEN_TEST',
      instrumentItemIds: ['item-1'],
      order: 1,
    },
    {
      id: 'bp-2',
      objectiveRefId: 'tp-2',
      assessmentIndicator: 'Peserta didik dapat menyusun algoritma percabangan if-else.',
      materialOrContext: 'Percabangan',
      instrumentType: 'WRITTEN_TEST',
      instrumentItemIds: ['item-2'],
      order: 2,
    },
  ],
  instruments: [
    {
      id: 'inst-1',
      type: 'WRITTEN_TEST',
      title: 'Tes Tertulis Sumatif',
      instructions: 'Pilihlah jawaban yang paling tepat pada soal pilihan ganda berikut.',
      items: [
        {
          id: 'item-1',
          blueprintItemId: 'bp-1',
          itemType: 'MULTIPLE_CHOICE',
          prompt: 'Tipe data yang digunakan untuk menyimpan nilai logika benar/salah adalah...',
          options: [
            { id: 'opt-a', label: 'A', text: 'Integer' },
            { id: 'opt-b', label: 'B', text: 'Boolean', isCorrect: true },
            { id: 'opt-c', label: 'C', text: 'String' },
            { id: 'opt-d', label: 'D', text: 'Float' },
          ],
          order: 1,
        },
        {
          id: 'item-2',
          blueprintItemId: 'bp-2',
          itemType: 'SHORT_ANSWER',
          prompt: 'Sebutkan kata kunci yang digunakan untuk percabangan lebih dari dua kondisi!',
          order: 2,
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
      optionIds: ['opt-b'],
      value: 'B. Boolean',
      notes: 'Boolean adalah tipe data logika.',
    },
    {
      id: 'ak-2',
      instrumentId: 'inst-1',
      instrumentItemId: 'item-2',
      answerType: 'EXACT',
      value: 'elif / else if / switch',
      notes: 'Sintaks kondisional.',
    },
  ],
  scoringGuides: [
    {
      id: 'sg-1',
      title: 'Pedoman Penskoran Pilihan Ganda',
      instrumentId: 'inst-1',
      instrumentItemId: 'item-1',
      maxScore: 10,
      guideType: 'OBJECTIVE',
    },
    {
      id: 'sg-2',
      title: 'Pedoman Penskoran Isian Singkat',
      instrumentId: 'inst-1',
      instrumentItemId: 'item-2',
      maxScore: 10,
      guideType: 'MANUAL',
    },
  ],
  rubrics: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

async function runAudit9C8Regression() {
  console.log('\n=== AUDIT 9C.8 — DOCUMENT/EXPORT INTEGRATION REGRESSION ===\n');

  // Test 1: Check eligibility blocks DRAFT package
  await test('9C.8.1 — Export is strictly blocked when package workflowStatus is DRAFT', () => {
    const draftPackage: AssessmentPackage = {
      ...mockValidSiapPackage,
      id: 'pkg-draft',
      workflowStatus: 'DRAFT',
    };

    const context: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [draftPackage],
      documentDate: '2026-09-20',
    };

    const res = checkAssessmentExportEligibility(context);
    assert(!res.eligible, 'Must be ineligible for DRAFT package');
    assert(res.blockers.some((b) => b.includes('DRAFT')), 'Must explain DRAFT status in blockers');
  });

  // Test 2: Check eligibility blocks needsReview = true
  await test('9C.8.2 — Export is strictly blocked when needsReview is true', () => {
    const reviewNeededPackage: AssessmentPackage = {
      ...mockValidSiapPackage,
      id: 'pkg-review',
      workflowStatus: 'SIAP',
      needsReview: true,
    };

    const context: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [reviewNeededPackage],
      documentDate: '2026-09-20',
    };

    const res = checkAssessmentExportEligibility(context);
    assert(!res.eligible, 'Must be ineligible when needsReview is true');
    assert(res.blockers.some((b) => b.includes('needsReview')), 'Must explain needsReview in blockers');
  });

  // Test 3: Check eligibility blocks zero packages
  await test('9C.8.3 — Export is blocked when no assessment packages exist', () => {
    const context: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [],
      documentDate: '2026-09-20',
    };

    const res = checkAssessmentExportEligibility(context);
    assert(!res.eligible, 'Must be ineligible when no packages exist');
    assert(res.blockers.length > 0, 'Must have blocker message');
  });

  // Test 4: NO FIRST MATCH rule for ambiguous multiple SIAP packages
  await test('9C.8.4 — Ambiguous multiple SIAP packages are blocked if activeAssessmentPackageId is not specified (NO FIRST MATCH)', () => {
    const pkg1: AssessmentPackage = { ...mockValidSiapPackage, id: 'pkg-1', title: 'Paket 1' };
    const pkg2: AssessmentPackage = { ...mockValidSiapPackage, id: 'pkg-2', title: 'Paket 2' };

    const context: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [pkg1, pkg2],
      documentDate: '2026-09-20',
    };

    const res = checkAssessmentExportEligibility(context);
    assert(!res.eligible, 'Must be ineligible without explicit ID when multiple SIAP exist');
    assert(res.blockers.some((b) => b.includes('tanpa ID spesifik')), 'Must detect ambiguity');
  });

  // Test 5: Explicit activeAssessmentPackageId resolves cleanly
  await test('9C.8.5 — Explicit activeAssessmentPackageId resolves targeted package when multiple exist', () => {
    const pkg1: AssessmentPackage = { ...mockValidSiapPackage, id: 'pkg-1', title: 'Paket 1' };
    const pkg2: AssessmentPackage = { ...mockValidSiapPackage, id: 'pkg-2', title: 'Paket 2' };

    const context: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [pkg1, pkg2],
      activeAssessmentPackageId: 'pkg-2',
      documentDate: '2026-09-20',
    };

    const res = checkAssessmentExportEligibility(context);
    assert(res.eligible, 'Must be eligible with explicit valid ID');
    assert(res.package?.id === 'pkg-2', 'Must resolve pkg-2 exactly');
  });

  // Test 6: Canonical snapshot captures package identity and revision and detached semantic content
  await test('9C.8.6 — Canonical snapshot captures package identity, revision and detached semantic content', () => {
    const context: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [mockValidSiapPackage],
      documentDate: '2026-09-20',
    };

    const snapshot = createAssessmentDocumentSnapshot(context);
    assert(snapshot.mode === 'CANONICAL_PACKAGE', 'Snapshot mode must be CANONICAL_PACKAGE');
    assert(snapshot.assessmentPackageId === 'pkg-siap-1', 'Snapshot assessmentPackageId must match');
    assert(snapshot.assessmentPackageRevision === 2, 'Snapshot revision must match');
    assert(snapshot.blueprintItems.length === 2, 'Snapshot blueprint items must match');
    assert(snapshot.snapshotId && snapshot.snapshotId.length > 0, 'Snapshot must have snapshotId');
    assert(snapshot.resolvedObjectives['tp-1'] !== undefined, 'Snapshot must freeze resolved objectives');
  });

  // Test 7: Package revision is strictly stored and tracked in snapshot
  await test('9C.8.7 — Package revision is strictly stored and tracked in snapshot', () => {
    const rev4Package: AssessmentPackage = {
      ...mockValidSiapPackage,
      revision: 4,
    };

    const context: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [rev4Package],
      documentDate: '2026-09-20',
    };

    const snapshot = createAssessmentDocumentSnapshot(context);
    assert(snapshot.assessmentPackageRevision === 4, 'Snapshot must record exact revision 4');
  });

  // Test 8: Snapshot isolation: mutating live context after snapshot creation does NOT mutate snapshot
  await test('9C.8.8 — Snapshot isolation: modifying live package, school, profile, academicSetting after snapshot does NOT mutate snapshot', () => {
    const livePkg: AssessmentPackage = JSON.parse(JSON.stringify(mockValidSiapPackage));
    const liveSchool: SchoolData = JSON.parse(JSON.stringify(mockSchool));
    const liveProfile: TeacherProfile = JSON.parse(JSON.stringify(mockProfile));
    const liveAcademic: AcademicSetting = JSON.parse(JSON.stringify(mockAcademicSetting));

    const context: DocumentGenerationContext = {
      school: liveSchool,
      profile: liveProfile,
      academicSetting: liveAcademic,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [livePkg],
      documentDate: '2026-09-20',
    };

    const snapshot = createAssessmentDocumentSnapshot(context);

    // Mutate live objects
    livePkg.title = 'MUTATED TITLE';
    livePkg.blueprintItems[0].assessmentIndicator = 'MUTATED INDICATOR';
    (livePkg.instruments[0] as any).items[0].prompt = 'MUTATED PROMPT';
    liveSchool.name = 'MUTATED SCHOOL';
    liveProfile.name = 'MUTATED TEACHER';
    liveAcademic.subject = 'MUTATED SUBJECT';

    // Verify snapshot retains original frozen values
    assert(snapshot.packageTitle === 'Perangkat Asesmen Sumatif Informatika Kelas 10', 'Snapshot packageTitle must be immune to live mutation');
    assert(snapshot.blueprintItems[0].assessmentIndicator === 'Peserta didik dapat mendefinisikan konsep variabel dan tipe data.', 'Blueprint items must be immune to live mutation');
    assert((snapshot.instruments[0] as any).items[0].prompt === 'Tipe data yang digunakan untuk menyimpan nilai logika benar/salah adalah...', 'Instruments must be immune to live mutation');
    assert(snapshot.schoolName === 'SMA Negeri 1 Nusantara', 'School name must be immune to live mutation');
    assert(snapshot.teacherName === 'Budi Santoso, S.Pd.', 'Teacher name must be immune to live mutation');
    assert(snapshot.subject === 'Informatika', 'Subject must be immune to live mutation');
  });

  // Test 9: Revision traceability: Revision N snapshot vs Revision N+1 snapshot have distinct revisions
  await test('9C.8.9 — Revision traceability: Revision N snapshot vs Revision N+1 snapshot have distinct revisions and snapshot IDs', () => {
    const pkgRev3: AssessmentPackage = { ...mockValidSiapPackage, revision: 3 };
    const pkgRev4: AssessmentPackage = { ...mockValidSiapPackage, revision: 4 };

    const snap3 = createAssessmentDocumentSnapshot({
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [pkgRev3],
      documentDate: '2026-09-20',
    });

    const snap4 = createAssessmentDocumentSnapshot({
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [pkgRev4],
      documentDate: '2026-09-20',
    });

    assert(snap3.assessmentPackageRevision === 3, 'Snap3 must be revision 3');
    assert(snap4.assessmentPackageRevision === 4, 'Snap4 must be revision 4');
    assert(snap3.snapshotId !== snap4.snapshotId, 'Snapshot IDs must be distinct across revisions');
    assert(snap3.snapshotId.includes('-r3-'), 'Snapshot ID 3 must embed revision 3');
    assert(snap4.snapshotId.includes('-r4-'), 'Snapshot ID 4 must embed revision 4');
  });

  // Test 10: Future documentDate (e.g. 2030-01-15) is preserved exactly
  await test('9C.8.10 — Future documentDate (e.g. 2030-01-15) is strictly preserved without reverting to new Date()', () => {
    const futureDate = '2030-01-15';
    const context: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [mockValidSiapPackage],
      documentDate: futureDate,
    };

    const snapshot = createAssessmentDocumentSnapshot(context);
    assert(snapshot.documentDate === '2030-01-15', 'Raw documentDate must be 2030-01-15');
    assert(snapshot.formattedDocumentDate.includes('2030'), 'Formatted date must include year 2030');
    assert(snapshot.formattedDocumentDate.includes('15 Januari 2030'), 'Formatted date must be 15 Januari 2030');
  });

  // Test 11: Missing documentDate in canonical mode is blocked, while blank template allows empty documentDate
  await test('9C.8.11 — Missing documentDate in canonical mode throws error, while blank template allows empty documentDate', () => {
    const canonicalContextWithoutDate: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [mockValidSiapPackage],
      documentDate: undefined,
    };

    let canonicalThrew = false;
    try {
      createAssessmentDocumentSnapshot(canonicalContextWithoutDate);
    } catch (err: any) {
      canonicalThrew = true;
      assert(err.message.includes('documentDate'), 'Must report missing documentDate error');
    }
    assert(canonicalThrew, 'Canonical snapshot creation must throw when documentDate is missing');

    const blankContextWithoutDate: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      documentMode: 'blank',
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [],
      documentDate: undefined,
    };

    const blankSnap = createAssessmentDocumentSnapshot(blankContextWithoutDate);
    assert(blankSnap.mode === 'BLANK_TEMPLATE', 'Blank snapshot mode must be BLANK_TEMPLATE');
    assert(blankSnap.documentDate === undefined || blankSnap.documentDate === '', 'Blank snapshot documentDate can be empty');
  });

  // Test 12: Missing curriculum does NOT inject fake 'Kurikulum Merdeka' fallback
  await test('9C.8.12 — Missing curriculum leaves field empty and does NOT inject fake "Kurikulum Merdeka" fallback', () => {
    const settingWithoutCurriculum: AcademicSetting = {
      ...mockAcademicSetting,
      curriculum: '' as any,
    };

    const context: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: settingWithoutCurriculum,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [mockValidSiapPackage],
      documentDate: '2026-09-20',
    };

    const snapshot = createAssessmentDocumentSnapshot(context);
    const model = buildNormalizedAssessmentDocumentModel(snapshot);
    assert(snapshot.curriculum === '', 'Snapshot curriculum must not default to fake Kurikulum Merdeka');
    assert(model.metadata.curriculum === '', 'Model curriculum must not default to fake Kurikulum Merdeka');
  });

  // Test 13: No fake school/principal/NIP data is injected
  await test('9C.8.13 — No fake data: empty school/principal/NIP data is preserved as empty without fake placeholders', () => {
    const emptySchool: SchoolData = {
      id: 'school-empty',
      name: '',
      npsn: '',
      address: '',
      village: '',
      district: '',
      regency: '',
      province: '',
      principalName: '',
      principalNip: '',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    const emptyProfile: TeacherProfile = {
      id: 'teacher-empty',
      schoolId: 'school-empty',
      name: '',
      nip: '',
      status: 'Guru Tidak Tetap (GTT) / Honorer',
      defaultSubject: 'Informatika',
      defaultLevel: 'SMA',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    const context: DocumentGenerationContext = {
      school: emptySchool,
      profile: emptyProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [mockValidSiapPackage],
      documentDate: '2026-09-20',
    };

    const snapshot = createAssessmentDocumentSnapshot(context);
    const model = buildNormalizedAssessmentDocumentModel(snapshot);

    assert(snapshot.schoolName === '', 'School name must be empty string');
    assert(snapshot.principalName === '', 'Principal name must be empty string');
    assert(snapshot.principalNip === '', 'Principal NIP must be empty string');
    assert(model.signoff.principalName === '', 'Signoff principal name must be empty string');
    assert(model.signoff.teacherName === '', 'Signoff teacher name must be empty string');
  });

  // Test 14: Multi-instrument preservation
  await test('9C.8.14 — Multi-instrument preservation: WRITTEN_TEST, PERFORMANCE, OBSERVATION, ASSIGNMENT, PROJECT, PRODUCT, PORTFOLIO, ORAL_TEST, SELF_ASSESSMENT all preserved in normalized model', () => {
    const multiPlan: AssessmentPlan = {
      id: 'plan-multi',
      academicSettingId: 'setting-1',
      title: 'Rencana Asesmen Multi-Instrumen',
      purpose: 'SUMMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-1', 'tp-2', 'tp-3'],
      criterionIds: [],
      workflowStatus: 'SIAP',
      instruments: [
        { id: 'pi-1', type: 'WRITTEN_TEST', label: 'Tes Tertulis' },
        { id: 'pi-2', type: 'PERFORMANCE', label: 'Kinerja' },
        { id: 'pi-3', type: 'OBSERVATION', label: 'Observasi' },
        { id: 'pi-4', type: 'ASSIGNMENT', label: 'Penugasan' },
        { id: 'pi-5', type: 'PROJECT', label: 'Proyek' },
        { id: 'pi-6', type: 'PRODUCT', label: 'Produk' },
        { id: 'pi-7', type: 'PORTFOLIO', label: 'Portofolio' },
        { id: 'pi-8', type: 'ORAL_TEST', label: 'Tes Lisan' },
        { id: 'pi-9', type: 'SELF_ASSESSMENT', label: 'Penilaian Diri' },
      ],
      revision: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    const multiInstruments: AssessmentInstrument[] = [
      {
        id: 'inst-written',
        type: 'WRITTEN_TEST',
        title: 'Tes Tertulis',
        instructions: 'Kerjakan soal tertulis',
        items: [
          {
            id: 'wi-1',
            blueprintItemId: 'bp-multi-1',
            itemType: 'MULTIPLE_CHOICE',
            prompt: 'Soal 1',
            options: [
              { id: 'opt-1', label: 'A', text: 'Pilihan A' },
              { id: 'opt-2', label: 'B', text: 'Pilihan B', isCorrect: true },
            ],
            order: 1,
          },
        ],
      },
      {
        id: 'inst-perf',
        type: 'PERFORMANCE',
        title: 'Penilaian Kinerja',
        task: 'Demonstrasikan pembuatan algoritma sorting',
        aspects: [{ id: 'asp-1', label: 'Ketepatan Logika', description: 'Logika sorting benar' }],
      },
      {
        id: 'inst-obs',
        type: 'OBSERVATION',
        title: 'Lembar Observasi',
        aspects: [{ id: 'asp-obs', label: 'Kerjasama Kelompok', indicator: 'Aktif berdiskusi' }],
        recordingScheme: 'CHECKLIST',
      },
      {
        id: 'inst-assign',
        type: 'ASSIGNMENT',
        title: 'Tugas Rumah',
        instructions: 'Buat resume materi',
        expectedOutput: 'Dokumen PDF 2 halaman',
      },
      {
        id: 'inst-proj',
        type: 'PROJECT',
        title: 'Proyek Akhir',
        projectBrief: 'Membuat web sederhana',
        expectedDeliverable: 'Source code di GitHub',
      },
      {
        id: 'inst-prod',
        type: 'PRODUCT',
        title: 'Produk Karya',
        productBrief: 'Membuat infografis',
        expectedProduct: 'Poster infografis A3',
      },
      {
        id: 'inst-port',
        type: 'PORTFOLIO',
        title: 'Portofolio',
        instructions: 'Kumpulkan portofolio',
        evidenceRequirements: ['Laporan praktikum 1-5', 'Refleksi diri'],
      },
      {
        id: 'inst-oral',
        type: 'ORAL_TEST',
        title: 'Ujian Lisan',
        items: [{ id: 'oi-1', prompt: 'Jelaskan konsep looping', expectedResponse: 'Pengulangan instruksi', order: 1 }],
      },
      {
        id: 'inst-self',
        type: 'SELF_ASSESSMENT',
        title: 'Penilaian Diri',
        items: [{ id: 'si-1', statement: 'Saya memahami materi struktur data', category: 'Pemahaman' }],
      },
    ];

    const multiPkg: AssessmentPackage = {
      id: 'pkg-multi',
      assessmentPlanId: 'plan-multi',
      academicSettingId: 'setting-1',
      title: 'Perangkat Asesmen Lengkap 9 Instrumen',
      workflowStatus: 'SIAP',
      needsReview: false,
      revision: 1,
      blueprintItems: [
        {
          id: 'bp-multi-1',
          objectiveRefId: 'tp-1',
          assessmentIndicator: 'Peserta didik memahami algoritma.',
          materialOrContext: 'Dasar Pemrograman',
          instrumentType: 'WRITTEN_TEST',
          instrumentItemIds: ['wi-1'],
          order: 1,
        },
      ],
      instruments: multiInstruments,
      answerKeys: [
        {
          id: 'ak-multi-1',
          instrumentId: 'inst-written',
          instrumentItemId: 'wi-1',
          answerType: 'OPTION',
          optionIds: ['opt-2'],
          value: 'B. Pilihan B',
        },
      ],
      scoringGuides: [
        {
          id: 'sg-multi-1',
          title: 'Pedoman Penskoran Multi',
          instrumentId: 'inst-written',
          instrumentItemId: 'wi-1',
          maxScore: 10,
          guideType: 'OBJECTIVE',
        },
      ],
      rubrics: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    const context: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [multiPlan],
      assessmentPackages: [multiPkg],
      documentDate: '2026-09-20',
    };

    const snapshot = createAssessmentDocumentSnapshot(context);
    const model = buildNormalizedAssessmentDocumentModel(snapshot);

    assert(model.instruments.list.length === 9, 'Must preserve all 9 instruments');
    const typesInModel = model.instruments.list.map((i) => i.type);
    assert(typesInModel.includes('WRITTEN_TEST'), 'Must contain WRITTEN_TEST');
    assert(typesInModel.includes('PERFORMANCE'), 'Must contain PERFORMANCE');
    assert(typesInModel.includes('OBSERVATION'), 'Must contain OBSERVATION');
    assert(typesInModel.includes('ASSIGNMENT'), 'Must contain ASSIGNMENT');
    assert(typesInModel.includes('PROJECT'), 'Must contain PROJECT');
    assert(typesInModel.includes('PRODUCT'), 'Must contain PRODUCT');
    assert(typesInModel.includes('PORTFOLIO'), 'Must contain PORTFOLIO');
    assert(typesInModel.includes('ORAL_TEST'), 'Must contain ORAL_TEST');
    assert(typesInModel.includes('SELF_ASSESSMENT'), 'Must contain SELF_ASSESSMENT');
  });

  // Test 15: Blueprint item with dangling objectiveRefId is blocked from export
  await test('9C.8.15 — Blueprint item with dangling objectiveRefId is blocked from export', () => {
    const danglingPkg: AssessmentPackage = {
      ...mockValidSiapPackage,
      id: 'pkg-dangling',
      blueprintItems: [
        {
          id: 'bp-dangling',
          objectiveRefId: 'non-existent-tp-999',
          assessmentIndicator: 'Indikator dummy',
          instrumentType: 'WRITTEN_TEST',
          instrumentItemIds: [],
          order: 1,
        },
      ],
    };

    const context: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [danglingPkg],
      documentDate: '2026-09-20',
    };

    const res = checkAssessmentExportEligibility(context);
    assert(!res.eligible, 'Must be ineligible when blueprint has dangling TP reference');
    assert(res.blockers.some((b) => b.includes('non-existent-tp-999')), 'Must name dangling ID in blockers');
  });

  // Test 16: PASS-but-DRAFT package (valid structure but workflowStatus === 'DRAFT') is strictly blocked
  await test('9C.8.16 — PASS-but-DRAFT package (valid structure but workflowStatus === "DRAFT") is strictly blocked', () => {
    const passButDraftPackage: AssessmentPackage = {
      ...mockValidSiapPackage,
      id: 'pkg-pass-but-draft',
      workflowStatus: 'DRAFT',
    };

    const context: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [passButDraftPackage],
      documentDate: '2026-09-20',
    };

    const res = checkAssessmentExportEligibility(context);
    assert(!res.eligible, 'Must be ineligible even if structurally complete when workflowStatus is DRAFT');
    assert(res.blockers.some((b) => b.includes('DRAFT')), 'Must contain DRAFT blocker');
  });

  // Test 17: Blank template mode produces BLANK_TEMPLATE snapshot without fake package ID/revision/status
  await test('9C.8.17 — Blank template mode produces BLANK_TEMPLATE snapshot without fake package ID/revision/status', () => {
    const blankContext: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      documentMode: 'blank',
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [],
    };

    const blankSnap = createAssessmentDocumentSnapshot(blankContext);
    assert(blankSnap.mode === 'BLANK_TEMPLATE', 'Snapshot mode must be BLANK_TEMPLATE');
    assert(blankSnap.assessmentPackageId === undefined, 'Must not invent fake package ID');
    assert(blankSnap.assessmentPackageRevision === undefined, 'Must not invent fake package revision');
    assert(blankSnap.blueprintItems.length === 0, 'Blank snapshot must have 0 blueprint items');
    assert(blankSnap.instruments.length === 0, 'Blank snapshot must have 0 instruments');

    const model = buildNormalizedAssessmentDocumentModel(blankSnap);
    assert(model.metadata.isBlankMode === true, 'Model isBlankMode must be true');
    assert(model.metadata.packageId === undefined, 'Model packageId must be undefined');
    assert(model.metadata.packageRevision === undefined, 'Model packageRevision must be undefined');
    assert(model.kisiKisi.rows.length === 1, 'Blank model should contain 1 empty template row');
    assert(model.instruments.list.length === 0, 'Blank model instruments must be empty list');
  });

  // Test 18: DOCX renderer generates non-empty Blob and valid file name from normalized model
  await test('9C.8.18 — DOCX renderer generates non-empty Blob and valid file name from normalized model', async () => {
    const context: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [mockValidSiapPackage],
      documentDate: '2026-09-20',
    };

    const res = await exportAssessmentDocx(context);
    assert(Boolean(res.blob), 'Output blob must exist');
    assert((res.blob as any).size > 0 || (res.blob as any).length > 0, 'Blob must not be empty');
    assert(res.fileName.endsWith('.docx'), 'File name must end with .docx');
    assert(res.fileName.includes('Rev2'), 'File name must include revision');
    assert(res.snapshot.assessmentPackageId === 'pkg-siap-1', 'Snapshot must be attached');
  });

  // Test 19: PDF renderer generates non-empty Blob and valid file name from normalized model
  await test('9C.8.19 — PDF renderer generates non-empty Blob and valid file name from normalized model', async () => {
    const context: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [mockValidSiapPackage],
      documentDate: '2026-09-20',
    };

    const res = await exportAssessmentPdf(context);
    assert(Boolean(res.blob), 'Output blob must exist');
    assert((res.blob as any).size > 0 || (res.blob as any).length > 0, 'Blob must not be empty');
    assert(res.fileName.endsWith('.pdf'), 'File name must end with .pdf');
    assert(res.fileName.includes('Rev2'), 'File name must include revision');
    assert(res.snapshot.assessmentPackageId === 'pkg-siap-1', 'Snapshot must be attached');
  });

  // Test 20: DOCX and PDF sibling renderers consume identical semantic normalized model content
  await test('9C.8.20 — DOCX and PDF sibling renderers produce identical semantic normalized model content', async () => {
    const context: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [mockValidSiapPackage],
      documentDate: '2026-09-20',
    };

    const snapshot = createAssessmentDocumentSnapshot(context);
    const model = buildNormalizedAssessmentDocumentModel(snapshot);

    const docxBlob = await renderAssessmentDocx(model);
    const pdfBlob = renderAssessmentPdf(model);

    assert(Boolean(docxBlob), 'DOCX Blob must be produced');
    assert(Boolean(pdfBlob), 'PDF Blob must be produced');
    assert((docxBlob as any).size > 0 || (docxBlob as any).length > 0, 'DOCX blob must not be empty');
    assert((pdfBlob as any).size > 0 || (pdfBlob as any).length > 0, 'PDF blob must not be empty');
    assert(model.metadata.title === 'PERANGKAT ASESMEN PEMBELAJARAN', 'Semantic title must be shared');
    assert(model.kisiKisi.rows.length === 2, 'Kisi-kisi rows must be shared');
    assert(model.instruments.list.length === 1, 'Instruments must be shared');
    assert(model.answerKeys.list.length === 2, 'Answer keys must be shared');
    assert(model.scoringGuides.list.length === 2, 'Scoring guides must be shared');
  });

  // Test 21: Renderers do not fabricate fake domain defaults (no fake PNS, SMP, 1 (Ganjil), or Kurikulum Merdeka)
  await test('9C.8.21 — Renderers do not fabricate fake domain defaults (no fake PNS, SMP, 1 (Ganjil), or Kurikulum Merdeka)', async () => {
    const minimalBlankContext: DocumentGenerationContext = {
      school: { ...mockSchool, name: '' },
      profile: { ...mockProfile, name: '' },
      academicSetting: { ...mockAcademicSetting, curriculum: '', semester: '' as any, academicYear: '' },
      documentMode: 'blank',
    };

    const blankSnapshot = createAssessmentDocumentSnapshot(minimalBlankContext);
    const blankModel = buildNormalizedAssessmentDocumentModel(blankSnapshot);

    assert(blankModel.metadata.curriculum === '', 'Curriculum must not be fabricated in blank snapshot');
    assert(blankModel.metadata.semester === '', 'Semester must not be fabricated to 1 (Ganjil)');
    assert(blankModel.metadata.academicYear === '', 'AcademicYear must remain empty if missing');
    assert(blankModel.metadata.teacherName === '', 'Teacher name must remain empty if missing');

    const blankDocx = await renderAssessmentDocx(blankModel);
    const blankPdf = renderAssessmentPdf(blankModel);

    assert(Boolean(blankDocx), 'DOCX Blob must be produced without errors for blank model');
    assert(Boolean(blankPdf), 'PDF Blob must be produced without errors for blank model');

    // Also test canonical model with empty optional fields (e.g. non-PNS / missing NIP / missing phase / missing semester)
    const settingWithoutSemester: AcademicSetting = {
      ...mockAcademicSetting,
      semester: '' as any,
      phase: '',
    };

    const profileWithoutNipOrPns: TeacherProfile = {
      ...mockProfile,
      nip: '',
      status: 'HONORER' as any,
    };

    const canonicalContext: DocumentGenerationContext = {
      school: mockSchool,
      profile: profileWithoutNipOrPns,
      academicSetting: settingWithoutSemester,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [mockValidSiapPackage],
      documentDate: '2026-09-20',
    };

    const canSnap = createAssessmentDocumentSnapshot(canonicalContext);
    const canModel = buildNormalizedAssessmentDocumentModel(canSnap);

    assert(canModel.metadata.semester === '', 'Semester must not be fabricated to 1 (Ganjil)');
    assert(canModel.metadata.phase === '', 'Phase must remain empty if not set');

    const canDocx = await renderAssessmentDocx(canModel);
    const canPdf = renderAssessmentPdf(canModel);

    assert(Boolean(canDocx), 'Canonical DOCX Blob must be produced without errors');
    assert(Boolean(canPdf), 'Canonical PDF Blob must be produced without errors');
  });

  // Test 22: Canonical package revision is fail-closed (integer >= 1 required; rejects undefined, null, 0, -1, 1.5, NaN; allows 1, 2)
  await test('9C.8.22 — Canonical package revision is fail-closed (integer >= 1 required; rejects undefined, null, 0, -1, 1.5, NaN; allows 1, 2)', async () => {
    // 1. Direct unit verification of isValidAssessmentPackageRevision helper
    const invalidRevisions = [undefined, null, 0, -1, 1.5, NaN, '1', Infinity, -Infinity, {}];
    for (const inv of invalidRevisions) {
      assert(
        isValidAssessmentPackageRevision(inv) === false,
        `isValidAssessmentPackageRevision must return false for ${inv}`
      );
    }
    const validRevisions = [1, 2, 10, 100];
    for (const val of validRevisions) {
      assert(
        isValidAssessmentPackageRevision(val) === true,
        `isValidAssessmentPackageRevision must return true for ${val}`
      );
    }

    // 2. Test each invalid revision through checkAssessmentExportEligibility & createAssessmentDocumentSnapshot
    const explicitInvalidCases: { label: string; value: any }[] = [
      { label: 'undefined', value: undefined },
      { label: 'null', value: null },
      { label: '0', value: 0 },
      { label: '-1', value: -1 },
      { label: '1.5', value: 1.5 },
      { label: 'NaN', value: NaN },
    ];

    for (const { label, value } of explicitInvalidCases) {
      const invalidPkg: AssessmentPackage = {
        ...mockValidSiapPackage,
        id: `pkg-invalid-rev-${label}`,
        revision: value,
      };

      const ctx: DocumentGenerationContext = {
        school: mockSchool,
        profile: mockProfile,
        academicSetting: mockAcademicSetting,
        tp: mockTP,
        assessmentPlans: [mockPlan],
        assessmentPackages: [invalidPkg],
        documentDate: '2026-09-20',
      };

      const eligibility = checkAssessmentExportEligibility(ctx);
      assert(
        eligibility.eligible === false,
        `Revision ${label} must be BLOCKED by checkAssessmentExportEligibility`
      );
      assert(
        eligibility.blockers.some((b) => b.includes('nomor revisi tidak valid')),
        `Eligibility blockers for ${label} must cite invalid revision`
      );

      let snapshotThrew = false;
      try {
        createAssessmentDocumentSnapshot(ctx);
      } catch (err: any) {
        snapshotThrew = true;
        assert(
          err.message.toLowerCase().includes('nomor revisi tidak valid') ||
            (err.message.toLowerCase().includes('revisi') && err.message.toLowerCase().includes('tidak valid')),
          `createAssessmentDocumentSnapshot error for ${label} must cite invalid revision`
        );
      }
      assert(
        snapshotThrew,
        `createAssessmentDocumentSnapshot must throw on invalid package revision (${label})`
      );
    }

    // 3. Test that fractional revision 1.5 NEVER becomes "Rev1" or "Rev1.5" in canonical export filename
    let filenameThrewForFloat = false;
    try {
      const fabricatedFloatSnapshot: any = {
        mode: 'CANONICAL_PACKAGE',
        subject: 'Matematika',
        grade: '7',
        assessmentPackageRevision: 1.5,
      };
      const fileName = generateAssessmentDocumentFileName(fabricatedFloatSnapshot, 'docx');
      // If it somehow didn't throw, assert it didn't generate Rev1 or Rev1.5
      assert(!fileName.includes('Rev1.') && !fileName.includes('Rev1_'), `Filename must not be generated for float 1.5: ${fileName}`);
    } catch (err: any) {
      filenameThrewForFloat = true;
      assert(
        err.message.toLowerCase().includes('nomor revisi') || err.message.toLowerCase().includes('tidak valid'),
        'generateAssessmentDocumentFileName must fail-closed on float revision 1.5'
      );
    }
    assert(filenameThrewForFloat, 'generateAssessmentDocumentFileName must throw on float revision 1.5');

    // 4. Test that valid revisions (1, 2) succeed cleanly
    for (const validRev of [1, 2]) {
      const validPkg: AssessmentPackage = {
        ...mockValidSiapPackage,
        id: `pkg-valid-rev-${validRev}`,
        revision: validRev,
      };

      const validCtx: DocumentGenerationContext = {
        school: mockSchool,
        profile: mockProfile,
        academicSetting: mockAcademicSetting,
        tp: mockTP,
        assessmentPlans: [mockPlan],
        assessmentPackages: [validPkg],
        documentDate: '2026-09-20',
      };

      const eligibility = checkAssessmentExportEligibility(validCtx);
      assert(
        eligibility.eligible === true,
        `Valid revision ${validRev} must be eligible for export (blockers: ${eligibility.blockers.join(', ')})`
      );

      const snapshot = createAssessmentDocumentSnapshot(validCtx);
      assert(
        snapshot.assessmentPackageRevision === validRev,
        `Snapshot revision must strictly match ${validRev}`
      );

      const fileName = generateAssessmentDocumentFileName(snapshot, 'docx');
      assert(
        fileName.includes(`Rev${validRev}.docx`),
        `Filename must contain Rev${validRev}.docx (got: ${fileName})`
      );
    }
  });

  // Test 23: Missing TP/KD code resolution does not fabricate fake fallback 'TP' / 'KD' prefixes
  await test('9C.8.23 — Missing TP/KD code resolution does not fabricate fake fallback "TP" / "KD" prefixes', async () => {
    const tpWithoutCode: TPData = {
      id: 'tp-no-code',
      academicSettingId: 'setting-1',
      workflowStatus: 'SIAP',
      needsReview: false,
      items: [
        {
          id: 'tp-no-code-1',
          code: '', // Explicitly empty code
          statement: 'Mampu menganalisis struktur data grafik',
          competence: 'Menganalisis',
          contentScope: 'Struktur Data',
          order: 1,
        },
      ],
      updatedAt: '2026-01-01T00:00:00Z',
    };

    const pkgWithNoCodeTP: AssessmentPackage = {
      ...mockValidSiapPackage,
      id: 'pkg-tp-no-code',
      blueprintItems: [
        {
          id: 'bp-no-code',
          objectiveRefId: 'tp-no-code-1',
          assessmentIndicator: 'Siswa dapat menentukan derajat simpul grafik',
          materialOrContext: 'Grafik',
          instrumentType: 'WRITTEN_TEST',
          instrumentItemIds: [],
          order: 1,
        },
      ],
    };

    const contextNoCode: DocumentGenerationContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: tpWithoutCode,
      assessmentPlans: [mockPlan],
      assessmentPackages: [pkgWithNoCodeTP],
      documentDate: '2026-09-20',
    };

    const snapshot = createAssessmentDocumentSnapshot(contextNoCode);
    assert(snapshot.resolvedObjectives['tp-no-code-1'].code === '', 'Code must be empty string, not "TP"');

    const model = buildNormalizedAssessmentDocumentModel(snapshot);
    const row = model.kisiKisi.rows[0];
    assert(
      row.tpCodeAndStatement === 'Mampu menganalisis struktur data grafik',
      `tpCodeAndStatement must not contain [TP] prefix: got "${row.tpCodeAndStatement}"`
    );
    assert(!row.tpCodeAndStatement.includes('[TP]'), 'tpCodeAndStatement must not contain [TP]');
    assert(!row.tpCodeAndStatement.includes('[]'), 'tpCodeAndStatement must not contain empty brackets []');
  });

  // Test 24: Assessment inherits workspace.documentDate when context.documentDate is missing
  await test('9C.8.24 — Assessment inherits workspace.documentDate when context.documentDate is missing', async () => {
    const workspaceDateContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [mockValidSiapPackage],
      documentDate: undefined,
      workspace: {
        id: 'ws-assessment-date',
        profileId: 'teacher-1',
        schoolId: 'school-1',
        academicSettingId: 'setting-1',
        name: 'Informatika Kelas 10',
        documentDate: '2026-09-23',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    };

    const snap = createAssessmentDocumentSnapshot(workspaceDateContext as any);
    assert(snap.documentDate === '2026-09-23', 'Assessment inherits workspace.documentDate');
  });

  // Test 25: Live Assessment export documentDate precedence: options > context > workspace
  await test('9C.8.25 — Live Assessment export documentDate precedence: options > context > workspace', async () => {
    const precContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [mockValidSiapPackage],
      documentDate: '2026-09-20',
      workspace: {
        id: 'ws-assessment-date',
        profileId: 'teacher-1',
        schoolId: 'school-1',
        academicSettingId: 'setting-1',
        name: 'Informatika Kelas 10',
        documentDate: '2026-09-23',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    };

    const snapWithOptions = createAssessmentDocumentSnapshot(precContext as any, {
      documentMode: 'data',
      documentDate: '2026-09-18',
    });

    assert(snapWithOptions.documentDate === '2026-09-18', 'Live precedence uses options.documentDate over context and workspace');
  });

  // Test 26: Historical Assessment snapshot date beats live options/context/workspace
  await test('9C.8.26 — Historical Assessment snapshot date beats live options/context/workspace', async () => {
    const historicalContext = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [mockValidSiapPackage],
      documentDate: '2026-09-20',
      workspace: {
        id: 'ws-assessment-date',
        profileId: 'teacher-1',
        schoolId: 'school-1',
        academicSettingId: 'setting-1',
        name: 'Informatika Kelas 10',
        documentDate: '2026-09-23',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      snapshot: {
        documentDate: '2026-07-15',
        formattedDocumentDate: '15 Juli 2026',
      },
    };

    const snapHist = createAssessmentDocumentSnapshot(historicalContext as any, {
      documentMode: 'data',
      documentDate: '2026-09-18',
    });

    assert(snapHist.documentDate === '2026-07-15', 'Historical Assessment snapshot date beats live options/context/workspace');
  });

  // Test 27: Invalid calendar date in workspace blocks assessment snapshot creation
  await test('9C.8.27 — Invalid calendar date in workspace blocks assessment snapshot creation', async () => {
    const invalidDateCtx = {
      school: mockSchool,
      profile: mockProfile,
      academicSetting: mockAcademicSetting,
      tp: mockTP,
      assessmentPlans: [mockPlan],
      assessmentPackages: [mockValidSiapPackage],
      documentDate: undefined,
      workspace: {
        id: 'ws-invalid-date',
        profileId: 'teacher-1',
        schoolId: 'school-1',
        academicSettingId: 'setting-1',
        name: 'Informatika Kelas 10',
        documentDate: '2026-02-30',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    };

    let threw = false;
    try {
      createAssessmentDocumentSnapshot(invalidDateCtx as any);
    } catch (err: any) {
      threw = true;
      assert(
        err.message.includes('Tanggal Dokumen') || err.message.includes('Pengaturan Administrasi'),
        `Error message must mention Tanggal Dokumen or Pengaturan Administrasi: got "${err.message}"`
      );
    }
    assert(threw, 'createAssessmentDocumentSnapshot must throw on invalid calendar date 2026-02-30');
  });

  console.log(`\nAll ${passedCount} tests in Audit 9C.8 regression suite PASSED successfully!\n`);
}

runAudit9C8Regression().catch((err) => {
  console.error(err);
  process.exit(1);
});
