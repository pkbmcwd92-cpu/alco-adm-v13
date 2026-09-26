import {
  AcademicSetting,
  AssessmentCriterion,
  AssessmentPlan,
  AssessmentSourceContext,
  K13Analysis,
  TPData,
} from '../src/types';
import {
  resolveAssessmentGenerationSpec,
  getExplicitCurriculum,
} from '../src/services/assessmentGenerationSpecService';
import {
  resolveGrade,
  resolvePhaseForGrade,
  resolveAKMProgression,
  getGradeCalibrationProfile,
  createAssessmentGenerationProfile,
} from '../src/services/assessmentGenerationProfileService';
import { resolveSubjectAssessmentProfile } from '../src/services/subjectAssessmentProfileService';
import { mapObjectiveToEvidence } from '../src/services/assessmentEvidenceMapperService';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (detail) {
      console.error(`         Detail: ${detail}`);
    }
    failed++;
  }
}

async function runRegressionSuite() {
  console.log('=== STARTING AUDIT 9C.2 GENERATION SPEC REGRESSION TEST SUITE ===\n');

  // Baseline Mock Contexts
  const mockAcademicSettingSD4: AcademicSetting = {
    id: 'setting-sd-4',
    profileId: 'prof-1',
    curriculum: 'Kurikulum Merdeka',
    curriculumType: 'KURIKULUM_MERDEKA',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    level: 'SD',
    grade: 'Kelas 4',
    phase: 'Fase B',
    subject: 'Matematika',
    updatedAt: new Date().toISOString(),
  };

  const mockTPMat: TPData = {
    id: 'tp-data-mat',
    academicSettingId: 'setting-sd-4',
    items: [
      {
        id: 'tp-mat-1',
        code: 'TP-M1',
        tp: 'Memahami konsep pecahan senilai dan desimal dasar',
        order: 1,
      } as any,
      {
        id: 'tp-mat-2',
        code: 'TP-M2',
        tp: 'Menghitung operasi pembagian dan perkalian bilangan cacah',
        order: 2,
      } as any,
    ],
    updatedAt: new Date().toISOString(),
  };

  const mockPlanMatSiap: AssessmentPlan = {
    id: 'plan-mat-1',
    academicSettingId: 'setting-sd-4',
    title: 'Penilaian Sumatif Matematika Bab 1',
    purpose: 'SUMMATIVE',
    timing: 'POST',
    scopeType: 'TP',
    tpIds: ['tp-mat-1'],
    criterionIds: ['crit-mat-1'],
    instruments: [
      {
        id: 'inst-mat-1',
        type: 'WRITTEN_TEST',
      },
    ],
    workflowStatus: 'SIAP',
    revision: 1,
    provenance: {
      generatedBy: 'USER',
      generatedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockCriteriaMat: AssessmentCriterion[] = [
    {
      id: 'crit-mat-1',
      academicSettingId: 'setting-sd-4',
      tpId: 'tp-mat-1',
      description: 'Peserta didik mampu mengidentifikasi pecahan senilai',
      approach: 'deskripsi',
      indicators: ['Menyebutkan contoh pecahan senilai'],
      levels: [],
      updatedAt: new Date().toISOString(),
    },
  ];

  // ==========================================
  // TEST A: AssessmentPlan SIAP + valid context -> RESOLVED
  // ==========================================
  const specA = resolveAssessmentGenerationSpec({
    assessmentPlan: mockPlanMatSiap,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specA.resolution.status === 'RESOLVED' && specA.resolution.issues.length === 0,
    'Case A: AssessmentPlan SIAP + valid TP and Criteria resolves to RESOLVED',
    `status=${specA.resolution.status}, issues=${JSON.stringify(specA.resolution.issues)}`
  );

  // ==========================================
  // TEST B: AssessmentPlan DRAFT -> BLOCKED
  // ==========================================
  const planDraft: AssessmentPlan = { ...mockPlanMatSiap, workflowStatus: 'DRAFT' };
  const specB = resolveAssessmentGenerationSpec({
    assessmentPlan: planDraft,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specB.resolution.status === 'BLOCKED' &&
      specB.resolution.issues.some((i) => i.code === 'ASSESSMENT_PLAN_NOT_READY'),
    'Case B: AssessmentPlan in DRAFT status is BLOCKED with ASSESSMENT_PLAN_NOT_READY'
  );

  // ==========================================
  // TEST C: AssessmentPlan PERLU_DILENGKAPI -> BLOCKED
  // ==========================================
  const planPerlu: AssessmentPlan = { ...mockPlanMatSiap, workflowStatus: 'PERLU_DILENGKAPI' };
  const specC = resolveAssessmentGenerationSpec({
    assessmentPlan: planPerlu,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specC.resolution.status === 'BLOCKED' &&
      specC.resolution.issues.some((i) => i.code === 'ASSESSMENT_PLAN_NOT_READY'),
    'Case C: AssessmentPlan in PERLU_DILENGKAPI status is BLOCKED'
  );

  // ==========================================
  // TEST D: Curriculum unresolved -> BLOCKED
  // ==========================================
  const settingUnresolvedCurriculum: AcademicSetting = {
    ...mockAcademicSettingSD4,
    curriculum: '',
    curriculumType: undefined,
  };
  const specD = resolveAssessmentGenerationSpec({
    assessmentPlan: mockPlanMatSiap,
    academicSetting: settingUnresolvedCurriculum,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specD.resolution.status === 'BLOCKED' &&
      specD.resolution.issues.some((i) => i.code === 'CURRICULUM_UNRESOLVED'),
    'Case D: Unresolved curriculum is fail-closed and returns BLOCKED with CURRICULUM_UNRESOLVED'
  );

  // ==========================================
  // TEST E: Grade unresolved -> BLOCKED
  // ==========================================
  const settingInvalidGrade: AcademicSetting = {
    ...mockAcademicSettingSD4,
    grade: 'TK-A', // Tidak ada digit atau bukan kelas 1-12
  };
  const specE = resolveAssessmentGenerationSpec({
    assessmentPlan: mockPlanMatSiap,
    academicSetting: settingInvalidGrade,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specE.resolution.status === 'BLOCKED' &&
      specE.resolution.issues.some((i) => i.code === 'GRADE_UNRESOLVED'),
    'Case E: Unresolved grade (no numeric 1-12) is BLOCKED with GRADE_UNRESOLVED'
  );

  // ==========================================
  // TEST F: Subject unresolved -> BLOCKED
  // ==========================================
  const settingInvalidSubject: AcademicSetting = {
    ...mockAcademicSettingSD4,
    subject: '',
  };
  const specF = resolveAssessmentGenerationSpec({
    assessmentPlan: mockPlanMatSiap,
    academicSetting: settingInvalidSubject,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specF.resolution.status === 'BLOCKED' &&
      specF.resolution.issues.some((i) => i.code === 'SUBJECT_UNRESOLVED'),
    'Case F: Unresolved or empty subject is BLOCKED with SUBJECT_UNRESOLVED'
  );

  // ==========================================
  // TEST G: TP tidak ditemukan (dangling tpId) -> BLOCKED
  // ==========================================
  const planDanglingTP: AssessmentPlan = {
    ...mockPlanMatSiap,
    tpIds: ['tp-ghost-not-found'],
  };
  const specG = resolveAssessmentGenerationSpec({
    assessmentPlan: planDanglingTP,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specG.resolution.status === 'BLOCKED' &&
      specG.resolution.issues.some((i) => i.code === 'DANGLING_OBJECTIVE_REF'),
    'Case G: Dangling tpId in AssessmentPlan returns BLOCKED with DANGLING_OBJECTIVE_REF'
  );

  // ==========================================
  // TEST H: KD tidak ditemukan (dangling kdId) pada K13 -> BLOCKED
  // ==========================================
  const mockK13Setting: AcademicSetting = {
    ...mockAcademicSettingSD4,
    curriculum: 'Kurikulum 2013',
    curriculumType: 'K13',
  };
  const mockK13Analysis: K13Analysis = {
    id: 'k13-1',
    academicSettingId: mockK13Setting.id,
    items: [
      {
        id: 'kd-3.1',
        kdCode: '3.1',
        kdText: 'Memahami teks laporan hasil observasi',
      } as any,
    ],
    updatedAt: new Date().toISOString(),
  };
  const planDanglingKD: AssessmentPlan = {
    ...mockPlanMatSiap,
    tpIds: ['kd-ghost-99'],
  };
  const specH = resolveAssessmentGenerationSpec({
    assessmentPlan: planDanglingKD,
    academicSetting: mockK13Setting,
    k13Analysis: mockK13Analysis,
  });
  assert(
    specH.resolution.status === 'BLOCKED' &&
      specH.resolution.issues.some((i) => i.code === 'DANGLING_OBJECTIVE_REF'),
    'Case H: Dangling kdId in K13 plan returns BLOCKED with DANGLING_OBJECTIVE_REF'
  );

  // ==========================================
  // TEST I: KKTP criterion dangling -> BLOCKED
  // ==========================================
  const planDanglingCrit: AssessmentPlan = {
    ...mockPlanMatSiap,
    criterionIds: ['crit-ghost-999'],
  };
  const specI = resolveAssessmentGenerationSpec({
    assessmentPlan: planDanglingCrit,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specI.resolution.status === 'BLOCKED' &&
      specI.resolution.issues.some((i) => i.code === 'DANGLING_CRITERION_REF'),
    'Case I: Dangling criterionId returns BLOCKED with DANGLING_CRITERION_REF'
  );

  // ==========================================
  // TEST J: KKTP criterion milik TP lain -> BLOCKED
  // ==========================================
  const criteriaBelongsToOtherTP: AssessmentCriterion[] = [
    {
      id: 'crit-other-tp',
      academicSettingId: 'setting-sd-4',
      tpId: 'tp-other-foreign-tp', // Tidak ada di planMatSiap.tpIds
      description: 'Kriteria milik TP lain',
      approach: 'rubrik',
      indicators: [],
      levels: [],
      updatedAt: new Date().toISOString(),
    },
  ];
  const planOtherCrit: AssessmentPlan = {
    ...mockPlanMatSiap,
    criterionIds: ['crit-other-tp'],
  };
  const specJ = resolveAssessmentGenerationSpec({
    assessmentPlan: planOtherCrit,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: criteriaBelongsToOtherTP,
  });
  assert(
    specJ.resolution.status === 'BLOCKED' &&
      specJ.resolution.issues.some((i) => i.code === 'CRITERION_OBJECTIVE_MISMATCH'),
    'Case J: Criterion belonging to a different TP returns BLOCKED with CRITERION_OBJECTIVE_MISMATCH'
  );

  // ==========================================
  // TEST K: Missing criterion saat canonical optional -> tidak blocked
  // ==========================================
  const planNoCriteria: AssessmentPlan = {
    ...mockPlanMatSiap,
    criterionIds: [], // Guru tidak mencantumkan criterion khusus
  };
  const specK = resolveAssessmentGenerationSpec({
    assessmentPlan: planNoCriteria,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: [],
  });
  assert(
    specK.resolution.status === 'RESOLVED',
    'Case K: Optional criterion omission does NOT block resolution'
  );

  // ==========================================
  // TEST L: Planned instrument kosong -> BLOCKED
  // ==========================================
  const planNoInstruments: AssessmentPlan = {
    ...mockPlanMatSiap,
    instruments: [],
  };
  const specL = resolveAssessmentGenerationSpec({
    assessmentPlan: planNoInstruments,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specL.resolution.status === 'BLOCKED' &&
      specL.resolution.issues.some((i) => i.code === 'PLANNED_INSTRUMENT_EMPTY'),
    'Case L: AssessmentPlan without planned instruments is BLOCKED with PLANNED_INSTRUMENT_EMPTY'
  );

  // ==========================================
  // TEST M: Recommendation mismatch dengan AssessmentPlan -> NEEDS_REVIEW, plan tidak termutasi
  // ==========================================
  // Contoh: TP PJOK motorik direkomendasikan PERFORMANCE, tapi di plan guru memasang WRITTEN_TEST
  const settingPJOK: AcademicSetting = {
    ...mockAcademicSettingSD4,
    subject: 'Pendidikan Jasmani, Olahraga, dan Kesehatan',
  };
  const tpPjokMotorik: TPData = {
    id: 'tp-pjok',
    academicSettingId: settingPJOK.id,
    items: [
      {
        id: 'tp-p-1',
        code: 'TP-PJOK-1',
        tp: 'Mempraktikkan variasi gerak dasar lokomotor dan manipulatif menendang bola',
        order: 1,
      } as any,
    ],
    updatedAt: new Date().toISOString(),
  };
  const planPjokMismatch: AssessmentPlan = {
    id: 'plan-pjok-mismatch',
    academicSettingId: settingPJOK.id,
    title: 'Penilaian PJOK Motorik',
    purpose: 'SUMMATIVE',
    timing: 'POST',
    scopeType: 'TP',
    tpIds: ['tp-p-1'],
    criterionIds: [],
    instruments: [
      {
        id: 'inst-pjok-1',
        type: 'WRITTEN_TEST', // Mismatch dengan rekomendasi psikomotor PJOK
      },
    ],
    workflowStatus: 'SIAP',
    revision: 1,
    provenance: { generatedBy: 'USER', generatedAt: new Date().toISOString() },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const initialPlanSnapshot = JSON.stringify(planPjokMismatch);
  const specM = resolveAssessmentGenerationSpec({
    assessmentPlan: planPjokMismatch,
    academicSetting: settingPJOK,
    tp: tpPjokMotorik,
  });

  assert(
    specM.resolution.status === 'NEEDS_REVIEW' &&
      specM.resolution.issues.some((i) => i.code === 'INSTRUMENT_RECOMMENDATION_MISMATCH') &&
      JSON.stringify(planPjokMismatch) === initialPlanSnapshot &&
      specM.plannedInstrumentTypes.includes('WRITTEN_TEST'),
    'Case M: Instrument recommendation mismatch triggers NEEDS_REVIEW and preserves original plan without mutation'
  );

  // ==========================================
  // TEST N: Mapel spesifik PJOK: TP motorik merekomendasikan PERFORMANCE / OBSERVATION
  // ==========================================
  const pjokProfile = resolveSubjectAssessmentProfile('PJOK');
  const recMotor = mapObjectiveToEvidence({
    objective: { id: 'tp-1', sourceType: 'TP', text: 'Mempraktikkan variasi gerak dasar senam lantai', criterionIds: [] },
    subjectProfile: pjokProfile,
  });
  assert(
    recMotor.evidenceTypes.includes('PERFORMANCE') &&
      recMotor.recommendedInstrumentTypes.includes('PERFORMANCE'),
    'Case N: PJOK psychomotor competence recommends PERFORMANCE / OBSERVATION'
  );

  // ==========================================
  // TEST O: Mapel spesifik PJOK: TP pemahaman aturan merekomendasikan WRITTEN_TEST / ORAL_TEST
  // ==========================================
  const recKnowledge = mapObjectiveToEvidence({
    objective: { id: 'tp-2', sourceType: 'TP', text: 'Menjelaskan peraturan permainan bola voli dan prosedur keselamatan', criterionIds: [] },
    subjectProfile: pjokProfile,
  });
  assert(
    recKnowledge.evidenceTypes.includes('KNOWLEDGE_RESPONSE') &&
      recKnowledge.recommendedInstrumentTypes.includes('WRITTEN_TEST'),
    'Case O: PJOK rules knowledge competence recommends WRITTEN_TEST / ORAL_TEST (does not force performance)'
  );

  // ==========================================
  // TEST P: Mapel spesifik Bahasa Indonesia: 4 domain
  // ==========================================
  const bindoProfile = resolveSubjectAssessmentProfile('Bahasa Indonesia');
  const recMembaca = mapObjectiveToEvidence({
    objective: { id: 'b-1', sourceType: 'TP', text: 'Membaca dan menemukan informasi tersurat dan tersirat dalam teks narasi', criterionIds: [] },
    subjectProfile: bindoProfile,
  });
  const recMenulis = mapObjectiveToEvidence({
    objective: { id: 'b-2', sourceType: 'TP', text: 'Menulis teks deskripsi dengan struktur paragraf yang koheren', criterionIds: [] },
    subjectProfile: bindoProfile,
  });
  const recBicara = mapObjectiveToEvidence({
    objective: { id: 'b-3', sourceType: 'TP', text: 'Berbicara dan mempresentasikan gagasan dalam diskusi kelompok', criterionIds: [] },
    subjectProfile: bindoProfile,
  });
  const recSimak = mapObjectiveToEvidence({
    objective: { id: 'b-4', sourceType: 'TP', text: 'Menyimak rekaman dongeng dan mendengarkan instruksi guru', criterionIds: [] },
    subjectProfile: bindoProfile,
  });

  assert(
    recMembaca.recommendedInstrumentTypes.includes('WRITTEN_TEST') &&
      recMenulis.recommendedInstrumentTypes.includes('PRODUCT') &&
      recBicara.recommendedInstrumentTypes.includes('ORAL_TEST') &&
      recSimak.evidenceTypes.includes('ORAL_RESPONSE'),
    'Case P: Bahasa Indonesia correctly differentiates reading, writing, speaking, and listening competencies'
  );

  // ==========================================
  // TEST Q: Mapel spesifik Matematika: konsep vs prosedur vs penalaran vs problem solving
  // ==========================================
  const matProfile = resolveSubjectAssessmentProfile('Matematika');
  const recMatKonsep = mapObjectiveToEvidence({
    objective: { id: 'm-1', sourceType: 'TP', text: 'Memahami konsep pecahan senilai dan sifat bangun datar', criterionIds: [] },
    subjectProfile: matProfile,
  });
  const recMatProsedur = mapObjectiveToEvidence({
    objective: { id: 'm-2', sourceType: 'TP', text: 'Menghitung operasi hitung pembagian pecahan campuran', criterionIds: [] },
    subjectProfile: matProfile,
  });
  const recMatNalar = mapObjectiveToEvidence({
    objective: { id: 'm-3', sourceType: 'TP', text: 'Menjelaskan alasan dan membuktikan kebenaran sifat segitiga sama sisi', criterionIds: [] },
    subjectProfile: matProfile,
  });
  const recMatProblem = mapObjectiveToEvidence({
    objective: { id: 'm-4', sourceType: 'TP', text: 'Memecahkan masalah kontekstual dan soal cerita transaksi jual beli', criterionIds: [] },
    subjectProfile: matProfile,
  });

  assert(
    recMatKonsep.recommendedInstrumentTypes.includes('WRITTEN_TEST') &&
      recMatProsedur.evidenceTypes.includes('KNOWLEDGE_RESPONSE') &&
      recMatNalar.evidenceTypes.includes('REASONING') &&
      recMatProblem.evidenceTypes.includes('REASONING'),
    'Case Q: Matematika correctly identifies conceptual, procedural, reasoning, and problem solving'
  );

  // ==========================================
  // TEST R: Mapel spesifik IPA/IPAS: inkuiri vs eksplanasi kausal vs observasi
  // ==========================================
  const ipasProfile = resolveSubjectAssessmentProfile('IPAS');
  const recIpasInkuiri = mapObjectiveToEvidence({
    objective: { id: 'i-1', sourceType: 'TP', text: 'Melakukan percobaan menyelidiki perpindahan kalor secara konduksi', criterionIds: [] },
    subjectProfile: ipasProfile,
  });
  const recIpasKausal = mapObjectiveToEvidence({
    objective: { id: 'i-2', sourceType: 'TP', text: 'Menjelaskan hubungan sebab akibat terjadinya siklus air dan hujan', criterionIds: [] },
    subjectProfile: ipasProfile,
  });
  const recIpasObs = mapObjectiveToEvidence({
    objective: { id: 'i-3', sourceType: 'TP', text: 'Mengamati dan mengidentifikasi bagian tubuh serangga di lingkungan sekitar', criterionIds: [] },
    subjectProfile: ipasProfile,
  });

  assert(
    recIpasInkuiri.recommendedInstrumentTypes.includes('PERFORMANCE') &&
      recIpasKausal.evidenceTypes.includes('REASONING') &&
      recIpasObs.evidenceTypes.includes('OBSERVATION'),
    'Case R: IPA/IPAS differentiates scientific inquiry, causal reasoning, and phenomenon observation'
  );

  // ==========================================
  // TEST S: Mapel spesifik Pendidikan Pancasila: nilai vs studi kasus vs refleksi vs gotong royong
  // ==========================================
  const pknProfile = resolveSubjectAssessmentProfile('Pendidikan Pancasila');
  const recPknNilai = mapObjectiveToEvidence({
    objective: { id: 'pk-1', sourceType: 'TP', text: 'Memahami makna sila pertama dan norma hukum di lingkungan sekitar', criterionIds: [] },
    subjectProfile: pknProfile,
  });
  const recPknKasus = mapObjectiveToEvidence({
    objective: { id: 'pk-2', sourceType: 'TP', text: 'Menganalisis studi kasus sikap toleransi antarumat beragama', criterionIds: [] },
    subjectProfile: pknProfile,
  });
  const recPknRefleksi = mapObjectiveToEvidence({
    objective: { id: 'pk-3', sourceType: 'TP', text: 'Merefleksikan komitmen pribadi dalam menjalankan kewajiban sebagai warga', criterionIds: [] },
    subjectProfile: pknProfile,
  });
  const recPknGotongRoyong = mapObjectiveToEvidence({
    objective: { id: 'pk-4', sourceType: 'TP', text: 'Mempraktikkan kerja sama gotong royong membersihkan kelas', criterionIds: [] },
    subjectProfile: pknProfile,
  });

  assert(
    recPknNilai.evidenceTypes.includes('KNOWLEDGE_RESPONSE') &&
      recPknKasus.evidenceTypes.includes('REASONING') &&
      recPknRefleksi.recommendedInstrumentTypes.includes('SELF_ASSESSMENT') &&
      recPknGotongRoyong.evidenceTypes.includes('PERFORMANCE'),
    'Case S: Pendidikan Pancasila differentiates civic knowledge, case analysis, self reflection, and collaborative action'
  );

  // ==========================================
  // TEST T: Mapel non-MVP (misal Seni Musik / Bahasa Inggris) -> GENERIC + NEEDS_REVIEW
  // ==========================================
  const settingSeniMusik: AcademicSetting = {
    ...mockAcademicSettingSD4,
    subject: 'Seni Musik',
  };
  const tpSeniMusik: TPData = {
    id: 'tp-seni',
    academicSettingId: settingSeniMusik.id,
    items: [
      {
        id: 'tp-s-1',
        code: 'TP-SM-1',
        tp: 'Menyanyikan lagu daerah dengan intonasi yang tepat',
        order: 1,
      } as any,
    ],
    updatedAt: new Date().toISOString(),
  };
  const planSeni: AssessmentPlan = {
    ...mockPlanMatSiap,
    tpIds: ['tp-s-1'],
    criterionIds: [],
    instruments: [{ id: 'inst-seni-1', type: 'PERFORMANCE' }],
  };
  const specT = resolveAssessmentGenerationSpec({
    assessmentPlan: planSeni,
    academicSetting: settingSeniMusik,
    tp: tpSeniMusik,
  });
  assert(
    specT.subjectProfile.profileStatus === 'GENERIC' &&
      specT.resolution.status === 'NEEDS_REVIEW' &&
      specT.resolution.issues.some((i) => i.code === 'GENERIC_SUBJECT_PROFILE'),
    'Case T: Non-MVP subject (Seni Musik) resolves to GENERIC profile with NEEDS_REVIEW'
  );

  // ==========================================
  // TEST U: Phase ter-resolve konsisten dengan grade (1-12)
  // ==========================================
  assert(
    resolvePhaseForGrade(1) === 'Fase A' &&
      resolvePhaseForGrade(2) === 'Fase A' &&
      resolvePhaseForGrade(3) === 'Fase B' &&
      resolvePhaseForGrade(4) === 'Fase B' &&
      resolvePhaseForGrade(5) === 'Fase C' &&
      resolvePhaseForGrade(6) === 'Fase C' &&
      resolvePhaseForGrade(7) === 'Fase D' &&
      resolvePhaseForGrade(8) === 'Fase D' &&
      resolvePhaseForGrade(9) === 'Fase D' &&
      resolvePhaseForGrade(10) === 'Fase E' &&
      resolvePhaseForGrade(11) === 'Fase F' &&
      resolvePhaseForGrade(12) === 'Fase F',
    'Case U: Grades 1-12 map cleanly to official phases (A-F)'
  );

  // ==========================================
  // TEST V: Phase grade invalid -> undefined
  // ==========================================
  assert(
    resolvePhaseForGrade(0) === undefined &&
      resolvePhaseForGrade(13) === undefined &&
      resolvePhaseForGrade(-1) === undefined,
    'Case V: Grades outside 1-12 resolve phase to undefined'
  );

  // ==========================================
  // TEST W s/d AB: AKM progression level 1-6
  // ==========================================
  assert(resolveAKMProgression(1)?.level === 1 && resolveAKMProgression(2)?.level === 1, 'Case W: Grade 1-2 -> AKM Level 1');
  assert(resolveAKMProgression(3)?.level === 2 && resolveAKMProgression(4)?.level === 2, 'Case X: Grade 3-4 -> AKM Level 2');
  assert(resolveAKMProgression(5)?.level === 3 && resolveAKMProgression(6)?.level === 3, 'Case Y: Grade 5-6 -> AKM Level 3');
  assert(resolveAKMProgression(7)?.level === 4 && resolveAKMProgression(8)?.level === 4, 'Case Z: Grade 7-8 -> AKM Level 4');
  assert(resolveAKMProgression(9)?.level === 5 && resolveAKMProgression(10)?.level === 5, 'Case AA: Grade 9-10 -> AKM Level 5');
  assert(resolveAKMProgression(11)?.level === 6 && resolveAKMProgression(12)?.level === 6, 'Case AB: Grade 11-12 -> AKM Level 6');

  // ==========================================
  // TEST AC: AKM progression tidak menentukan cognitive demand / difficulty / item count
  // ==========================================
  const akmProg = resolveAKMProgression(4);
  assert(
    akmProg !== undefined &&
      (akmProg as any).difficulty === undefined &&
      (akmProg as any).cognitiveDemand === undefined &&
      (akmProg as any).itemCount === undefined &&
      (akmProg as any).passingScore === undefined,
    'Case AC: AKM progression is purely an OFFICIAL_REFERENCE framework and does not set difficulty, demand, or item counts'
  );

  // ==========================================
  // TEST AD: Grade calibration profile: grade 1-2 -> reading VERY_LOW, single step
  // ==========================================
  const calibG1 = getGradeCalibrationProfile(1);
  assert(
    calibG1.readingLoad === 'VERY_LOW' &&
      calibG1.instructionLoad === 'SINGLE_STEP_PREFERRED' &&
      calibG1.abstractionLevel === 'CONCRETE' &&
      calibG1.visualSupport === 'STRONGLY_CONSIDER',
    'Case AD: Grade 1 calibration sets VERY_LOW reading load and SINGLE_STEP_PREFERRED'
  );

  // ==========================================
  // TEST AE: Grade calibration profile: grade 10-12 -> reading HIGH, multi step
  // ==========================================
  const calibG11 = getGradeCalibrationProfile(11);
  assert(
    calibG11.readingLoad === 'HIGH' &&
      calibG11.instructionLoad === 'MULTI_STEP_ALLOWED' &&
      calibG11.abstractionLevel === 'ABSTRACT_ALLOWED',
    'Case AE: Grade 11 calibration sets HIGH reading load and MULTI_STEP_ALLOWED'
  );

  // ==========================================
  // TEST AF: Provenance eksplisit untuk semua profile/rule
  // ==========================================
  const genProfile = createAssessmentGenerationProfile(4);
  const provValid =
    genProfile.provenance.length > 0 &&
    genProfile.provenance.every((p) => p.id && p.sourceType && p.description) &&
    pjokProfile.recommendationRules.every((r) => r.provenance && r.provenance.sourceType);
  assert(
    provValid,
    'Case AF: Explicit provenance exists on generation profiles, calibrations, and recommendation rules'
  );

  // ==========================================
  // TEST AG: Ambiguous competency -> confidence: NEEDS_TEACHER_REVIEW
  // ==========================================
  const recAmbiguous = mapObjectiveToEvidence({
    objective: { id: 'tp-random', sourceType: 'TP', text: '123456 qwerty zzz tanpa kata kunci kompetensi', criterionIds: [] },
    subjectProfile: matProfile,
  });
  assert(
    recAmbiguous.confidence === 'NEEDS_TEACHER_REVIEW' &&
      recAmbiguous.rationaleCode === 'COMPETENCY_AMBIGUOUS',
    'Case AG: Unmatched/ambiguous competency text sets confidence to NEEDS_TEACHER_REVIEW'
  );

  // ==========================================
  // TEST AH: GenerationSpec tidak membawa prompt AI
  // ==========================================
  assert(
    (specA as any).prompt === undefined &&
      (specA as any).systemPrompt === undefined &&
      (specA as any).aiPrompt === undefined,
    'Case AH: GenerationSpec strictly contains no AI prompts or LLM instructions'
  );

  // ==========================================
  // TEST AI: GenerationSpec tidak membawa soal yang sudah jadi
  // ==========================================
  assert(
    (specA as any).items === undefined &&
      (specA as any).questions === undefined &&
      (specA as any).soal === undefined,
    'Case AI: GenerationSpec strictly contains no generated assessment items/questions'
  );

  // ==========================================
  // TEST AJ: GenerationSpec belum memiliki question budget
  // ==========================================
  assert(
    (specA as any).itemCount === undefined &&
      (specA as any).recommendedItemCount === undefined &&
      (specA as any).estimatedMinutes === undefined &&
      (specA as any).difficultyDistribution === undefined,
    'Case AJ: GenerationSpec does not yet define question budget, durations, or item counts'
  );

  // ==========================================
  // TEST AK: Canonical AssessmentPlan tidak termutasi selama proses resolution
  // ==========================================
  const planForMutationTest: AssessmentPlan = {
    ...mockPlanMatSiap,
    title: 'Rencana Asesmen Uji Imutabilitas',
  };
  const beforeSnapshot = JSON.stringify(planForMutationTest);
  resolveAssessmentGenerationSpec({
    assessmentPlan: planForMutationTest,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  const afterSnapshot = JSON.stringify(planForMutationTest);
  assert(
    beforeSnapshot === afterSnapshot,
    'Case AK: Canonical AssessmentPlan is completely immutable during generation spec resolution'
  );

  // ==========================================
  // HARDENING 9C.2 REGRESSION CASES: AL s/d BL
  // ==========================================

  // Case AL: Grade unresolved tidak menghasilkan grade = 1
  const specAL = resolveAssessmentGenerationSpec({
    assessmentPlan: mockPlanMatSiap,
    academicSetting: { ...mockAcademicSettingSD4, grade: 'unresolved-grade' },
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specAL.curriculumContext.grade === undefined,
    'Case AL: Grade unresolved does NOT fabricate grade = 1 (remains undefined)',
    `grade=${specAL.curriculumContext.grade}`
  );

  // Case AM: Curriculum unresolved tidak menghasilkan KURIKULUM_MERDEKA
  const specAM = resolveAssessmentGenerationSpec({
    assessmentPlan: mockPlanMatSiap,
    academicSetting: { ...mockAcademicSettingSD4, curriculum: '', curriculumType: undefined },
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specAM.curriculumContext.curriculumType === undefined,
    'Case AM: Curriculum unresolved does NOT fabricate KURIKULUM_MERDEKA (remains undefined)',
    `curriculumType=${specAM.curriculumContext.curriculumType}`
  );

  // Case AN: School level unresolved tidak menghasilkan SD
  const specAN = resolveAssessmentGenerationSpec({
    assessmentPlan: mockPlanMatSiap,
    academicSetting: { ...mockAcademicSettingSD4, level: undefined },
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specAN.curriculumContext.schoolLevel === undefined,
    'Case AN: School level unresolved does NOT fabricate SD (remains undefined)',
    `schoolLevel=${specAN.curriculumContext.schoolLevel}`
  );

  // Case AO: GenerationProfile tidak fabricated ketika grade unresolved
  assert(
    specAL.generationProfile === undefined,
    'Case AO: GenerationProfile is NOT fabricated when grade is unresolved (undefined)'
  );

  // Case AP: Phase tidak fabricated ketika grade unresolved
  assert(
    specAL.curriculumContext.phase === undefined,
    'Case AP: Phase is NOT fabricated when grade is unresolved (undefined)'
  );

  // Setup unmatch / ambiguous objective test
  const unmatchObj = {
    id: 'obj-unmatch-1',
    sourceType: 'TP' as const,
    text: 'Xyz123 kompetensi tidak berpola keyword apapun',
    criterionIds: [],
  };
  const profilePjok = resolveSubjectAssessmentProfile('PJOK');
  const recUnmatch = mapObjectiveToEvidence({
    objective: unmatchObj,
    subjectProfile: profilePjok,
    plannedInstrumentTypes: ['PERFORMANCE'],
  });

  // Case AQ: Evidence rule tidak match -> evidenceTypes = []
  assert(
    Array.isArray(recUnmatch.evidenceTypes) && recUnmatch.evidenceTypes.length === 0,
    'Case AQ: Evidence rule no-match results in empty evidenceTypes array ([])',
    `evidenceTypes=${JSON.stringify(recUnmatch.evidenceTypes)}`
  );

  // Case AR: Evidence rule tidak match -> recommendedInstrumentTypes = []
  assert(
    Array.isArray(recUnmatch.recommendedInstrumentTypes) && recUnmatch.recommendedInstrumentTypes.length === 0,
    'Case AR: Evidence rule no-match results in empty recommendedInstrumentTypes array ([])',
    `recommendedInstrumentTypes=${JSON.stringify(recUnmatch.recommendedInstrumentTypes)}`
  );

  // Case AS: Ambiguous evidence tidak default KNOWLEDGE_RESPONSE
  assert(
    !recUnmatch.evidenceTypes.includes('KNOWLEDGE_RESPONSE'),
    'Case AS: Ambiguous evidence does NOT fallback to KNOWLEDGE_RESPONSE'
  );

  // Case AT: Ambiguous evidence tidak default WRITTEN_TEST
  assert(
    !recUnmatch.recommendedInstrumentTypes.includes('WRITTEN_TEST'),
    'Case AT: Ambiguous evidence does NOT fallback to WRITTEN_TEST'
  );

  // Generic subject profile test
  const profileGeneric = resolveSubjectAssessmentProfile('Seni Budaya');
  const recGenericUnmatch = mapObjectiveToEvidence({
    objective: unmatchObj,
    subjectProfile: profileGeneric,
    plannedInstrumentTypes: ['PORTFOLIO'],
  });

  // Case AU: Generic profile no-match tidak menggunakan first supported evidence
  assert(
    recGenericUnmatch.evidenceTypes.length === 0 &&
      !recGenericUnmatch.evidenceTypes.includes(profileGeneric.supportedEvidenceTypes[0]),
    'Case AU: Generic profile no-match does NOT take first supported evidence type'
  );

  // Case AV: Generic profile no-match tidak menggunakan first supported instrument
  assert(
    recGenericUnmatch.recommendedInstrumentTypes.length === 0 &&
      !recGenericUnmatch.recommendedInstrumentTypes.includes(profileGeneric.supportedInstrumentTypes[0]),
    'Case AV: Generic profile no-match does NOT take first supported instrument type'
  );

  // Case AW: Multiple matching rules digabungkan, bukan first-match
  const multiRuleObj = {
    id: 'obj-multi-1',
    sourceType: 'TP' as const,
    text: 'Mempraktikkan gerak dasar senam lantai dan menjelaskan konsep gerak keseimbangan',
    criterionIds: [],
  };
  const recMulti = mapObjectiveToEvidence({
    objective: multiRuleObj,
    subjectProfile: profilePjok,
    plannedInstrumentTypes: ['PERFORMANCE'],
  });
  const hasPsychomotorEvidence = recMulti.evidenceTypes.includes('PERFORMANCE');
  const hasCognitiveEvidence = recMulti.evidenceTypes.includes('KNOWLEDGE_RESPONSE');
  assert(
    hasPsychomotorEvidence && hasCognitiveEvidence,
    'Case AW: Multiple matching rules are merged rather than short-circuiting on first match',
    `evidenceTypes=${JSON.stringify(recMulti.evidenceTypes)}, rationale=${recMulti.rationaleCode}`
  );

  // Case AX: Grade calibration provenance bukan OFFICIAL jika mapping merupakan kaidah pedagogis aplikasi
  const calib4 = getGradeCalibrationProfile(4);
  const calibRulesAllPedagogical = calib4.rules.every((r) => r.sourceType === 'PEDAGOGICAL_RULE');
  assert(
    calibRulesAllPedagogical,
    'Case AX: Grade calibration provenance uses PEDAGOGICAL_RULE instead of claiming official decree status'
  );

  // Case AY: AKM progression tetap OFFICIAL_REFERENCE
  const akm4 = resolveAKMProgression(4);
  assert(
    akm4 !== undefined && akm4.sourceType === 'OFFICIAL_REFERENCE',
    'Case AY: AKM progression retains OFFICIAL_REFERENCE provenance'
  );

  // Case AZ: Resolver tidak membuat hardcoded PPA 2024 sourceContext
  assert(
    !specA.sourceContext.some((s) => s.id === 'SRC-PPA' || (s.title && s.title.includes('Panduan Pembelajaran dan Asesmen (PPA) BSKAP 2024'))),
    'Case AZ: Resolver does NOT inject hardcoded PPA 2024 into canonical sourceContext'
  );

  // Case BA: Resolver tidak membuat hardcoded curriculum regulation sourceContext
  assert(
    !specA.sourceContext.some((s) => s.id === 'SRC-CURRICULUM' || (s.title && s.title.includes('No. 12 Tahun 2024'))),
    'Case BA: Resolver does NOT inject unverified regulation decree numbers into sourceContext'
  );

  // Case BB: Canonical sourceContext input dipertahankan jika diteruskan
  const specBB = resolveAssessmentGenerationSpec({
    assessmentPlan: mockPlanMatSiap,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
    canonicalSourceContext: [
      {
        id: 'SRC-CUSTOM-GURU',
        sourceType: 'TEACHER_SOURCE',
        title: 'Bahan Ajar Mandiri Guru',
      },
    ],
  });
  assert(
    specBB.sourceContext.some((s) => s.id === 'SRC-CUSTOM-GURU'),
    'Case BB: Provided canonicalSourceContext items are preserved in the resolved spec'
  );

  // Case BC: Objective ditemukan tetapi text kosong -> BLOCKED (OBJECTIVE_TEXT_EMPTY)
  const tpEmptyText: TPData = {
    id: 'tp-empty',
    academicSettingId: 'setting-sd-4',
    items: [
      {
        id: 'tp-empty-1',
        statement: '',
        description: '',
        competence: '',
        contentScope: '',
      } as any,
    ],
    updatedAt: new Date().toISOString(),
  };
  const planEmptyObj: AssessmentPlan = {
    ...mockPlanMatSiap,
    id: 'plan-empty-obj',
    tpIds: ['tp-empty-1'],
    criterionIds: [],
  };
  const specBC = resolveAssessmentGenerationSpec({
    assessmentPlan: planEmptyObj,
    academicSetting: mockAcademicSettingSD4,
    tp: tpEmptyText,
  });
  assert(
    specBC.resolution.status === 'BLOCKED' &&
      specBC.resolution.issues.some((i) => i.code === 'OBJECTIVE_TEXT_EMPTY'),
    'Case BC: Found objective with empty canonical text is BLOCKED with OBJECTIVE_TEXT_EMPTY'
  );

  // Case BD: "Kelas 4" -> grade 4
  assert(resolveGrade(null, 'Kelas 4') === 4, 'Case BD: Explicit grade string "Kelas 4" resolves to 4');

  // Case BE: "Kelas 10" -> grade 10
  assert(resolveGrade(null, 'Kelas 10') === 10, 'Case BE: Explicit grade string "Kelas 10" resolves to 10');

  // Case BF: "Kelas 4-5" -> unresolved (undefined)
  assert(
    resolveGrade(null, 'Kelas 4-5') === undefined,
    'Case BF: Ambiguous range grade "Kelas 4-5" resolves to undefined without guessing'
  );

  // Case BG: "4/5" -> unresolved (undefined)
  assert(
    resolveGrade(null, '4/5') === undefined,
    'Case BG: Slash grade "4/5" resolves to undefined without guessing'
  );

  // Case BH: "TK-A" -> unresolved (undefined)
  assert(
    resolveGrade(null, 'TK-A') === undefined,
    'Case BH: Non-primary non-grade string "TK-A" resolves to undefined'
  );

  // Case BI: Unknown level tidak menjadi SD (undefined)
  const specBI = resolveAssessmentGenerationSpec({
    assessmentPlan: mockPlanMatSiap,
    academicSetting: { ...mockAcademicSettingSD4, level: 'MADRASAH_ALIYAH' as any },
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    specBI.curriculumContext.schoolLevel === undefined,
    'Case BI: Unknown school level does NOT default to SD (remains undefined)'
  );

  // Case BJ: Ambiguous evidence tidak menghasilkan INSTRUMENT_RECOMMENDATION_MISMATCH hanya karena recommendation kosong
  const planForBJ: AssessmentPlan = {
    ...mockPlanMatSiap,
    id: 'plan-bj',
    tpIds: ['tp-mat-unmatch'],
    criterionIds: [],
    instruments: [{ id: 'inst-1', type: 'WRITTEN_TEST' }],
  };
  const tpForBJ: TPData = {
    id: 'tp-bj',
    academicSettingId: 'setting-sd-4',
    items: [
      {
        id: 'tp-mat-unmatch',
        statement: 'Zzqq123 tanpa kata kunci rekomendasi sama sekali',
        order: 1,
      } as any,
    ],
    updatedAt: new Date().toISOString(),
  };
  const specBJ = resolveAssessmentGenerationSpec({
    assessmentPlan: planForBJ,
    academicSetting: mockAcademicSettingSD4,
    tp: tpForBJ,
  });
  const hasFakeMismatch = specBJ.resolution.issues.some((i) => i.code === 'INSTRUMENT_RECOMMENDATION_MISMATCH');
  const hasAmbiguousReview = specBJ.resolution.issues.some((i) => i.code === 'EVIDENCE_RECOMMENDATION_AMBIGUOUS');
  assert(
    !hasFakeMismatch && hasAmbiguousReview,
    'Case BJ: Ambiguous/empty recommendation does NOT create false INSTRUMENT_RECOMMENDATION_MISMATCH'
  );

  // Case BK: AssessmentPlan tetap tidak termutasi (secondary validation)
  const deepCopyPlan = JSON.parse(JSON.stringify(mockPlanMatSiap));
  resolveAssessmentGenerationSpec({
    assessmentPlan: mockPlanMatSiap,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    JSON.stringify(mockPlanMatSiap) === JSON.stringify(deepCopyPlan),
    'Case BK: AssessmentPlan object identity & contents remain strictly immutable across multiple runs'
  );

  // Case BL: Tidak ada AI/API/generation implementation
  const anySpec = specA as any;
  const hasNoAIFeatures =
    anySpec.aiPrompt === undefined &&
    anySpec.llmModel === undefined &&
    anySpec.generatedQuestions === undefined &&
    anySpec.itemBudget === undefined;
  assert(
    hasNoAIFeatures,
    'Case BL: Spec strictly contains zero AI prompts, LLM models, generated questions, or budgeting constructs'
  );

  // ==========================================
  // FINAL CLEANUP 9C.2 REGRESSION: BM s/d BU
  // ==========================================

  // Check specific profiles: PJOK, Bahasa Indonesia, Matematika, IPA, Pendidikan Pancasila
  const profilePjokFinal = resolveSubjectAssessmentProfile('PJOK');
  const profileBindoFinal = resolveSubjectAssessmentProfile('Bahasa Indonesia');
  const profileMatFinal = resolveSubjectAssessmentProfile('Matematika');
  const profileIpaFinal = resolveSubjectAssessmentProfile('IPA');
  const profilePancasilaFinal = resolveSubjectAssessmentProfile('Pendidikan Pancasila');
  const allSpecificProfiles = [
    profilePjokFinal,
    profileBindoFinal,
    profileMatFinal,
    profileIpaFinal,
    profilePancasilaFinal,
  ];

  // Case BM: Specific Subject Profile tidak memiliki hardcoded PROV-CP-BSKAP-032-2024
  const hasProvCp032 = allSpecificProfiles.some((p) =>
    p.provenance.some((prov) => prov.id === 'PROV-CP-BSKAP-032-2024')
  );
  assert(
    !hasProvCp032,
    'Case BM: Specific Subject Profiles do NOT contain hardcoded PROV-CP-BSKAP-032-2024'
  );

  // Case BN: Specific Subject Profile tidak memiliki nomor keputusan CP statis
  const hasStaticDecreeInProfiles = allSpecificProfiles.some((p) =>
    p.provenance.some(
      (prov) =>
        (prov.sourceTitle && /Keputusan|BSKAP|Permendikbud|BKPDM/i.test(prov.sourceTitle)) ||
        prov.sourceType === 'OFFICIAL'
    )
  );
  assert(
    !hasStaticDecreeInProfiles,
    'Case BN: Specific Subject Profiles do NOT contain static CP decree numbers or OFFICIAL regulation claims'
  );

  // Case BO: Specific Subject Profile tetap memiliki pedagogical provenance
  const allHavePedagogical = allSpecificProfiles.every((p) =>
    p.provenance.some((prov) => prov.sourceType === 'PEDAGOGICAL_RULE')
  );
  assert(
    allHavePedagogical,
    'Case BO: Specific Subject Profiles retain valid PEDAGOGICAL_RULE provenance'
  );

  // Case BP: Evidence rules tetap bekerja setelah CP provenance dihapus
  const samplePjokRec = mapObjectiveToEvidence({
    objective: {
      id: 'tp-pjok-test',
      sourceType: 'TP',
      text: 'Mempraktikkan gerak dasar manipulatif melempar bola',
      criterionIds: [],
    },
    subjectProfile: profilePjokFinal,
    plannedInstrumentTypes: ['PERFORMANCE'],
  });
  assert(
    samplePjokRec.evidenceTypes.includes('PERFORMANCE') &&
      samplePjokRec.recommendedInstrumentTypes.includes('PERFORMANCE') &&
      samplePjokRec.confidence === 'RULE_BASED',
    'Case BP: Evidence recommendation rules function properly without CP regulation provenance'
  );

  // Case BQ: canonicalSourceContext dengan CANONICAL_CURRICULUM tetap diteruskan ke GenerationSpec
  const canonicalContextItem: AssessmentSourceContext = {
    id: 'SRC-CP-RESOLVED',
    sourceType: 'CANONICAL_CURRICULUM',
    title: 'Capaian Pembelajaran Resmi Resolusi Kurikulum Aktif',
    sourceRef: 'REG-CANONICAL-2026',
    revision: '2026.1',
  };
  const specBQ = resolveAssessmentGenerationSpec({
    assessmentPlan: mockPlanMatSiap,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
    canonicalSourceContext: [canonicalContextItem],
  });
  const foundCanonicalInSpec = specBQ.sourceContext.find((s) => s.id === 'SRC-CP-RESOLVED');
  assert(
    foundCanonicalInSpec !== undefined &&
      foundCanonicalInSpec.sourceType === 'CANONICAL_CURRICULUM' &&
      foundCanonicalInSpec.sourceRef === 'REG-CANONICAL-2026',
    'Case BQ: canonicalSourceContext with CANONICAL_CURRICULUM is accurately preserved in GenerationSpec'
  );

  // Case BR: Tanpa canonicalSourceContext, GenerationSpec tidak menciptakan CP official source sendiri
  const specBR = resolveAssessmentGenerationSpec({
    assessmentPlan: mockPlanMatSiap,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  const hasCreatedOfficialCP = specBR.sourceContext.some(
    (s) => s.sourceType === 'CANONICAL_CURRICULUM' || s.sourceType === 'OFFICIAL_GUIDANCE'
  );
  assert(
    !hasCreatedOfficialCP,
    'Case BR: Without canonicalSourceContext input, GenerationSpec does NOT invent or fabricate official CP sources'
  );

  // Case BS: Tidak ada hardcoded 032/H/KR/2024, 046/H/KR/2025, 020 Tahun 2026 di subjectAssessmentProfileService.ts
  const fs = await import('fs');
  const path = await import('path');
  const serviceFilePath = path.join(process.cwd(), 'src/services/subjectAssessmentProfileService.ts');
  const serviceFileContent = fs.readFileSync(serviceFilePath, 'utf-8');
  const containsHardcodedDecrees =
    serviceFileContent.includes('032/H/KR/2024') ||
    serviceFileContent.includes('046/H/KR/2025') ||
    serviceFileContent.includes('020 Tahun 2026') ||
    serviceFileContent.includes('PROV-CP-BSKAP');
  assert(
    !containsHardcodedDecrees,
    'Case BS: subjectAssessmentProfileService.ts contains zero hardcoded CP decree references or PROV-CP-BSKAP'
  );

  // Case BT: AssessmentPlan tetap immutable
  const planForBT: AssessmentPlan = { ...mockPlanMatSiap, title: 'Plan Immutability BT' };
  const beforePlanSnapshotBT = JSON.stringify(planForBT);
  resolveAssessmentGenerationSpec({
    assessmentPlan: planForBT,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  assert(
    beforePlanSnapshotBT === JSON.stringify(planForBT),
    'Case BT: AssessmentPlan is strictly immutable across resolution lifecycle'
  );

  // Case BU: Resolution behavior 9C.2 tidak berubah (RESOLVED, NEEDS_REVIEW, BLOCKED)
  const specBuResolved = resolveAssessmentGenerationSpec({
    assessmentPlan: mockPlanMatSiap,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  const specBuReview = resolveAssessmentGenerationSpec({
    assessmentPlan: planSeni,
    academicSetting: settingSeniMusik,
    tp: tpSeniMusik,
  });
  const specBuBlocked = resolveAssessmentGenerationSpec({
    assessmentPlan: { ...mockPlanMatSiap, workflowStatus: 'DRAFT' },
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
  });
  assert(
    specBuResolved.resolution.status === 'RESOLVED' &&
      specBuReview.resolution.status === 'NEEDS_REVIEW' &&
      specBuBlocked.resolution.status === 'BLOCKED',
    'Case BU: Resolution behavior 9C.2 is fully preserved (RESOLVED, NEEDS_REVIEW, BLOCKED fail-closed)'
  );

  console.log(`\n=== REGRESSION TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
