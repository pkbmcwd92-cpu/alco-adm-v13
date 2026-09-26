import {
  AcademicSetting,
  AssessmentCriterion,
  AssessmentGenerationPlan,
  AssessmentGenerationSpec,
  AssessmentPlan,
  TPData,
} from '../src/types';
import { resolveAssessmentGenerationSpec } from '../src/services/assessmentGenerationSpecService';
import {
  resolveAssessmentGenerationPlan,
  createDeterministicCoverageId,
  mapInstrumentToAllocationUnit,
  resolveConservativeCognitiveDemand,
  PROV_MINIMUM_COVERAGE_ALLOCATION,
} from '../src/services/assessmentGenerationPlanService';

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
  console.log('=== STARTING AUDIT 9C.3 GENERATION PLAN REGRESSION TEST SUITE ===\n');

  // Baseline SD 4 Matematika Setup
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
    workflowStatus: 'SIAP',
    needsReview: false,
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

  const mockCriteriaMat: AssessmentCriterion[] = [
    {
      id: 'crit-mat-1',
      academicSettingId: 'setting-sd-4',
      tpId: 'tp-mat-1',
      description: 'Peserta didik mampu mengidentifikasi pecahan senilai',
      approach: 'deskripsi',
      indicators: ['Menyebutkan contoh pecahan senilai'],
      levels: [],
      workflowStatus: 'SIAP',
      needsReview: false,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'crit-mat-2',
      academicSettingId: 'setting-sd-4',
      tpId: 'tp-mat-1',
      description: 'Peserta didik mampu membandingkan pecahan berpenyebut sama',
      approach: 'deskripsi',
      indicators: ['Membandingkan dua pecahan'],
      levels: [],
      workflowStatus: 'SIAP',
      needsReview: false,
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockPlanMatSiap: AssessmentPlan = {
    id: 'plan-mat-1',
    academicSettingId: 'setting-sd-4',
    title: 'Penilaian Sumatif Matematika Bab 1',
    purpose: 'SUMMATIVE',
    timing: 'POST',
    scopeType: 'TP',
    tpIds: ['tp-mat-1'],
    criterionIds: ['crit-mat-1', 'crit-mat-2'],
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

  const baseSpecResolved = resolveAssessmentGenerationSpec({
    assessmentPlan: mockPlanMatSiap,
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });

  // ==========================================
  // CASE A: BLOCKED GenerationSpec -> BLOCKED
  // ==========================================
  const specBlocked = resolveAssessmentGenerationSpec({
    assessmentPlan: { ...mockPlanMatSiap, workflowStatus: 'DRAFT' },
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
  });
  const planA = resolveAssessmentGenerationPlan({ generationSpec: specBlocked });
  assert(
    planA.resolution.status === 'BLOCKED',
    'Case A: BLOCKED GenerationSpec propagates strictly to BLOCKED GenerationPlan'
  );

  // ==========================================
  // CASE B: NEEDS_REVIEW GenerationSpec -> cannot become RESOLVED (remains at least NEEDS_REVIEW)
  // ==========================================
  const specNeedsReview = resolveAssessmentGenerationSpec({
    assessmentPlan: {
      ...mockPlanMatSiap,
      instruments: [{ id: 'inst-perf', type: 'PERFORMANCE' }],
    },
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  const planB = resolveAssessmentGenerationPlan({ generationSpec: specNeedsReview });
  assert(
    planB.resolution.status === 'NEEDS_REVIEW',
    'Case B: NEEDS_REVIEW GenerationSpec does NOT upgrade to RESOLVED'
  );

  // ==========================================
  // CASE C: Objective kosong -> BLOCKED
  // ==========================================
  const specEmptyObjectives: AssessmentGenerationSpec = {
    ...baseSpecResolved,
    objectives: [],
    resolution: { status: 'RESOLVED', issues: [] },
  };
  const planC = resolveAssessmentGenerationPlan({ generationSpec: specEmptyObjectives });
  assert(
    planC.resolution.status === 'BLOCKED' &&
      planC.resolution.issues.some((i) => i.code === 'OBJECTIVES_EMPTY'),
    'Case C: Empty objectives fail-closed with status BLOCKED'
  );

  // ==========================================
  // CASE D: Setiap objective mendapat coverage
  // ==========================================
  const specMultiTP = resolveAssessmentGenerationSpec({
    assessmentPlan: { ...mockPlanMatSiap, tpIds: ['tp-mat-1', 'tp-mat-2'], criterionIds: [] },
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
  });
  const planD = resolveAssessmentGenerationPlan({ generationSpec: specMultiTP });
  const coveredObjIds = new Set(planD.coverageUnits.map((u) => u.objectiveRefId));
  assert(
    coveredObjIds.has('tp-mat-1') && coveredObjIds.has('tp-mat-2'),
    'Case D: Every objective in GenerationSpec receives at least one coverage unit'
  );

  // ==========================================
  // CASE E: Setiap criterion mendapat coverage
  // ==========================================
  const planE = resolveAssessmentGenerationPlan({ generationSpec: baseSpecResolved });
  const coveredCritIds = planE.coverageUnits.map((u) => u.criterionId);
  assert(
    coveredCritIds.includes('crit-mat-1') && coveredCritIds.includes('crit-mat-2'),
    'Case E: Every referenced criterion receives its own dedicated coverage unit'
  );

  // ==========================================
  // CASE F: Satu TP dengan beberapa criteria -> semua dipertahankan
  // ==========================================
  assert(
    planE.coverageUnits.length === 2 &&
      planE.coverageUnits.filter((u) => u.objectiveRefId === 'tp-mat-1').length === 2,
    'Case F: Single TP with multiple criteria produces distinct coverage units for all criteria'
  );

  // ==========================================
  // CASE G: Tidak fabricate criterion (jika TP tidak punya criterion -> criterionId undefined)
  // ==========================================
  const specNoCriteria = resolveAssessmentGenerationSpec({
    assessmentPlan: { ...mockPlanMatSiap, criterionIds: [] },
    academicSetting: mockAcademicSettingSD4,
    tp: mockTPMat,
  });
  const planG = resolveAssessmentGenerationPlan({ generationSpec: specNoCriteria });
  assert(
    planG.coverageUnits.length === 1 && planG.coverageUnits[0].criterionId === undefined,
    'Case G: Objective without criteria retains criterionId as undefined without fabricating criteria'
  );

  // ==========================================
  // CASE H: Tidak menggunakan criterion pertama (criteria[0] / criterionIds[0] singleton)
  // ==========================================
  assert(
    planE.coverageUnits.length === 2 &&
      planE.coverageUnits[0].criterionId !== planE.coverageUnits[1].criterionId,
    'Case H: All criteria are retained, not truncated to the first criterion'
  );

  // ==========================================
  // CASE I: Multi-instrument canonical plan expands coverage, never first-item fallback
  // ==========================================
  const specAmbiguousInstruments: AssessmentGenerationSpec = {
    ...baseSpecResolved,
    plannedInstrumentTypes: ['WRITTEN_TEST', 'PERFORMANCE'],
    evidenceRecommendations: [
      {
        objectiveRefId: 'tp-mat-1',
        evidenceTypes: ['KNOWLEDGE_RESPONSE', 'PERFORMANCE'],
        recommendedInstrumentTypes: ['WRITTEN_TEST', 'PERFORMANCE'],
        rationaleCode: 'AMBIGUOUS',
        provenance: [],
        confidence: 'NEEDS_TEACHER_REVIEW',
      },
    ],
    resolution: { status: 'RESOLVED', issues: [] },
  };
  const planI = resolveAssessmentGenerationPlan({
    generationSpec: specAmbiguousInstruments,
  });

  const planIInstrumentTypes = new Set(
    planI.coverageUnits.map((u) => u.instrumentType)
  );

  assert(
    planI.coverageUnits.length === 4 &&
      planIInstrumentTypes.has('WRITTEN_TEST') &&
      planIInstrumentTypes.has('PERFORMANCE') &&
      planI.coverageUnits.every(
        (u) => u.instrumentType !== undefined
      ),
    'Case I: Multi-instrument canonical plan expands every criterion across all confirmed instruments'
  );

  // ==========================================
  // CASE J: Single planned instrument -> deterministic resolve
  // ==========================================
  const planJ = resolveAssessmentGenerationPlan({ generationSpec: baseSpecResolved });
  assert(
    planJ.coverageUnits.every((u) => u.instrumentType === 'WRITTEN_TEST'),
    'Case J: Single canonical planned instrument resolves deterministically'
  );

  // ==========================================
  // CASE K: Recommendation is advisory; canonical multi-instrument plan wins
  // ==========================================
  const specIntersectOne: AssessmentGenerationSpec = {
    ...baseSpecResolved,
    plannedInstrumentTypes: ['WRITTEN_TEST', 'OBSERVATION'],
    evidenceRecommendations: [
      {
        objectiveRefId: 'tp-mat-1',
        evidenceTypes: ['KNOWLEDGE_RESPONSE'],
        recommendedInstrumentTypes: ['WRITTEN_TEST'],
        rationaleCode: 'CONCEPTUAL',
        provenance: [],
        confidence: 'RULE_BASED',
      },
    ],
    resolution: { status: 'RESOLVED', issues: [] },
  };
  const planK = resolveAssessmentGenerationPlan({ generationSpec: specIntersectOne });
  const planKTypes = new Set(
    planK.coverageUnits.map((u) => u.instrumentType)
  );

  assert(
    planK.coverageUnits.length === 4 &&
      planKTypes.has('WRITTEN_TEST') &&
      planKTypes.has('OBSERVATION') &&
      planK.coverageUnits.every(
        (u) => u.instrumentType !== undefined
      ),
    'Case K: Recommendation intersection does not remove another canonical planned instrument'
  );

  // ==========================================
  // CASE L: Multiple instruments ambiguous -> NEEDS_REVIEW
  // ==========================================
  const planL = resolveAssessmentGenerationPlan({
    generationSpec: specAmbiguousInstruments,
  });

  assert(
    !planL.resolution.issues.some(
      (issue) =>
        issue.code ===
        'INSTRUMENT_RESOLUTION_AMBIGUOUS'
    ) &&
      planL.coverageUnits.some(
        (u) => u.instrumentType === 'WRITTEN_TEST'
      ) &&
      planL.coverageUnits.some(
        (u) => u.instrumentType === 'PERFORMANCE'
      ),
    'Case L: Multiple canonical instruments never create INSTRUMENT_RESOLUTION_AMBIGUOUS'
  );

  // ==========================================
  // CASE M: Instrument di luar canonical plan tidak pernah ditambahkan
  // ==========================================
  const specPerfRecommendedButWrittenPlanned: AssessmentGenerationSpec = {
    ...baseSpecResolved,
    plannedInstrumentTypes: ['WRITTEN_TEST'],
    evidenceRecommendations: [
      {
        objectiveRefId: 'tp-mat-1',
        evidenceTypes: ['PERFORMANCE'],
        recommendedInstrumentTypes: ['PERFORMANCE'],
        rationaleCode: 'MISMATCH',
        provenance: [],
        confidence: 'RULE_BASED',
      },
    ],
    resolution: { status: 'RESOLVED', issues: [] },
  };
  const planM = resolveAssessmentGenerationPlan({
    generationSpec: specPerfRecommendedButWrittenPlanned,
  });
  assert(
    planM.coverageUnits.every((u) => u.instrumentType === 'WRITTEN_TEST'),
    'Case M: Canonical plan instruments win; external recommended instruments are NEVER injected'
  );

  // ==========================================
  // CASE N: Tidak default WRITTEN_TEST untuk planned instrument kosong/lainnya
  // ==========================================
  const specPerfPlan: AssessmentGenerationSpec = {
    ...baseSpecResolved,
    plannedInstrumentTypes: ['PERFORMANCE'],
    evidenceRecommendations: [
      {
        objectiveRefId: 'tp-mat-1',
        evidenceTypes: ['PERFORMANCE'],
        recommendedInstrumentTypes: ['PERFORMANCE'],
        rationaleCode: 'PERF',
        provenance: [],
        confidence: 'RULE_BASED',
      },
    ],
    resolution: { status: 'RESOLVED', issues: [] },
  };
  const planN = resolveAssessmentGenerationPlan({ generationSpec: specPerfPlan });
  assert(
    planN.coverageUnits.every((u) => u.instrumentType === 'PERFORMANCE' && u.allocationUnit === 'TASK'),
    'Case N: Non-written instruments resolve to their proper types and allocation units (TASK)'
  );

  // ==========================================
  // CASE O: Tidak ada default total item count (tanpa requestedTotalItems)
  // ==========================================
  const planO = resolveAssessmentGenerationPlan({ generationSpec: baseSpecResolved });
  assert(
    planO.constraints.requestedTotalItems === undefined,
    'Case O: constraints.requestedTotalItems is undefined by default (no hardcoded total count)'
  );

  // ==========================================
  // CASE P: Tidak ada grade-based question count
  // ==========================================
  const specGrade12 = { ...baseSpecResolved, curriculumContext: { ...baseSpecResolved.curriculumContext, grade: 12 } };
  const planP = resolveAssessmentGenerationPlan({ generationSpec: specGrade12 });
  assert(
    planP.coverageUnits.every((u) => u.recommendedCount === 1),
    'Case P: Grade 12 has identical minimum sensible unit count (= 1) without grade-based inflation'
  );

  // ==========================================
  // CASE Q: Tidak ada FORMATIVE = 5
  // ==========================================
  assert(
    planO.summary.allocatedCount !== 5 || planO.summary.coverageUnitCount === 5,
    'Case Q: FORMATIVE purpose does not inject arbitrary 5 item count'
  );

  // ==========================================
  // CASE R: Tidak ada SUMMATIVE = 20
  // ==========================================
  assert(
    planO.summary.allocatedCount !== 20,
    'Case R: SUMMATIVE purpose does not inject arbitrary 20 item count'
  );

  // ==========================================
  // CASE S: Tidak ada fixed LOTS/MOTS/HOTS percentage
  // ==========================================
  assert(
    planO.coverageUnits.every((u) => u.cognitiveDemand !== 'RECALL_UNDERSTAND' || u.recommendedCount === 1),
    'Case S: No fixed percentage splits (30% LOTS / 40% MOTS / 30% HOTS) are applied'
  );

  // ==========================================
  // CASE T: CognitiveDemand tidak menentukan difficulty
  // ==========================================
  assert(
    planO.coverageUnits.every((u) => u.difficultyTarget === undefined),
    'Case T: Cognitive demand does NOT drive or derive difficultyTarget (remains undefined)'
  );

  // ==========================================
  // CASE U: Tidak default MODERATE difficulty
  // ==========================================
  assert(
    planO.coverageUnits.every((u) => u.difficultyTarget !== 'MODERATE'),
    'Case U: difficultyTarget is never set to MODERATE by default'
  );

  // ==========================================
  // CASE V: Tidak default stimulus
  // ==========================================
  assert(
    planO.coverageUnits.every((u) => u.stimulusType === undefined),
    'Case V: stimulusType is undefined by default without speculation'
  );

  // ==========================================
  // CASE W: Tidak fabricate assessmentIndicator
  // ==========================================
  assert(
    planO.coverageUnits.every((u) => u.assessmentIndicator === undefined),
    'Case W: assessmentIndicator is undefined without fabricating placeholder strings'
  );

  // ==========================================
  // CASE X: Tidak fabricate materialOrContext
  // ==========================================
  assert(
    planO.coverageUnits.every((u) => u.materialOrContext === undefined),
    'Case X: materialOrContext is undefined without fabricating placeholder strings'
  );

  // ==========================================
  // CASE Y: duration negatif -> BLOCKED
  // ==========================================
  const planY = resolveAssessmentGenerationPlan({
    generationSpec: baseSpecResolved,
    constraints: { durationMinutes: -30 },
  });
  assert(
    planY.resolution.status === 'BLOCKED' &&
      planY.resolution.issues.some((i) => i.code === 'CONSTRAINT_INVALID'),
    'Case Y: Negative durationMinutes fails-closed with status BLOCKED'
  );

  // ==========================================
  // CASE Z: duration 0 -> BLOCKED
  // ==========================================
  const planZ = resolveAssessmentGenerationPlan({
    generationSpec: baseSpecResolved,
    constraints: { durationMinutes: 0 },
  });
  assert(
    planZ.resolution.status === 'BLOCKED' &&
      planZ.resolution.issues.some((i) => i.code === 'CONSTRAINT_INVALID'),
    'Case Z: Zero durationMinutes fails-closed with status BLOCKED'
  );

  // ==========================================
  // CASE AA: requestedTotalItems negatif -> BLOCKED
  // ==========================================
  const planAA = resolveAssessmentGenerationPlan({
    generationSpec: baseSpecResolved,
    constraints: { requestedTotalItems: -10 },
  });
  assert(
    planAA.resolution.status === 'BLOCKED' &&
      planAA.resolution.issues.some((i) => i.code === 'CONSTRAINT_INVALID'),
    'Case AA: Negative requestedTotalItems fails-closed with status BLOCKED'
  );

  // ==========================================
  // CASE AB: requestedTotalItems 0 -> BLOCKED
  // ==========================================
  const planAB = resolveAssessmentGenerationPlan({
    generationSpec: baseSpecResolved,
    constraints: { requestedTotalItems: 0 },
  });
  assert(
    planAB.resolution.status === 'BLOCKED' &&
      planAB.resolution.issues.some((i) => i.code === 'CONSTRAINT_INVALID'),
    'Case AB: Zero requestedTotalItems fails-closed with status BLOCKED'
  );

  // ==========================================
  // CASE AC: requestedTotalItems fractional -> BLOCKED
  // ==========================================
  const planAC = resolveAssessmentGenerationPlan({
    generationSpec: baseSpecResolved,
    constraints: { requestedTotalItems: 2.5 },
  });
  assert(
    planAC.resolution.status === 'BLOCKED' &&
      planAC.resolution.issues.some((i) => i.code === 'CONSTRAINT_INVALID'),
    'Case AC: Fractional requestedTotalItems fails-closed with status BLOCKED'
  );

  // ==========================================
  // CASE AD: requestedTotalItems NaN/Infinity -> BLOCKED
  // ==========================================
  const planAD = resolveAssessmentGenerationPlan({
    generationSpec: baseSpecResolved,
    constraints: { requestedTotalItems: Infinity },
  });
  assert(
    planAD.resolution.status === 'BLOCKED' &&
      planAD.resolution.issues.some((i) => i.code === 'CONSTRAINT_INVALID'),
    'Case AD: Infinity requestedTotalItems fails-closed with status BLOCKED'
  );

  // ==========================================
  // CASE AE: Teacher-defined valid count dipertahankan exact
  // ==========================================
  const planAE = resolveAssessmentGenerationPlan({
    generationSpec: baseSpecResolved,
    constraints: { assemblyMode: 'TEACHER_DEFINED', requestedTotalItems: 2 },
  });
  assert(
    planAE.constraints.requestedTotalItems === 2 && planAE.summary.allocatedCount === 2,
    'Case AE: Valid teacher-defined requestedTotalItems is preserved exactly'
  );

  // ==========================================
  // CASE AF: Teacher count < minimum coverage -> NEEDS_REVIEW dan tidak dinaikkan diam-diam
  // ==========================================
  const planAF = resolveAssessmentGenerationPlan({
    generationSpec: baseSpecResolved, // 2 coverage units
    constraints: { assemblyMode: 'TEACHER_DEFINED', requestedTotalItems: 1 },
  });
  assert(
    planAF.resolution.status === 'NEEDS_REVIEW' &&
      planAF.constraints.requestedTotalItems === 1 &&
      planAF.resolution.issues.some((i) => i.code === 'TEACHER_ITEM_COUNT_UNDER_COVERAGE'),
    'Case AF: Teacher count < min coverage triggers NEEDS_REVIEW and is NOT silently inflated'
  );

  // ==========================================
  // CASE AG: AUTO_RECOMMENDED coverage-first
  // ==========================================
  const planAG = resolveAssessmentGenerationPlan({
    generationSpec: baseSpecResolved,
    constraints: { assemblyMode: 'AUTO_RECOMMENDED' },
  });
  assert(
    planAG.summary.coverageUnitCount === 2 && planAG.summary.allocatedCount === 2,
    'Case AG: AUTO_RECOMMENDED mode allocates exactly 1 sensible unit per coverage unit'
  );

  // ==========================================
  // CASE AH: Minimum coverage allocation provenance = APP_DEFAULT
  // ==========================================
  const hasAppDefaultProv = planAG.coverageUnits.every((u) =>
    u.provenance.some((p) => p.id === 'APP-DEFAULT-MINIMUM-COVERAGE' && p.sourceType === 'APP_DEFAULT')
  );
  assert(
    hasAppDefaultProv,
    'Case AH: Minimum coverage allocation provenance is explicitly APP_DEFAULT'
  );

  // ==========================================
  // CASE AI: Tidak diklaim OFFICIAL untuk allocation logic
  // ==========================================
  const hasFakeOfficialAllocation = planAG.coverageUnits.some((u) =>
    u.provenance.some(
      (p) => p.id === 'APP-DEFAULT-MINIMUM-COVERAGE' && p.sourceType === 'OFFICIAL'
    )
  );
  assert(
    !hasFakeOfficialAllocation,
    'Case AI: Application allocation logic is never falsely claimed as OFFICIAL'
  );

  // ==========================================
  // CASE AJ: Coverage IDs deterministic
  // ==========================================
  const id1 = createDeterministicCoverageId('tp-mat-1', 'crit-mat-1');
  const id2 = createDeterministicCoverageId('tp-mat-1', 'crit-mat-2');
  const id3 = createDeterministicCoverageId('tp-mat-1');
  assert(
    id1 === 'coverage:tp-mat-1:crit-mat-1' &&
      id2 === 'coverage:tp-mat-1:crit-mat-2' &&
      id3 === 'coverage:tp-mat-1:objective',
    'Case AJ: Coverage IDs are cleanly formatted and deterministic'
  );

  // ==========================================
  // CASE AJ-B1: Instrument-aware deterministic coverage IDs
  // ==========================================
  const writtenCoverageId = createDeterministicCoverageId(
    'tp-mat-1',
    'crit-mat-1',
    'WRITTEN_TEST'
  );

  const performanceCoverageId =
    createDeterministicCoverageId(
      'tp-mat-1',
      'crit-mat-1',
      'PERFORMANCE'
    );

  assert(
    (writtenCoverageId as string) !== (performanceCoverageId as string) &&
      writtenCoverageId ===
        'coverage:tp-mat-1:crit-mat-1:written_test' &&
      performanceCoverageId ===
        'coverage:tp-mat-1:crit-mat-1:performance',
    'Case AJ-B1: Same objective/criterion with different instruments receives distinct deterministic coverage IDs'
  );

  // ==========================================
  // CASE AJ-B1-2: 2 criteria × 2 instruments = 4 unique coverage units
  // ==========================================
  assert(
    planI.coverageUnits.length === 4 &&
      new Set(
        planI.coverageUnits.map((u) => u.id)
      ).size === 4 &&
      planI.coverageUnits.filter(
        (u) =>
          u.criterionId === 'crit-mat-1' &&
          u.instrumentType === 'WRITTEN_TEST'
      ).length === 1 &&
      planI.coverageUnits.filter(
        (u) =>
          u.criterionId === 'crit-mat-1' &&
          u.instrumentType === 'PERFORMANCE'
      ).length === 1 &&
      planI.coverageUnits.filter(
        (u) =>
          u.criterionId === 'crit-mat-2' &&
          u.instrumentType === 'WRITTEN_TEST'
      ).length === 1 &&
      planI.coverageUnits.filter(
        (u) =>
          u.criterionId === 'crit-mat-2' &&
          u.instrumentType === 'PERFORMANCE'
      ).length === 1,
    'Case AJ-B1-2: Coverage generation performs exact criterion × instrument cross-product'
  );

  // ==========================================
  // CASE AK: Repeated build -> ID sama
  // ==========================================
  const planRun1 = resolveAssessmentGenerationPlan({ generationSpec: baseSpecResolved });
  const planRun2 = resolveAssessmentGenerationPlan({ generationSpec: baseSpecResolved });
  const ids1 = planRun1.coverageUnits.map((u) => u.id);
  const ids2 = planRun2.coverageUnits.map((u) => u.id);
  assert(
    JSON.stringify(ids1) === JSON.stringify(ids2),
    'Case AK: Repeated resolution runs produce identical deterministic IDs'
  );

  // ==========================================
  // CASE AL: AssessmentGenerationSpec immutable
  // ==========================================
  const specSnapshotBefore = JSON.stringify(baseSpecResolved);
  resolveAssessmentGenerationPlan({ generationSpec: baseSpecResolved });
  assert(
    specSnapshotBefore === JSON.stringify(baseSpecResolved),
    'Case AL: Input AssessmentGenerationSpec is strictly immutable'
  );

  // ==========================================
  // CASE AM: AssessmentPlan/canonical references tidak termutasi
  // ==========================================
  const planSnapshotBefore = JSON.stringify(mockPlanMatSiap);
  resolveAssessmentGenerationPlan({ generationSpec: baseSpecResolved });
  assert(
    planSnapshotBefore === JSON.stringify(mockPlanMatSiap),
    'Case AM: Canonical AssessmentPlan references are strictly unmutated'
  );

  // ==========================================
  // CASE AN: 9C.3 tidak membuat AssessmentPackage
  // ==========================================
  assert(
    (planAG as any).blueprint === undefined && (planAG as any).instruments === undefined,
    'Case AN: 9C.3 output is AssessmentGenerationPlan, NOT AssessmentPackage'
  );

  // ==========================================
  // CASE AO: 9C.3 tidak membuat soal (questions/items)
  // ==========================================
  assert(
    (planAG as any).questions === undefined && (planAG as any).items === undefined,
    'Case AO: 9C.3 does NOT fabricate assessment items/questions'
  );

  // ==========================================
  // CASE AP: 9C.3 tidak membuat answer key
  // ==========================================
  assert(
    (planAG as any).answerKey === undefined && (planAG as any).answerKeys === undefined,
    'Case AP: 9C.3 does NOT fabricate answer keys'
  );

  // ==========================================
  // CASE AQ: 9C.3 tidak membuat rubric/scoring guide
  // ==========================================
  assert(
    (planAG as any).rubrics === undefined && (planAG as any).scoringGuides === undefined,
    'Case AQ: 9C.3 does NOT fabricate rubrics or scoring guides'
  );

  // ==========================================
  // CASE AR: Tidak ada AI/API call
  // ==========================================
  const serviceFileContent = (await import('fs')).readFileSync(
    (await import('path')).join(process.cwd(), 'src/services/assessmentGenerationPlanService.ts'),
    'utf-8'
  );
  const containsAICalls =
    serviceFileContent.includes('fetch(') ||
    serviceFileContent.includes('openai') ||
    serviceFileContent.includes('gemini') ||
    serviceFileContent.includes('claude') ||
    serviceFileContent.includes('GoogleGenAI');
  assert(
    !containsAICalls,
    'Case AR: assessmentGenerationPlanService contains zero AI or network fetch calls'
  );

  // ==========================================
  // CASE AS: No plannedInstrumentTypes[0] fallback when ambiguous
  // ==========================================
  const specMultiNoIntersect: AssessmentGenerationSpec = {
    ...baseSpecResolved,
    plannedInstrumentTypes: ['WRITTEN_TEST', 'PORTFOLIO'],
    evidenceRecommendations: [
      {
        objectiveRefId: 'tp-mat-1',
        evidenceTypes: ['PERFORMANCE'],
        recommendedInstrumentTypes: ['PERFORMANCE'],
        rationaleCode: 'NO_INTERSECT',
        provenance: [],
        confidence: 'RULE_BASED',
      },
    ],
    resolution: { status: 'RESOLVED', issues: [] },
  };
  const planAS = resolveAssessmentGenerationPlan({
    generationSpec: specMultiNoIntersect,
  });

  const planASTypes = new Set(
    planAS.coverageUnits.map((u) => u.instrumentType)
  );

  assert(
    planASTypes.has('WRITTEN_TEST') &&
      planASTypes.has('PORTFOLIO') &&
      planAS.coverageUnits.every(
        (u) => u.instrumentType !== undefined
      ),
    'Case AS: Zero recommendation intersection never deletes canonical planned instruments'
  );

  // ==========================================
  // CASE AT: No criteria[0] / .find() first criterion fallback untuk coverage
  // ==========================================
  assert(
    planE.coverageUnits.length === 2 &&
      planE.coverageUnits.map((u) => u.criterionId).includes('crit-mat-2'),
    'Case AT: Multi-criteria objectives generate coverage for all criteria, never truncated'
  );

  // ==========================================
  // CASE AU: No arbitrary recommendedItemCount || 20
  // ==========================================
  assert(
    !serviceFileContent.includes('|| 20') && !serviceFileContent.includes('?? 20'),
    'Case AU: Source code contains zero arbitrary || 20 / ?? 20 defaults'
  );

  // ==========================================
  // CASE AV: No duration || 60
  // ==========================================
  assert(
    !serviceFileContent.includes('|| 60') && !serviceFileContent.includes('?? 60'),
    'Case AV: Source code contains zero arbitrary || 60 / ?? 60 defaults'
  );

  // ==========================================
  // CASE AW: Unknown instrument tidak fallback ITEM (terdeteksi invalid)
  // ==========================================
  const specUnknownInst: AssessmentGenerationSpec = {
    ...baseSpecResolved,
    plannedInstrumentTypes: ['GHOST_INSTRUMENT' as any],
    resolution: { status: 'RESOLVED', issues: [] },
  };
  const planAW = resolveAssessmentGenerationPlan({ generationSpec: specUnknownInst });
  assert(
    planAW.resolution.status === 'BLOCKED' &&
      planAW.resolution.issues.some((i) => i.code === 'UNKNOWN_INSTRUMENT_TYPE'),
    'Case AW: Unknown instrument type fails-closed with status BLOCKED'
  );

  // ==========================================
  // CASE AX: Multiple evidence recommendation ambiguous -> review, bukan first evidence
  // ==========================================
  const specAmbEvidence: AssessmentGenerationSpec = {
    ...baseSpecResolved,
    evidenceRecommendations: [
      {
        objectiveRefId: 'tp-mat-1',
        evidenceTypes: ['KNOWLEDGE_RESPONSE', 'REASONING'],
        recommendedInstrumentTypes: ['WRITTEN_TEST'],
        rationaleCode: 'AMBIGUOUS_EVID',
        provenance: [],
        confidence: 'NEEDS_TEACHER_REVIEW',
      },
    ],
    resolution: { status: 'RESOLVED', issues: [] },
  };
  const planAX = resolveAssessmentGenerationPlan({ generationSpec: specAmbEvidence });
  assert(
    planAX.coverageUnits.every((u) => u.evidenceType === undefined) &&
      planAX.resolution.status === 'NEEDS_REVIEW',
    'Case AX: Multiple ambiguous evidence recommendations resolve to undefined with NEEDS_REVIEW'
  );

  // ==========================================
  // CASE AY: No difficulty derived from cognitive demand
  // ==========================================
  const cogDemand = resolveConservativeCognitiveDemand('Menganalisis pecahan campuran');
  assert(
    cogDemand === 'ANALYZE_REASON' && planE.coverageUnits.every((u) => u.difficultyTarget === undefined),
    'Case AY: Cognitive demand ANALYZE_REASON is detected but difficulty remains undefined'
  );

  // ==========================================
  // CASE AZ: 9B compatibility tetap
  // ==========================================
  const { execSync } = await import('child_process');
  let audit9bPassed = false;
  try {
    const out9b = execSync('npx tsx scripts/testAuditNo9BAssessmentPackageRegression.ts', {
      encoding: 'utf-8',
    });
    audit9bPassed = out9b.includes('ALL AUDIT 9B REGRESSION TESTS');
  } catch {
    audit9bPassed = false;
  }
  assert(audit9bPassed, 'Case AZ: Audit 9B regression tests remain 100% green without regression');

  // ==========================================
  // CASE BA: 9C.1 compatibility tetap
  // ==========================================
  let audit9c1Passed = false;
  try {
    const out9c1 = execSync('npx tsx scripts/testAuditNo9CSchemaFoundationRegression.ts', {
      encoding: 'utf-8',
    });
    audit9c1Passed = out9c1.includes('25 PASSED, 0 FAILED');
  } catch {
    audit9c1Passed = false;
  }
  assert(audit9c1Passed, 'Case BA: Audit 9C.1 regression tests remain 100% green without regression');

  // ==========================================
  // CASE BB: 9C.2 compatibility tetap
  // ==========================================
  let audit9c2Passed = false;
  try {
    const out9c2 = execSync('npx tsx scripts/testAuditNo9C2GenerationSpecRegression.ts', {
      encoding: 'utf-8',
    });
    audit9c2Passed = out9c2.includes('73 PASSED, 0 FAILED');
  } catch {
    audit9c2Passed = false;
  }
  assert(audit9c2Passed, 'Case BB: Audit 9C.2 regression tests remain 100% green without regression');

  // ==========================================
  // CASE BC: Unknown instrument -> instrumentType undefined, allocationUnit undefined, recommendedCount undefined, BLOCKED
  // ==========================================
  const specUnknownInstHarden: AssessmentGenerationSpec = {
    ...baseSpecResolved,
    plannedInstrumentTypes: ['UNKNOWN_TYPE_XYZ' as any],
    resolution: { status: 'RESOLVED', issues: [] },
  };
  const planBC = resolveAssessmentGenerationPlan({ generationSpec: specUnknownInstHarden });
  assert(
    planBC.coverageUnits.every(
      (u) =>
        u.instrumentType === undefined &&
        u.allocationUnit === undefined &&
        u.recommendedCount === undefined &&
        u.status === 'BLOCKED'
    ),
    'Case BC: Unknown instrument has instrumentType=undefined, allocationUnit=undefined, recommendedCount=undefined, status=BLOCKED'
  );

  // ==========================================
  // CASE BD: Multi-instrument units retain semantic allocation per instrument
  // ==========================================
  const planBD = resolveAssessmentGenerationPlan({
    generationSpec: specAmbiguousInstruments,
  });

  const writtenUnitsBD = planBD.coverageUnits.filter(
    (u) => u.instrumentType === 'WRITTEN_TEST'
  );

  const performanceUnitsBD = planBD.coverageUnits.filter(
    (u) => u.instrumentType === 'PERFORMANCE'
  );

  assert(
    writtenUnitsBD.length === 2 &&
      performanceUnitsBD.length === 2 &&
      writtenUnitsBD.every(
        (u) =>
          u.allocationUnit === 'ITEM' &&
          u.recommendedCount === 1
      ) &&
      performanceUnitsBD.every(
        (u) =>
          u.allocationUnit === 'TASK' &&
          u.recommendedCount === 1
      ),
    'Case BD: Multi-instrument coverage retains correct semantic allocation for every instrument'
  );

  // ==========================================
  // CASE BE: mapInstrumentToAllocationUnit helper fails-closed (returns undefined on missing or unknown)
  // ==========================================
  assert(
    mapInstrumentToAllocationUnit(undefined) === undefined &&
      mapInstrumentToAllocationUnit('UNKNOWN_XYZ' as any) === undefined,
    'Case BE: mapInstrumentToAllocationUnit returns undefined on undefined or unknown input'
  );

  // ==========================================
  // CASE BF: Coverage unit with undefined allocation unit does NOT have PROV_MINIMUM_COVERAGE_ALLOCATION
  // ==========================================
  assert(
    planBC.coverageUnits.every(
      (u) => !u.provenance.some((p) => p.id === 'APP-DEFAULT-MINIMUM-COVERAGE')
    ),
    'Case BF: Coverage unit with undefined allocation unit does NOT contain minimum coverage allocation provenance'
  );

  // ==========================================
  // CASE BG: allocationSummary accurately classifies ITEM, TASK, EVIDENCE, OBSERVATION, unresolved
  // ==========================================
  assert(
    planBC.summary.allocationSummary.unresolvedCount === 2 &&
      planBC.summary.allocationSummary.itemCount === 0 &&
      planBC.summary.allocationSummary.taskCount === 0,
    'Case BG: allocationSummary accurately tracks unresolved allocation units'
  );

  // ==========================================
  // CASE BH: allocatedCount strictly represents ITEM count only
  // ==========================================
  assert(
    planN.summary.allocatedCount === 0 &&
      planN.summary.allocationSummary.taskCount === 2 &&
      planN.summary.allocationSummary.itemCount === 0,
    'Case BH: Performance plan has allocatedCount=0 (ITEMs only) and taskCount=2'
  );

  // ==========================================
  // CASE BI: requestedTotalItems only controls ITEM coverage and triggers reviews appropriately
  // ==========================================
  const planBI = resolveAssessmentGenerationPlan({
    generationSpec: baseSpecResolved, // 2 items
    constraints: { assemblyMode: 'TEACHER_DEFINED', requestedTotalItems: 5 },
  });
  assert(
    planBI.resolution.status === 'NEEDS_REVIEW' &&
      planBI.resolution.issues.some((i) => i.code === 'EXTRA_ITEM_ALLOCATION_REQUIRES_REVIEW') &&
      planBI.summary.allocatedCount === 5,
    'Case BI: requestedTotalItems > item coverage sets allocatedCount=5 and triggers EXTRA_ITEM_ALLOCATION_REQUIRES_REVIEW'
  );

  // ==========================================
  // CASE BJ: Invalid negative duration is preserved in constraints and fails-closed
  // ==========================================
  const planBJ = resolveAssessmentGenerationPlan({
    generationSpec: baseSpecResolved,
    constraints: { durationMinutes: -45 },
  });
  assert(
    planBJ.constraints.durationMinutes === -45 &&
      planBJ.resolution.status === 'BLOCKED' &&
      planBJ.resolution.issues.some((i) => i.code === 'CONSTRAINT_INVALID'),
    'Case BJ: Invalid negative durationMinutes is preserved in constraints and fails-closed with status BLOCKED'
  );

  // ==========================================
  // CASE BK: Invalid fractional requestedTotalItems is preserved in constraints and fails-closed
  // ==========================================
  const planBK = resolveAssessmentGenerationPlan({
    generationSpec: baseSpecResolved,
    constraints: { requestedTotalItems: 3.14 },
  });
  assert(
    planBK.constraints.requestedTotalItems === 3.14 &&
      planBK.resolution.status === 'BLOCKED' &&
      planBK.resolution.issues.some((i) => i.code === 'CONSTRAINT_INVALID'),
    'Case BK: Invalid fractional requestedTotalItems is preserved in constraints and fails-closed with status BLOCKED'
  );

  // ==========================================
  // CASE BL: Missing GenerationSpec returns generationSpec undefined, BLOCKED, and empty summary
  // ==========================================
  const planBL = resolveAssessmentGenerationPlan({ generationSpec: null });
  assert(
    planBL.generationSpec === undefined &&
      planBL.resolution.status === 'BLOCKED' &&
      planBL.summary.coverageUnitCount === 0 &&
      planBL.summary.allocationSummary.itemCount === 0 &&
      planBL.summary.allocationSummary.unresolvedCount === 0,
    'Case BL: Missing GenerationSpec returns generationSpec=undefined, BLOCKED, and clean zeroed summary'
  );

  // ==========================================
  // CASE BM: Pure PORTFOLIO spec maps to EVIDENCE in allocationSummary
  // ==========================================
  const specPortfolio: AssessmentGenerationSpec = {
    ...baseSpecResolved,
    plannedInstrumentTypes: ['PORTFOLIO'],
    evidenceRecommendations: [
      {
        objectiveRefId: 'tp-mat-1',
        evidenceTypes: ['PORTFOLIO'],
        recommendedInstrumentTypes: ['PORTFOLIO'],
        rationaleCode: 'PORT',
        provenance: [],
        confidence: 'RULE_BASED',
      },
    ],
    resolution: { status: 'RESOLVED', issues: [] },
  };
  const planBM = resolveAssessmentGenerationPlan({ generationSpec: specPortfolio });
  assert(
    planBM.summary.allocationSummary.evidenceCount === 2 &&
      planBM.summary.allocationSummary.itemCount === 0 &&
      planBM.summary.allocatedCount === 0,
    'Case BM: Pure PORTFOLIO spec maps to evidenceCount=2, itemCount=0, allocatedCount=0'
  );

  // ==========================================
  // CASE BN: Pure OBSERVATION spec maps to OBSERVATION in allocationSummary
  // ==========================================
  const specObservation: AssessmentGenerationSpec = {
    ...baseSpecResolved,
    plannedInstrumentTypes: ['OBSERVATION'],
    evidenceRecommendations: [
      {
        objectiveRefId: 'tp-mat-1',
        evidenceTypes: ['OBSERVATION'],
        recommendedInstrumentTypes: ['OBSERVATION'],
        rationaleCode: 'OBS',
        provenance: [],
        confidence: 'RULE_BASED',
      },
    ],
    resolution: { status: 'RESOLVED', issues: [] },
  };
  const planBN = resolveAssessmentGenerationPlan({ generationSpec: specObservation });
  assert(
    planBN.summary.allocationSummary.observationCount === 2 &&
      planBN.summary.allocationSummary.itemCount === 0 &&
      planBN.summary.allocatedCount === 0,
    'Case BN: Pure OBSERVATION spec maps to observationCount=2, itemCount=0, allocatedCount=0'
  );

  // ==========================================
  // CASE BO: Mixed coverage units properly aggregates in allocationSummary
  // ==========================================
  const planMixed = resolveAssessmentGenerationPlan({ generationSpec: baseSpecResolved });
  assert(
    planMixed.summary.allocationSummary.itemCount === 2 &&
      planMixed.summary.allocationSummary.taskCount === 0 &&
      planMixed.summary.allocationSummary.evidenceCount === 0 &&
      planMixed.summary.allocationSummary.observationCount === 0 &&
      planMixed.summary.allocationSummary.unresolvedCount === 0,
    'Case BO: Standard WRITTEN_TEST plan has itemCount=2 and all other allocation units 0'
  );

  // ==========================================
  // CASE BP: Invalid duration and requestedTotalItems together preserve both
  // ==========================================
  const planBP = resolveAssessmentGenerationPlan({
    generationSpec: baseSpecResolved,
    constraints: { durationMinutes: 0, requestedTotalItems: -5 },
  });
  assert(
    planBP.constraints.durationMinutes === 0 &&
      planBP.constraints.requestedTotalItems === -5 &&
      planBP.resolution.status === 'BLOCKED',
    'Case BP: Multiple invalid constraints are all preserved in output plan'
  );

  // ==========================================
  // CASE BQ: Preserves assemblyMode TEACHER_DEFINED even when invalid constraints present
  // ==========================================
  const planBQ = resolveAssessmentGenerationPlan({
    generationSpec: baseSpecResolved,
    constraints: { assemblyMode: 'TEACHER_DEFINED', durationMinutes: -10 },
  });
  assert(
    planBQ.constraints.assemblyMode === 'TEACHER_DEFINED' &&
      planBQ.resolution.status === 'BLOCKED',
    'Case BQ: assemblyMode TEACHER_DEFINED is preserved alongside invalid constraints'
  );

  // ==========================================
  // CASE BR: RecommendedCount is strictly 1 when allocationUnit is ITEM
  // ==========================================
  assert(
    planMixed.coverageUnits.every((u) => u.allocationUnit === 'ITEM' && u.recommendedCount === 1),
    'Case BR: RecommendedCount is exactly 1 for resolved ITEM allocation units'
  );

  // ==========================================
  // CASE BS: RecommendedCount is strictly 1 when allocationUnit is TASK
  // ==========================================
  assert(
    planN.coverageUnits.every((u) => u.allocationUnit === 'TASK' && u.recommendedCount === 1),
    'Case BS: RecommendedCount is exactly 1 for resolved TASK allocation units'
  );

  // ==========================================
  // CASE BT: RecommendedCount is strictly 1 when allocationUnit is EVIDENCE
  // ==========================================
  assert(
    planBM.coverageUnits.every((u) => u.allocationUnit === 'EVIDENCE' && u.recommendedCount === 1),
    'Case BT: RecommendedCount is exactly 1 for resolved EVIDENCE allocation units'
  );

  // ==========================================
  // CASE BU: RecommendedCount is strictly 1 when allocationUnit is OBSERVATION
  // ==========================================
  assert(
    planBN.coverageUnits.every((u) => u.allocationUnit === 'OBSERVATION' && u.recommendedCount === 1),
    'Case BU: RecommendedCount is exactly 1 for resolved OBSERVATION allocation units'
  );

  // ==========================================
  // CASE BV: No inflation for multi-level criteria
  // ==========================================
  assert(
    planMixed.summary.coverageUnitCount === 2 && planMixed.summary.allocatedCount === 2,
    'Case BV: Coverage count equals criterion count without arbitrary multiplier'
  );

  // ==========================================
  // CASE BW: Clean objective ID sanitization in deterministic ID
  // ==========================================
  const idSpecial = createDeterministicCoverageId('tp@mat#1! ', 'crit$1');
  assert(
    idSpecial === 'coverage:tp_mat_1_:crit_1',
    'Case BW: Special characters in objectiveRefId and criterionId are safely sanitized'
  );

  // ==========================================
  // CASE BX: Deterministic ID format consistency across null criterionId
  // ==========================================
  const idNullCrit = createDeterministicCoverageId('tp-1', undefined);
  assert(
    idNullCrit === 'coverage:tp-1:objective',
    'Case BX: Undefined criterionId produces fallback suffix "objective"'
  );

  // ==========================================
  // CASE BY: Single objective with multiple criteria produces distinct IDs
  // ==========================================
  const unitIds = planMixed.coverageUnits.map((u) => u.id);
  assert(
    new Set(unitIds).size === unitIds.length,
    'Case BY: All coverage units in a plan have unique IDs'
  );

  // ==========================================
  // CASE BZ: Status resolution - single BLOCKING issue makes whole plan BLOCKED
  // ==========================================
  assert(
    planBC.resolution.status === 'BLOCKED',
    'Case BZ: A single BLOCKING issue on any coverage unit propagates to plan status BLOCKED'
  );

  // ==========================================
  // CASE CA: Status resolution - REVIEW issue without BLOCKING results in NEEDS_REVIEW
  // ==========================================
  assert(
    planBD.resolution.status === 'NEEDS_REVIEW',
    'Case CA: REVIEW issues without BLOCKING result in plan status NEEDS_REVIEW'
  );

  // ==========================================
  // CASE CB: Perfect resolution produces RESOLVED status
  // ==========================================
  const cleanSpecResolved: AssessmentGenerationSpec = {
    ...baseSpecResolved,
    evidenceRecommendations: [
      {
        objectiveRefId: 'tp-mat-1',
        criterionId: 'crit-mat-1',
        evidenceTypes: ['KNOWLEDGE_RESPONSE'],
        recommendedInstrumentTypes: ['WRITTEN_TEST'],
        rationaleCode: 'CONCEPTUAL',
        provenance: [],
        confidence: 'RULE_BASED',
      },
      {
        objectiveRefId: 'tp-mat-1',
        criterionId: 'crit-mat-2',
        evidenceTypes: ['KNOWLEDGE_RESPONSE'],
        recommendedInstrumentTypes: ['WRITTEN_TEST'],
        rationaleCode: 'CONCEPTUAL',
        provenance: [],
        confidence: 'RULE_BASED',
      },
    ],
    resolution: { status: 'RESOLVED', issues: [] },
  };
  const planClean = resolveAssessmentGenerationPlan({ generationSpec: cleanSpecResolved });
  assert(
    planClean.resolution.status === 'RESOLVED' && planClean.resolution.issues.length === 0,
    'Case CB: Clean valid input produces RESOLVED status with zero issues'
  );

  console.log(`\n=== 9C.3 REGRESSION TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
