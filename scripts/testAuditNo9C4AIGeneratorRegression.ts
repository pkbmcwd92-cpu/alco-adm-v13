import {
  AcademicSetting,
  AssessmentCriterion,
  AssessmentGenerationPlan,
  AssessmentGenerationSpec,
  AssessmentPackage,
  AssessmentPlan,
  GenerateAssessmentPackageInput,
  AssessmentAIGenerationProvider,
  AssessmentAIGenerationRequest,
  AssessmentAIGenerationRawResponse,
  TPData,
} from '../src/types';
import { resolveAssessmentGenerationSpec } from '../src/services/assessmentGenerationSpecService';
import { resolveAssessmentGenerationPlan } from '../src/services/assessmentGenerationPlanService';
import {
  generateAssessmentPackageDraft,
  validatePreGenerationGuards,
  resolveAuthoritativeAcademicSettingId,
  buildGenerationContract,
  buildGenerationPrompts,
  parseAndValidateRawAIResponse,
  mapGeneratedUnitsToAssessmentPackage,
  createDeterministicBlueprintId,
  createDeterministicInstrumentId,
  createDeterministicItemId,
  createDeterministicOptionId,
} from '../src/services/assessmentPackageGeneratorService';

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

// Mock AI Provider that tracks call count and returns predetermined response
class MockAIProvider implements AssessmentAIGenerationProvider {
  public callCount = 0;
  public lastRequest?: AssessmentAIGenerationRequest;
  public responseGenerator: (req: AssessmentAIGenerationRequest) => string;

  constructor(responseGenerator: (req: AssessmentAIGenerationRequest) => string) {
    this.responseGenerator = responseGenerator;
  }

  async generate(request: AssessmentAIGenerationRequest): Promise<AssessmentAIGenerationRawResponse> {
    this.callCount++;
    this.lastRequest = request;
    return {
      rawText: this.responseGenerator(request),
    };
  }
}

async function runRegressionSuite() {
  console.log('=== STARTING AUDIT 9C.4 AI ASSESSMENT GENERATOR REGRESSION TEST SUITE ===\n');

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
        tp: 'Menyelesaikan masalah berkaitan dengan pecahan senilai',
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
      tpId: 'tp-mat-2',
      description: 'Peserta didik mampu menerapkan operasi pecahan dalam soal cerita',
      approach: 'deskripsi',
      indicators: ['Menghitung penyelesaian pecahan'],
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
    tpIds: ['tp-mat-1', 'tp-mat-2'],
    criterionIds: ['crit-mat-1', 'crit-mat-2'],
    instruments: [{ id: 'inst-ref-1', type: 'WRITTEN_TEST', label: 'Tes Tertulis Pilihan Ganda & Uraian' }],
    workflowStatus: 'SIAP',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Upstream Resolution
  const spec = resolveAssessmentGenerationSpec({
    academicSetting: mockAcademicSettingSD4,
    assessmentPlan: mockPlanMatSiap,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });

  const validPlan = resolveAssessmentGenerationPlan({
    generationSpec: spec,
  });

  // ----------------------------------------------------
  // SECTION 1: PRE-GENERATION GUARDS (FAIL-CLOSED)
  // ----------------------------------------------------
  console.log('--- SECTION 1: PRE-GENERATION GUARDS & FAIL-CLOSED INTEGRITY ---');

  // Case 1: Missing input
  const guardRes1 = validatePreGenerationGuards(null as any);
  assert(guardRes1.valid === false, 'Case 1: Null input fails pre-generation guard');
  assert(guardRes1.issues.some((i) => i.code === 'PLAN_MISSING'), 'Case 1: Returns PLAN_MISSING issue');

  // Case 2: Missing generationPlan
  const guardRes2 = validatePreGenerationGuards({} as any);
  assert(guardRes2.valid === false, 'Case 2: Empty input fails pre-generation guard');
  assert(guardRes2.issues.some((i) => i.code === 'PLAN_MISSING'), 'Case 2: Returns PLAN_MISSING issue');

  // Case 3: Blocked generationPlan
  const blockedPlan: AssessmentGenerationPlan = {
    ...validPlan,
    resolution: { status: 'BLOCKED', issues: [{ code: 'TEST_BLOCKED', severity: 'BLOCKING', message: 'Blocked' }] },
  };
  const guardRes3 = validatePreGenerationGuards({ generationPlan: blockedPlan });
  assert(guardRes3.valid === false, 'Case 3: Blocked generationPlan fails pre-generation guard');
  assert(guardRes3.issues.some((i) => i.code === 'PLAN_BLOCKED'), 'Case 3: Returns PLAN_BLOCKED issue');

  // Case 4: Missing generationSpec in plan
  const noSpecPlan: AssessmentGenerationPlan = {
    ...validPlan,
    generationSpec: undefined,
  };
  const guardRes4 = validatePreGenerationGuards({ generationPlan: noSpecPlan });
  assert(guardRes4.valid === false, 'Case 4: Plan without spec fails pre-generation guard');
  assert(guardRes4.issues.some((i) => i.code === 'SPEC_MISSING'), 'Case 4: Returns SPEC_MISSING issue');

  // Case 5: Blocked generationSpec
  const blockedSpecPlan: AssessmentGenerationPlan = {
    ...validPlan,
    generationSpec: {
      ...spec,
      resolution: { status: 'BLOCKED', issues: [{ code: 'SPEC_ERR', severity: 'BLOCKING', message: 'Err' }] },
    },
  };
  const guardRes5 = validatePreGenerationGuards({ generationPlan: blockedSpecPlan });
  assert(guardRes5.valid === false, 'Case 5: Plan with blocked spec fails pre-generation guard');
  assert(guardRes5.issues.some((i) => i.code === 'SPEC_BLOCKED'), 'Case 5: Returns SPEC_BLOCKED issue');

  // Case 6: Empty coverage units
  const noCoveragePlan: AssessmentGenerationPlan = {
    ...validPlan,
    coverageUnits: [],
  };
  const guardRes6 = validatePreGenerationGuards({ generationPlan: noCoveragePlan });
  assert(guardRes6.valid === false, 'Case 6: Plan with no coverage units fails pre-generation guard');
  assert(guardRes6.issues.some((i) => i.code === 'NO_COVERAGE_UNITS'), 'Case 6: Returns NO_COVERAGE_UNITS issue');

  // Case 7: Unresolved objective reference
  const unresolvedObjPlan: AssessmentGenerationPlan = {
    ...validPlan,
    coverageUnits: [
      {
        ...validPlan.coverageUnits[0],
        objectiveRefId: 'non-existent-tp-id',
      },
    ],
  };
  const guardRes7 = validatePreGenerationGuards({ generationPlan: unresolvedObjPlan });
  assert(guardRes7.valid === false, 'Case 7: Unresolved objective ref fails guard');
  assert(guardRes7.issues.some((i) => i.code === 'UNRESOLVED_OBJECTIVE_REF'), 'Case 7: Returns UNRESOLVED_OBJECTIVE_REF');

  // Case 8: Dangling criterion reference
  const danglingCritPlan: AssessmentGenerationPlan = {
    ...validPlan,
    coverageUnits: [
      {
        ...validPlan.coverageUnits[0],
        criterionId: 'non-existent-crit-id',
      },
    ],
  };
  const guardRes8 = validatePreGenerationGuards({ generationPlan: danglingCritPlan });
  assert(guardRes8.valid === false, 'Case 8: Dangling criterion ref fails guard');
  assert(guardRes8.issues.some((i) => i.code === 'DANGLING_CRITERION_REF'), 'Case 8: Returns DANGLING_CRITERION_REF');

  // Case 9: Criterion objective mismatch
  const mismatchCritPlan: AssessmentGenerationPlan = {
    ...validPlan,
    coverageUnits: [
      {
        ...validPlan.coverageUnits[0],
        objectiveRefId: 'tp-mat-1',
        criterionId: 'crit-mat-2', // crit-mat-2 belongs to tp-mat-2
      },
    ],
  };
  const guardRes9 = validatePreGenerationGuards({ generationPlan: mismatchCritPlan });
  assert(guardRes9.valid === false, 'Case 9: Criterion pointing to different objective fails guard');
  assert(guardRes9.issues.some((i) => i.code === 'CRITERION_OBJECTIVE_MISMATCH'), 'Case 9: Returns CRITERION_OBJECTIVE_MISMATCH');

  // Case 10: Unresolved instrument type
  const unresolvedInstPlan: AssessmentGenerationPlan = {
    ...validPlan,
    coverageUnits: [
      {
        ...validPlan.coverageUnits[0],
        instrumentType: undefined as any,
      },
    ],
  };
  const guardRes10 = validatePreGenerationGuards({ generationPlan: unresolvedInstPlan });
  assert(guardRes10.valid === false, 'Case 10: Unresolved instrument type fails guard');
  assert(guardRes10.issues.some((i) => i.code === 'UNRESOLVED_INSTRUMENT_TYPE'), 'Case 10: Returns UNRESOLVED_INSTRUMENT_TYPE');

  // Case 11: Invalid recommended count
  const invalidCountPlan: AssessmentGenerationPlan = {
    ...validPlan,
    coverageUnits: [
      {
        ...validPlan.coverageUnits[0],
        recommendedCount: 0,
      },
    ],
  };
  const guardRes11 = validatePreGenerationGuards({ generationPlan: invalidCountPlan });
  assert(guardRes11.valid === false, 'Case 11: Invalid recommendedCount (0) fails guard');
  assert(guardRes11.issues.some((i) => i.code === 'INVALID_UNIT_COUNT'), 'Case 11: Returns INVALID_UNIT_COUNT');

  // Case 12: Existing package already SIAP
  const mockSiapPackage: AssessmentPackage = {
    id: 'pkg-existing-siap',
    assessmentPlanId: 'plan-mat-1',
    academicSettingId: 'setting-sd-4',
    title: 'Paket Siap',
    blueprintItems: [],
    instruments: [],
    answerKeys: [],
    scoringGuides: [],
    rubrics: [],
    workflowStatus: 'SIAP',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const guardRes12 = validatePreGenerationGuards({
    generationPlan: validPlan,
    existingPackage: mockSiapPackage,
  });
  assert(guardRes12.valid === false, 'Case 12: Confirmed SIAP package is protected from AI override');
  assert(guardRes12.issues.some((i) => i.code === 'EXISTING_PACKAGE_CONFIRMED_SIAP'), 'Case 12: Returns EXISTING_PACKAGE_CONFIRMED_SIAP');

  // Case 13: Existing package teacher authored is protected
  const mockTeacherPackage: AssessmentPackage = {
    id: 'pkg-existing-teacher',
    assessmentPlanId: 'plan-mat-1',
    academicSettingId: 'setting-sd-4',
    title: 'Paket Buatan Guru',
    blueprintItems: [{ id: 'bp-1', objectiveRefId: 'tp-mat-1', instrumentType: 'WRITTEN_TEST', instrumentItemIds: [], order: 1 }],
    instruments: [{ id: 'inst-1', type: 'WRITTEN_TEST', items: [] }],
    answerKeys: [],
    scoringGuides: [],
    rubrics: [],
    workflowStatus: 'DRAFT',
    provenance: { generatedBy: 'USER', generatedAt: new Date().toISOString() },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const guardRes13 = validatePreGenerationGuards({
    generationPlan: validPlan,
    existingPackage: mockTeacherPackage,
  });
  assert(guardRes13.valid === false, 'Case 13: Teacher-authored package is protected from silent override');
  assert(guardRes13.issues.some((i) => i.code === 'EXISTING_PACKAGE_TEACHER_PROTECTED'), 'Case 13: Returns EXISTING_PACKAGE_TEACHER_PROTECTED');

  // Case 14: Provider is NEVER called when pre-guards fail
  const provider14 = new MockAIProvider(() => '[]');
  const result14 = await generateAssessmentPackageDraft({
    generationPlan: blockedPlan,
    provider: provider14,
  });
  assert(result14.status === 'BLOCKED', 'Case 14: Overall status is BLOCKED');
  assert(provider14.callCount === 0, 'Case 14: Provider was NEVER called when pre-guards failed');

  // ----------------------------------------------------
  // SECTION 2: GENERATION CONTRACT & DETERMINISTIC PROMPTS
  // ----------------------------------------------------
  console.log('\n--- SECTION 2: GENERATION CONTRACT & PROMPTS ---');

  const contract = buildGenerationContract(validPlan, {
    instructions: 'Sertakan contoh benda konkret di sekitar kelas',
    focusAreas: ['Pecahan sederhana'],
  });

  assert(contract.assessmentPlanId === spec.assessmentPlanId, 'Case 15: Contract has correct assessmentPlanId');
  assert(contract.assessmentPackageId === spec.assessmentPackageId, 'Case 16: Contract has correct assessmentPackageId');
  assert(contract.units.length === validPlan.coverageUnits.length, 'Case 17: Contract units match coverage units 1:1');
  assert(contract.units[0].objectiveText.includes('pecahan senilai'), 'Case 18: Objective text populated from canonical TP');
  assert(contract.units[0].criterionText!.includes('mengidentifikasi'), 'Case 19: Criterion text populated from canonical KKTP');
  assert(contract.units[0].assessmentIndicator === undefined, 'Case 20: Indicator is undefined when teacher indicator absent');
  assert(contract.units[0].indicatorSource === undefined, 'Case 20: Indicator source is undefined when teacher indicator absent');

  const { systemPrompt, userPrompt } = buildGenerationPrompts(contract, {
    instructions: 'Sertakan benda konkret',
  });
  assert(systemPrompt.includes('AI ADALAH CONTENT GENERATOR'), 'Case 21: System prompt establishes strict generator role');
  assert(systemPrompt.includes('JANGAN mengubah atau mengarang Tujuan Pembelajaran'), 'Case 22: System prompt forbids inventing curriculum');
  assert(userPrompt.includes('Kelas 4'), 'Case 23: User prompt includes grade context');

  assert(
    systemPrompt.includes('taskPrompt') &&
      systemPrompt.includes('evidenceRequirements') &&
      systemPrompt.includes('aspects'),
    'B.1.2 Case 1: Prompt exposes exact semantic JSON field names required by parser'
  );

  assert(
    systemPrompt.includes('ITEM → itemType + prompt') &&
      systemPrompt.includes('TASK → taskPrompt') &&
      systemPrompt.includes('EVIDENCE → evidenceRequirements') &&
      systemPrompt.includes('OBSERVATION → aspects'),
    'B.1.2 Case 2: Prompt maps every allocation family to exact output fields'
  );

  // ----------------------------------------------------
  // B.1 INTEGRATION: MULTI-INSTRUMENT COVERAGE
  // ----------------------------------------------------

  const multiInstrumentSpecB1: AssessmentGenerationSpec = {
    ...spec,
    plannedInstrumentTypes: [
      'WRITTEN_TEST',
      'PERFORMANCE',
    ],
    evidenceRecommendations: (
      spec.evidenceRecommendations || []
    ).map((rec) => ({
      ...rec,
      recommendedInstrumentTypes: [
        'WRITTEN_TEST',
        'PERFORMANCE',
      ],
      confidence: 'RULE_BASED',
    })),
    resolution: {
      status: 'RESOLVED',
      issues: [],
    },
  };

  const multiInstrumentPlanB1 =
    resolveAssessmentGenerationPlan({
      generationSpec: multiInstrumentSpecB1,
    });

  const multiInstrumentTypesB1 = new Set(
    multiInstrumentPlanB1.coverageUnits.map(
      (unit) => unit.instrumentType
    )
  );

  assert(
    multiInstrumentTypesB1.has('WRITTEN_TEST') &&
      multiInstrumentTypesB1.has('PERFORMANCE'),
    'B.1 Case 1: GenerationPlan retains every canonical planned instrument'
  );

  assert(
    new Set(
      multiInstrumentPlanB1.coverageUnits.map(
        (unit) => unit.id
      )
    ).size ===
      multiInstrumentPlanB1.coverageUnits.length,
    'B.1 Case 2: Multi-instrument coverage IDs remain globally unique'
  );

  const multiInstrumentGuardB1 =
    validatePreGenerationGuards({
      generationPlan: multiInstrumentPlanB1,
    });

  assert(
    multiInstrumentGuardB1.valid === true,
    'B.1 Case 3: Valid multi-instrument GenerationPlan passes pre-generation guards',
    multiInstrumentGuardB1.issues
      .map((issue) => issue.code)
      .join(', ')
  );

  const multiInstrumentContractB1 =
    buildGenerationContract(
      multiInstrumentPlanB1
    );

  const contractInstrumentTypesB1 = new Set(
    multiInstrumentContractB1.units.map(
      (unit) => unit.instrumentType
    )
  );

  assert(
    multiInstrumentContractB1.units.length ===
      multiInstrumentPlanB1.coverageUnits.length &&
      contractInstrumentTypesB1.has(
        'WRITTEN_TEST'
      ) &&
      contractInstrumentTypesB1.has(
        'PERFORMANCE'
      ),
    'B.1 Case 4: GenerationContract preserves all multi-instrument coverage units 1:1'
  );

  assert(
    multiInstrumentContractB1.units.some(
      (unit) =>
        unit.instrumentType === 'WRITTEN_TEST' &&
        unit.allocationUnit === 'ITEM'
    ) &&
      multiInstrumentContractB1.units.some(
        (unit) =>
          unit.instrumentType === 'PERFORMANCE' &&
          unit.allocationUnit === 'TASK'
      ),
    'B.1 Case 5: Downstream generation contract preserves semantic allocation per instrument'
  );

  // ----------------------------------------------------
  // SECTION 3: RUNTIME PARSING, VALIDATION & REJECTION RULES
  // ----------------------------------------------------
  console.log('\n--- SECTION 3: RUNTIME PARSING & REFERENCE REJECTION ---');

  // Case 24: Malformed JSON output
  const parseRes24 = parseAndValidateRawAIResponse('Ini bukan JSON valid {broken:', contract);
  assert(parseRes24.validatedUnits.length === 0, 'Case 24: Malformed JSON yields 0 validated units');
  assert(parseRes24.issues.some((i) => i.code === 'MALFORMED_AI_RESPONSE'), 'Case 24: Issues contain MALFORMED_AI_RESPONSE');

  // Case 25: JSON wrapped in markdown code fence
  const unit0 = contract.units[0];
  const validItemJson = JSON.stringify([
    {
      coverageUnitId: unit0.coverageUnitId,
      objectiveRefId: unit0.objectiveRefId,
      criterionId: unit0.criterionId,
      instrumentType: unit0.instrumentType,
      allocationUnit: unit0.allocationUnit,
      itemType: 'MULTIPLE_CHOICE',
      prompt: 'Manakah pecahan yang senilai dengan 1/2?',
      options: [
        { text: '2/4', isCorrect: true },
        { text: '1/3', isCorrect: false },
        { text: '3/5', isCorrect: false },
        { text: '2/6', isCorrect: false },
      ],
      proposedAnswer: {
        answerType: 'OPTION',
        optionIndices: [0],
        value: '2/4',
        explanation: '1/2 dikalikan 2/2 menghasilkan 2/4.',
      },
    },
  ]);
  const parseRes25 = parseAndValidateRawAIResponse(`\`\`\`json\n${validItemJson}\n\`\`\``, contract);
  assert(parseRes25.validatedUnits.length === 1, 'Case 25: Markdown code fences stripped safely and parsed');

  // Case 26: Candidate with unknown coverageUnitId (ID > TEXT MATCH)
  const unknownIdJson = JSON.stringify([
    {
      coverageUnitId: 'coverage:invented_fake_id',
      objectiveRefId: unit0.objectiveRefId,
      instrumentType: 'WRITTEN_TEST',
      allocationUnit: 'ITEM',
      prompt: 'Soal dengan ID fiktif',
    },
  ]);
  const parseRes26 = parseAndValidateRawAIResponse(unknownIdJson, contract);
  assert(parseRes26.validatedUnits.length === 0, 'Case 26: Candidate with unknown coverageUnitId rejected');
  assert(parseRes26.issues.some((i) => i.code === 'UNKNOWN_COVERAGE_UNIT_ID'), 'Case 26: Returns UNKNOWN_COVERAGE_UNIT_ID');

  // Case 27: ObjectiveRefId mismatch
  const mismatchObjJson = JSON.stringify([
    {
      coverageUnitId: unit0.coverageUnitId,
      objectiveRefId: 'tp-different-id',
      criterionId: unit0.criterionId,
      instrumentType: unit0.instrumentType,
      allocationUnit: unit0.allocationUnit,
      prompt: 'Soal dengan objective beda',
    },
  ]);
  const parseRes27 = parseAndValidateRawAIResponse(mismatchObjJson, contract);
  assert(parseRes27.validatedUnits.length === 0, 'Case 27: Candidate with objectiveRefId mismatch rejected');
  assert(parseRes27.issues.some((i) => i.code === 'OBJECTIVE_REF_MISMATCH'), 'Case 27: Returns OBJECTIVE_REF_MISMATCH');

  // Case 28: InstrumentType mismatch
  const mismatchInstJson = JSON.stringify([
    {
      coverageUnitId: unit0.coverageUnitId,
      objectiveRefId: unit0.objectiveRefId,
      criterionId: unit0.criterionId,
      instrumentType: 'ORAL_TEST', // contract specified WRITTEN_TEST
      allocationUnit: unit0.allocationUnit,
      prompt: 'Soal tes lisan',
    },
  ]);
  const parseRes28 = parseAndValidateRawAIResponse(mismatchInstJson, contract);
  assert(parseRes28.validatedUnits.length === 0, 'Case 28: Candidate with instrumentType mismatch rejected');
  assert(parseRes28.issues.some((i) => i.code === 'INSTRUMENT_TYPE_MISMATCH'), 'Case 28: Returns INSTRUMENT_TYPE_MISMATCH');

  // ----------------------------------------------------
  // B.1.1 CANONICAL CONTRACT HYDRATION
  // ----------------------------------------------------

  // Missing canonical echoes are allowed when coverageUnitId is valid.
  const hydratedItemJson = JSON.stringify([
    {
      coverageUnitId: unit0.coverageUnitId,
      itemType: 'MULTIPLE_CHOICE',
      prompt: 'Manakah gerak yang termasuk gerak lokomotor?',
      options: [
        { text: 'Berjalan' },
        { text: 'Membungkuk' },
        { text: 'Memutar tangan' },
        { text: 'Menekuk siku' },
      ],
    },
  ]);

  const hydratedItemResult =
    parseAndValidateRawAIResponse(
      hydratedItemJson,
      contract
    );

  assert(
    hydratedItemResult.validatedUnits.length === 1 &&
      hydratedItemResult.validatedUnits[0].coverageUnitId ===
        unit0.coverageUnitId &&
      hydratedItemResult.validatedUnits[0].objectiveRefId ===
        unit0.objectiveRefId &&
      hydratedItemResult.validatedUnits[0].criterionId ===
        unit0.criterionId &&
      hydratedItemResult.validatedUnits[0].instrumentType ===
        unit0.instrumentType &&
      hydratedItemResult.validatedUnits[0].allocationUnit ===
        unit0.allocationUnit,
    'B.1.1 Case 1: Missing canonical metadata echoes are hydrated from GenerationContract'
  );

  // Explicit conflicting allocationUnit must still fail.
  const conflictingAllocationJson = JSON.stringify([
    {
      coverageUnitId: unit0.coverageUnitId,
      allocationUnit: 'TASK',
      itemType: 'MULTIPLE_CHOICE',
      prompt: 'Kandidat dengan allocationUnit palsu',
      options: [
        { text: 'A' },
        { text: 'B' },
      ],
    },
  ]);

  const conflictingAllocationResult =
    parseAndValidateRawAIResponse(
      conflictingAllocationJson,
      contract
    );

  assert(
    conflictingAllocationResult.validatedUnits.length === 0 &&
      conflictingAllocationResult.issues.some(
        (issue) =>
          issue.code === 'ALLOCATION_UNIT_MISMATCH'
      ),
    'B.1.1 Case 2: Explicit conflicting allocationUnit remains rejected'
  );

  // coverageUnitId remains mandatory.
  const missingCoverageIdJson = JSON.stringify([
    {
      itemType: 'MULTIPLE_CHOICE',
      prompt: 'Kandidat tanpa coverageUnitId',
      options: [
        { text: 'A' },
        { text: 'B' },
      ],
    },
  ]);

  const missingCoverageIdResult =
    parseAndValidateRawAIResponse(
      missingCoverageIdJson,
      contract
    );

  assert(
    missingCoverageIdResult.validatedUnits.length === 0 &&
      missingCoverageIdResult.issues.some(
        (issue) =>
          issue.code === 'MISSING_COVERAGE_UNIT_ID'
      ),
    'B.1.1 Case 3: coverageUnitId remains mandatory'
  );

  // Case 29: Semantic validation: ITEM with empty prompt
  const emptyPromptJson = JSON.stringify([
    {
      coverageUnitId: unit0.coverageUnitId,
      objectiveRefId: unit0.objectiveRefId,
      criterionId: unit0.criterionId,
      instrumentType: unit0.instrumentType,
      allocationUnit: unit0.allocationUnit,
      itemType: 'MULTIPLE_CHOICE',
      prompt: '   ',
    },
  ]);
  const parseRes29 = parseAndValidateRawAIResponse(emptyPromptJson, contract);
  assert(parseRes29.validatedUnits.length === 0, 'Case 29: ITEM with empty prompt rejected');
  assert(parseRes29.issues.some((i) => i.code === 'EMPTY_ITEM_PROMPT'), 'Case 29: Returns EMPTY_ITEM_PROMPT');

  // ----------------------------------------------------
  // SECTION 4: AUTHORITATIVE COUNT & PARTIAL GENERATION
  // ----------------------------------------------------
  console.log('\n--- SECTION 4: AUTHORITATIVE COUNT & PARTIAL GENERATION ---');

  // Case 30: Multi-unit generation where 1 unit is valid and 1 unit is missing
  assert(contract.units.length >= 2, 'Contract has at least 2 units for partial testing');
  const unit1 = contract.units[1];
  const partialProvider = new MockAIProvider(() =>
    JSON.stringify([
      {
        coverageUnitId: unit0.coverageUnitId,
        objectiveRefId: unit0.objectiveRefId,
        criterionId: unit0.criterionId,
        instrumentType: unit0.instrumentType,
        allocationUnit: unit0.allocationUnit,
        itemType: 'MULTIPLE_CHOICE',
        prompt: 'Soal Unit 0 yang valid',
        options: [{ text: 'A' }, { text: 'B' }],
      },
      // Unit 1 is completely omitted by AI
    ])
  );

  const partialResult = await generateAssessmentPackageDraft({
    generationPlan: validPlan,
    provider: partialProvider,
  });

  assert(partialResult.status === 'PARTIAL', 'Case 30: Result status is PARTIAL when a coverage unit is missing');
  assert(partialResult.failedCoverageUnitIds.includes(unit1.coverageUnitId), 'Case 30: failedCoverageUnitIds records missing unit');
  assert(partialResult.generatedPackage !== undefined, 'Case 30: Generated package created for valid partial units');
  assert(partialResult.generatedPackage?.workflowStatus === 'DRAFT', 'Case 30: Package remains DRAFT');

  const partialPackage =
    partialResult.generatedPackage!;

  const partialGeneratedBlueprint =
    partialPackage.blueprintItems.find(
      (bp) =>
        bp.coverageUnitId ===
        unit0.coverageUnitId
    );

  const partialMissingBlueprint =
    partialPackage.blueprintItems.find(
      (bp) =>
        bp.coverageUnitId ===
        unit1.coverageUnitId
    );

  assert(
    partialGeneratedBlueprint !== undefined,
    'B.1.2c Case 1: Successfully generated coverage keeps its blueprint'
  );

  assert(
    partialMissingBlueprint === undefined,
    'B.1.2c Case 2: Failed coverage does NOT receive synthetic blueprint linkage'
  );

  const generatedCoverageIds =
    new Set(
      partialResult.generatedUnits.map(
        (u) => u.coverageUnitId
      )
    );

  assert(
    partialPackage.blueprintItems.every(
      (bp) =>
        !!bp.coverageUnitId &&
        generatedCoverageIds.has(
          bp.coverageUnitId
        )
    ),
    'B.1.2c Case 3: Every blueprint in PARTIAL package comes from an actually generated coverage unit'
  );

  // ----------------------------------------------------
  // SECTION 5: SUCCESSFUL FULL GENERATION & DETERMINISTIC MAPPING
  // ----------------------------------------------------
  console.log('\n--- SECTION 5: FULL GENERATION & DETERMINISTIC PACKAGE MAPPING ---');

  const fullProvider = new MockAIProvider(() =>
    JSON.stringify([
      {
        coverageUnitId: unit0.coverageUnitId,
        objectiveRefId: unit0.objectiveRefId,
        criterionId: unit0.criterionId,
        instrumentType: unit0.instrumentType,
        allocationUnit: unit0.allocationUnit,
        itemType: 'MULTIPLE_CHOICE',
        prompt: 'Pecahan berikut yang senilai dengan 2/3 adalah ...',
        stimulus: 'Ibu membagi semangka menjadi beberapa bagian.',
        options: [
          { text: '4/6', isCorrect: true },
          { text: '3/4', isCorrect: false },
          { text: '2/5', isCorrect: false },
          { text: '4/9', isCorrect: false },
        ],
        proposedAnswer: {
          answerType: 'OPTION',
          optionIndices: [0],
          value: '4/6',
          explanation: '2/3 x 2/2 = 4/6.',
        },
      },
      {
        coverageUnitId: unit1.coverageUnitId,
        objectiveRefId: unit1.objectiveRefId,
        criterionId: unit1.criterionId,
        instrumentType: unit1.instrumentType,
        allocationUnit: unit1.allocationUnit,
        itemType: 'ESSAY',
        prompt: 'Budi memiliki 1/2 meter pita dan Andi memiliki 2/4 meter pita. Jelaskan mengapa panjang pita mereka sama!',
        scoringGuideDraft: {
          instructions: 'Skor 10 jika mampu menjelaskan konsep pecahan senilai dengan tepat.',
          maxScore: 10,
        },
        proposedAnswer: {
          answerType: 'EXPECTED_RESPONSE',
          value: 'Karena 2/4 dapat disederhanakan menjadi 1/2.',
        },
      },
    ])
  );

  const fullResult = await generateAssessmentPackageDraft({
    generationPlan: validPlan,
    provider: fullProvider,
  });

  assert(fullResult.status === 'GENERATED', 'Case 31: Full successful generation status is GENERATED');
  assert(fullResult.failedCoverageUnitIds.length === 0, 'Case 32: 0 failed coverage units');
  assert(fullResult.generatedPackage !== undefined, 'Case 33: Generated package exists');

  const pkg = fullResult.generatedPackage!;
  assert(pkg.workflowStatus === 'DRAFT', 'Case 34: Package workflowStatus is strictly DRAFT (NEVER SIAP)');
  assert(pkg.needsReview === true, 'Case 35: Package needsReview is true');
  assert(pkg.provenance?.generatedBy === 'AI', 'Case 36: Package provenance generatedBy is AI');
  assert(pkg.blueprintItems.length === 2, 'Case 37: Exactly 2 blueprint items created');
  assert(pkg.blueprintItems[0].status === 'DRAFT', 'Case 38: Blueprint item status is DRAFT');

  const fullGeneratedCoverageIds =
    new Set(
      fullResult.generatedUnits.map(
        (u) => u.coverageUnitId
      )
    );

  const fullBlueprintCoverageIds =
    new Set(
      fullResult.generatedPackage!.blueprintItems
        .map((bp) => bp.coverageUnitId)
        .filter(Boolean)
    );

  assert(
    fullGeneratedCoverageIds.size ===
      fullBlueprintCoverageIds.size &&
      [...fullGeneratedCoverageIds].every(
        (id) =>
          fullBlueprintCoverageIds.has(id)
      ),
    'B.1.2c Case 10: Full generation retains one blueprint for every generated coverage'
  );

  assert(pkg.instruments.length === 1, 'Case 39: 1 Written Test instrument created');

  const writtenInst = pkg.instruments[0] as any;
  assert(writtenInst.type === 'WRITTEN_TEST', 'Case 40: Instrument type is WRITTEN_TEST');
  assert(writtenInst.items.length === 2, 'Case 41: Written instrument contains exactly 2 items');
  assert(writtenInst.items[0].options?.length === 4, 'Case 42: Multiple choice item has 4 options');
  assert(writtenInst.items[0].options[0].label === 'A', 'Case 43: Option 1 labeled A');
  assert(writtenInst.items[0].options[1].label === 'B', 'Case 44: Option 2 labeled B');
  assert(writtenInst.items[0].stimulusOrigin === 'AI_SYNTHETIC', 'Case 45: Synthetic stimulus labeled AI_SYNTHETIC');

  assert(pkg.answerKeys.length === 2, 'Case 46: 2 Answer keys generated');
  assert(pkg.scoringGuides.length === 1, 'Case 47: Scoring guide generated for Essay item');

  // ----------------------------------------------------
  // SECTION 6: NON-ITEM SEMANTIC INSTRUMENTS (TASK, EVIDENCE, OBSERVATION)
  // ----------------------------------------------------
  console.log('\n--- SECTION 6: NON-ITEM INSTRUMENTS (TASK, EVIDENCE, OBSERVATION) ---');

  // Plan with Performance Instrument
  const mockPlanPerformance: AssessmentPlan = {
    ...mockPlanMatSiap,
    id: 'plan-perf-1',
    instruments: [{ id: 'inst-perf-ref', type: 'PERFORMANCE', label: 'Unjuk Kerja Praktik' }],
  };
  const specPerf = resolveAssessmentGenerationSpec({
    academicSetting: mockAcademicSettingSD4,
    assessmentPlan: mockPlanPerformance,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  const planPerf = resolveAssessmentGenerationPlan({ generationSpec: specPerf });

  const perfContract = buildGenerationContract(planPerf);
  assert(perfContract.units[0].allocationUnit === 'TASK', 'Case 48: Performance instrument maps to TASK allocation unit');

  const hydratedPerformanceJson = JSON.stringify([
    {
      coverageUnitId:
        perfContract.units[0].coverageUnitId,
      taskTitle: 'Praktik Gerak Dasar',
      taskPrompt:
        'Lakukan rangkaian gerak lokomotor sesuai instruksi guru.',
      instructions:
        'Lakukan gerakan secara tertib dan aman.',
      aspects: [
        {
          label: 'Ketepatan gerakan',
          description:
            'Gerakan dilakukan sesuai contoh.',
        },
      ],
    },
  ]);

  const hydratedPerformanceResult =
    parseAndValidateRawAIResponse(
      hydratedPerformanceJson,
      perfContract
    );

  assert(
    hydratedPerformanceResult.validatedUnits.length === 1 &&
      hydratedPerformanceResult.validatedUnits[0]
        .instrumentType === 'PERFORMANCE' &&
      hydratedPerformanceResult.validatedUnits[0]
        .allocationUnit === 'TASK',
    'B.1.1 Case 4: PERFORMANCE candidate without canonical metadata echo hydrates to TASK'
  );

  const b12MinimalPerformance = parseAndValidateRawAIResponse(
    JSON.stringify([
      {
        coverageUnitId:
          perfContract.units[0].coverageUnitId,
        taskPrompt:
          'Lakukan rangkaian gerak lokomotor secara tertib dan aman.',
      },
    ]),
    perfContract
  );

  assert(
    b12MinimalPerformance.validatedUnits.length === 1 &&
      b12MinimalPerformance.validatedUnits[0]
        .allocationUnit === 'TASK' &&
      b12MinimalPerformance.validatedUnits[0]
        .instrumentType === 'PERFORMANCE',
    'B.1.2 Case 3: Minimal structured PERFORMANCE TASK is accepted'
  );

  const perfProvider = new MockAIProvider(() =>
    JSON.stringify([
      {
        coverageUnitId: perfContract.units[0].coverageUnitId,
        objectiveRefId: perfContract.units[0].objectiveRefId,
        criterionId: perfContract.units[0].criterionId,
        instrumentType: 'PERFORMANCE',
        allocationUnit: 'TASK',
        taskTitle: 'Praktik Memotong Kertas Pecahan',
        taskPrompt: 'Lipat dan potong kertas origami untuk membuktikan 1/2 senilai dengan 2/4!',
        aspects: [
          { label: 'Kerapian lipatan', weight: 50 },
          { label: 'Ketepatan penjelasan kesetaraan pecahan', weight: 50 },
        ],
        rubricDraft: {
          title: 'Rubrik Unjuk Kerja Pecahan',
          criteria: [
            { label: 'Kerapian lipatan', indicator: 'Lipatan simetris dan rapi' },
            { label: 'Ketepatan konsep', indicator: 'Mampu menunjukkan area pecahan sama besar' },
          ],
          scale: [
            { label: 'Mahir', score: 4, descriptor: 'Sangat rapi dan akurat' },
            { label: 'Layak', score: 3, descriptor: 'Rapi dengan konsep benar' },
            { label: 'Berkembang', score: 2, descriptor: 'Cukup rapi' },
            { label: 'Awal', score: 1, descriptor: 'Perlu bimbingan' },
          ],
        },
      },
    ])
  );

  const perfResult = await generateAssessmentPackageDraft({
    generationPlan: planPerf,
    provider: perfProvider,
  });

  assert(perfResult.status === 'PARTIAL' || perfResult.status === 'GENERATED', 'Case 49: Performance generation succeeds');
  const perfPkg = perfResult.generatedPackage!;
  const perfInst = perfPkg.instruments[0] as any;
  assert(perfInst.type === 'PERFORMANCE', 'Case 50: Generated instrument is PERFORMANCE (NOT WRITTEN_TEST)');
  assert(perfPkg.rubrics.length === 1, 'Case 51: Rubric draft created and linked');
  assert(perfPkg.rubrics[0].criteria.length === 2, 'Case 52: Rubric has 2 criteria');
  assert(perfPkg.rubrics[0].scale.length === 4, 'Case 53: Rubric has 4 scale levels');

  const perfBlueprint =
    perfPkg.blueprintItems.find(
      (bp) =>
        bp.instrumentType === 'PERFORMANCE'
    )!;

  assert(
    perfBlueprint.coverageUnitId ===
      perfContract.units[0].coverageUnitId,
    'B.1.2b Case 1: PERFORMANCE blueprint preserves exact coverageUnitId'
  );

  assert(
    perfBlueprint.instrumentId === perfInst.id,
    'B.1.2b Case 2: PERFORMANCE blueprint links exact instrumentId'
  );

  const performanceAspectIds = new Set(
    (perfInst.aspects || []).map(
      (asp: any) => asp.id
    )
  );

  assert(
    perfBlueprint.instrumentItemIds.every(
      (id) => performanceAspectIds.has(id)
    ),
    'B.1.2b Case 3: PERFORMANCE blueprint references only actual aspect IDs'
  );

  // Shared PERFORMANCE Instrument partial generation test (B.1.2c)
  const sharedPerfUnits =
    perfContract.units.filter(
      (u) =>
        u.instrumentType === 'PERFORMANCE'
    );

  assert(
    sharedPerfUnits.length >= 2,
    'B.1.2c setup: shared PERFORMANCE contract has at least two coverage units'
  );

  const sharedPartialProvider =
    new MockAIProvider(() =>
      JSON.stringify([
        {
          coverageUnitId:
            sharedPerfUnits[0].coverageUnitId,
          taskPrompt:
            'Lakukan aktivitas praktik pertama.',
        },
      ])
    );

  const sharedPartialResult =
    await generateAssessmentPackageDraft({
      generationPlan: planPerf,
      provider: sharedPartialProvider,
    });

  assert(
    sharedPartialResult.status === 'PARTIAL',
    'B.1.2c Case 4: Shared-instrument missing coverage remains PARTIAL'
  );

  const sharedPartialPackage =
    sharedPartialResult.generatedPackage!;

  assert(
    sharedPartialPackage.instruments.some(
      (inst) =>
        inst.type === 'PERFORMANCE'
    ),
    'B.1.2c Case 5: Successful PERFORMANCE coverage still creates its instrument'
  );

  assert(
    sharedPartialPackage.blueprintItems.some(
      (bp) =>
        bp.coverageUnitId ===
        sharedPerfUnits[0].coverageUnitId
    ),
    'B.1.2c Case 6: Successful shared-instrument coverage has blueprint'
  );

  assert(
    !sharedPartialPackage.blueprintItems.some(
      (bp) =>
        bp.coverageUnitId ===
        sharedPerfUnits[1].coverageUnitId
    ),
    'B.1.2c Case 7: Missing shared-instrument coverage does not borrow instrument linkage'
  );

  // Plan with Observation Instrument
  const mockPlanObs: AssessmentPlan = {
    ...mockPlanMatSiap,
    id: 'plan-obs-1',
    instruments: [{ id: 'inst-obs-ref', type: 'OBSERVATION', label: 'Lembar Observasi' }],
  };
  const specObs = resolveAssessmentGenerationSpec({
    academicSetting: mockAcademicSettingSD4,
    assessmentPlan: mockPlanObs,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  const planObs = resolveAssessmentGenerationPlan({ generationSpec: specObs });
  const obsContract = buildGenerationContract(planObs);

  const hydratedObservationJson = JSON.stringify([
    {
      coverageUnitId:
        obsContract.units[0].coverageUnitId,
      instructions:
        'Amati pelaksanaan aktivitas murid.',
      aspects: [
        {
          label: 'Partisipasi aktif',
          indicator:
            'Murid mengikuti aktivitas sesuai instruksi.',
        },
      ],
    },
  ]);

  const hydratedObservationResult =
    parseAndValidateRawAIResponse(
      hydratedObservationJson,
      obsContract
    );

  assert(
    hydratedObservationResult.validatedUnits.length === 1 &&
      hydratedObservationResult.validatedUnits[0]
        .instrumentType === 'OBSERVATION' &&
      hydratedObservationResult.validatedUnits[0]
        .allocationUnit === 'OBSERVATION',
    'B.1.1 Case 5: OBSERVATION candidate without canonical metadata echo hydrates correctly'
  );

  const b12MinimalObservation = parseAndValidateRawAIResponse(
    JSON.stringify([
      {
        coverageUnitId:
          obsContract.units[0].coverageUnitId,
        aspects: [
          {
            label: 'Partisipasi aktif',
            indicator:
              'Murid mengikuti aktivitas sesuai instruksi.',
          },
        ],
      },
    ]),
    obsContract
  );

  assert(
    b12MinimalObservation.validatedUnits.length === 1 &&
      b12MinimalObservation.validatedUnits[0]
        .allocationUnit === 'OBSERVATION',
    'B.1.2 Case 4: Minimal structured OBSERVATION is accepted'
  );

  // Oral Test default itemType
  const mockPlanOral: AssessmentPlan = {
    ...mockPlanMatSiap,
    id: 'plan-oral-1',
    instruments: [{ id: 'inst-oral-ref', type: 'ORAL_TEST', label: 'Tes Lisan' }],
  };
  const specOral = resolveAssessmentGenerationSpec({
    academicSetting: mockAcademicSettingSD4,
    assessmentPlan: mockPlanOral,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  const planOral = resolveAssessmentGenerationPlan({ generationSpec: specOral });
  const oralContract = buildGenerationContract(planOral);

  const oralResult = parseAndValidateRawAIResponse(
    JSON.stringify([
      {
        coverageUnitId: oralContract.units[0].coverageUnitId,
        prompt: 'Jelaskan dua contoh gerak lokomotor yang kamu ketahui.',
      },
    ]),
    oralContract
  );

  assert(
    oralResult.validatedUnits.length === 1 &&
      oralResult.validatedUnits[0]
        .instrumentType === 'ORAL_TEST' &&
      oralResult.validatedUnits[0]
        .allocationUnit === 'ITEM' &&
      (oralResult.validatedUnits[0] as any)
        .itemType === 'SHORT_ANSWER',
    'B.1.2 Case 6: ORAL_TEST without itemType defaults to SHORT_ANSWER, not MULTIPLE_CHOICE'
  );

  // Multi-instrument real runtime shape: PERFORMANCE + OBSERVATION
  const mockMultiPerfObsPlan: AssessmentPlan = {
    ...mockPlanMatSiap,
    id: 'plan-perf-obs-multi',
    instruments: [
      { id: 'inst-perf-multi', type: 'PERFORMANCE', label: 'Praktik' },
      { id: 'inst-obs-multi', type: 'OBSERVATION', label: 'Observasi' },
    ],
  };
  const specMultiPerfObs = resolveAssessmentGenerationSpec({
    academicSetting: mockAcademicSettingSD4,
    assessmentPlan: mockMultiPerfObsPlan,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  const planMultiPerfObs = resolveAssessmentGenerationPlan({ generationSpec: specMultiPerfObs });
  const contractMultiPerfObs = buildGenerationContract(planMultiPerfObs);

  const performanceCoverage = contractMultiPerfObs.units.find(
    (u) => u.instrumentType === 'PERFORMANCE'
  )!;
  const observationCoverage = contractMultiPerfObs.units.find(
    (u) => u.instrumentType === 'OBSERVATION'
  )!;

  const multiPerfObsResult = parseAndValidateRawAIResponse(
    JSON.stringify([
      {
        coverageUnitId:
          performanceCoverage.coverageUnitId,
        taskPrompt:
          'Lakukan rangkaian gerak dasar sesuai instruksi.',
      },
      {
        coverageUnitId:
          observationCoverage.coverageUnitId,
        aspects: [
          {
            label: 'Keterlibatan',
            indicator:
              'Murid mengikuti aktivitas secara aktif.',
          },
        ],
      },
    ]),
    contractMultiPerfObs
  );

  assert(
    multiPerfObsResult.validatedUnits.length === 2 &&
      multiPerfObsResult.validatedUnits.some(
        (u) => u.instrumentType === 'PERFORMANCE' && u.allocationUnit === 'TASK'
      ) &&
      multiPerfObsResult.validatedUnits.some(
        (u) => u.instrumentType === 'OBSERVATION' && u.allocationUnit === 'OBSERVATION'
      ),
    'B.1.2 Case 7: Multi-instrument PERFORMANCE + OBSERVATION single response parses cleanly'
  );

  const obsProvider = new MockAIProvider(() =>
    JSON.stringify([
      {
        coverageUnitId: obsContract.units[0].coverageUnitId,
        objectiveRefId: obsContract.units[0].objectiveRefId,
        criterionId: obsContract.units[0].criterionId,
        instrumentType: 'OBSERVATION',
        allocationUnit: 'OBSERVATION',
        instructions: 'Amati keaktifan murid saat diskusi kelompok.',
        aspects: [
          { label: 'Keaktifan bertanya', indicator: 'Mengajukan pertanyaan terkait materi pecahan' },
          { label: 'Kerja sama tim', indicator: 'Membantu teman satu kelompok' },
        ],
      },
    ])
  );

  const obsResult = await generateAssessmentPackageDraft({
    generationPlan: planObs,
    provider: obsProvider,
  });

  assert(obsResult.generatedPackage !== undefined, 'Case 54: Observation package generated');
  const obsInst = obsResult.generatedPackage!.instruments[0] as any;
  assert(obsInst.type === 'OBSERVATION', 'Case 55: Instrument type is OBSERVATION');
  assert(obsInst.aspects.length === 2, 'Case 56: Observation instrument has 2 aspects');

  const obsBlueprint =
    obsResult.generatedPackage!.blueprintItems.find(
      (bp) =>
        bp.instrumentType === 'OBSERVATION'
    )!;

  assert(
    obsBlueprint.coverageUnitId ===
      obsContract.units[0].coverageUnitId,
    'B.1.2b Case 4: OBSERVATION blueprint preserves exact coverageUnitId'
  );

  assert(
    obsBlueprint.instrumentId === obsInst.id,
    'B.1.2b Case 5: OBSERVATION blueprint links exact instrumentId'
  );

  const observationAspectIds = new Set(
    (obsInst.aspects || []).map(
      (asp: any) => asp.id
    )
  );

  assert(
    obsBlueprint.instrumentItemIds.length ===
      obsInst.aspects.length &&
      obsBlueprint.instrumentItemIds.every(
        (id) => observationAspectIds.has(id)
      ),
    'B.1.2b Case 6: OBSERVATION blueprint references exact existing aspect IDs without dangling parent ID'
  );

  // ----------------------------------------------------
  // SECTION 7: IMMUTABILITY OF INPUT OBJECTS
  // ----------------------------------------------------
  console.log('\n--- SECTION 7: IMMUTABILITY OF INPUT OBJECTS ---');

  const beforePlanJson = JSON.stringify(validPlan);
  const beforeSpecJson = JSON.stringify(spec);

  await generateAssessmentPackageDraft({
    generationPlan: validPlan,
    provider: fullProvider,
  });

  const afterPlanJson = JSON.stringify(validPlan);
  const afterSpecJson = JSON.stringify(spec);

  assert(beforePlanJson === afterPlanJson, 'Case 57: GenerationPlan remains completely unmutated');
  assert(beforeSpecJson === afterSpecJson, 'Case 58: GenerationSpec remains completely unmutated');

  // ----------------------------------------------------
  // SECTION 8: HARDENING (FAIL-CLOSED & NO FABRICATED DATA)
  // ----------------------------------------------------
  console.log('\n--- SECTION 8: HARDENING & FAIL-CLOSED NO FABRICATED DATA ---');

  // Case BB: Indicator precedence - Teacher indicator preserved
  const planWithTeacherInd: AssessmentGenerationPlan = {
    ...validPlan,
    coverageUnits: [
      {
        ...validPlan.coverageUnits[0],
        assessmentIndicator: 'Indikator Otentik Buatan Guru',
      },
    ],
  };
  const contractBB = buildGenerationContract(planWithTeacherInd);
  assert(contractBB.units[0].assessmentIndicator === 'Indikator Otentik Buatan Guru', 'Case BB: Teacher indicator preserved in contract');
  assert(contractBB.units[0].indicatorSource === 'TEACHER', 'Case BB: Indicator source marked TEACHER');

  // Case BC: Indicator precedence - AI generated indicator preserved when teacher indicator missing
  const unitBC = contract.units[0];
  const aiIndJson = JSON.stringify([
    {
      coverageUnitId: unitBC.coverageUnitId,
      objectiveRefId: unitBC.objectiveRefId,
      criterionId: unitBC.criterionId,
      instrumentType: unitBC.instrumentType,
      allocationUnit: unitBC.allocationUnit,
      assessmentIndicator: 'Indikator Hasil AI',
      itemType: 'MULTIPLE_CHOICE',
      prompt: 'Soal dengan indikator AI',
      options: [{ text: 'A' }, { text: 'B' }],
    },
  ]);
  const parseResBC = parseAndValidateRawAIResponse(aiIndJson, contract);
  assert(parseResBC.validatedUnits[0].assessmentIndicator === 'Indikator Hasil AI', 'Case BC: AI indicator preserved when teacher indicator absent');

  // Case BD: Indicator fail-closed - Blueprint item indicator is undefined when neither provided
  const providerBD = new MockAIProvider(() =>
    JSON.stringify([
      {
        coverageUnitId: unitBC.coverageUnitId,
        objectiveRefId: unitBC.objectiveRefId,
        criterionId: unitBC.criterionId,
        instrumentType: unitBC.instrumentType,
        allocationUnit: unitBC.allocationUnit,
        itemType: 'MULTIPLE_CHOICE',
        prompt: 'Soal tanpa indikator sama sekali',
        options: [{ text: 'A' }, { text: 'B' }],
      },
    ])
  );
  const resultBD = await generateAssessmentPackageDraft({
    generationPlan: validPlan,
    provider: providerBD,
  });
  const pkgBD = resultBD.generatedPackage!;
  assert(pkgBD.blueprintItems[0].assessmentIndicator === undefined, 'Case BD: Blueprint indicator is undefined (NO FABRICATED STRING)');

  // Case BE: AcademicSettingId resolution propagates canonical ID
  const resolvedSettingId = resolveAuthoritativeAcademicSettingId({ academicSettingId: 'setting-sd-4' });
  assert(resolvedSettingId === 'setting-sd-4', 'Case BE: Canonical academicSettingId resolved accurately');

  // Case BF: Unresolved academicSettingId fails pre-generation guard
  const planNoSetting: AssessmentGenerationPlan = {
    ...validPlan,
    academicSettingId: undefined,
    generationSpec: {
      ...spec,
      academicSettingId: undefined,
      curriculumContext: { ...spec.curriculumContext, academicSettingId: '' },
    },
  };
  const guardResBF = validatePreGenerationGuards({ generationPlan: planNoSetting });
  assert(guardResBF.valid === false, 'Case BF: Unresolved academicSettingId fails pre-generation guard');
  assert(guardResBF.issues.some((i) => i.code === 'ACADEMIC_SETTING_ID_UNRESOLVED'), 'Case BF: Returns ACADEMIC_SETTING_ID_UNRESOLVED');

  // Case BG: No synthetic setting fallback in generated package
  assert(pkg.academicSettingId === 'setting-sd-4', 'Case BG: Package uses exact canonical academicSettingId without setting-default fallback');

  // Case BH: Option text validation - Empty/whitespace option text rejected
  const emptyOptJson = JSON.stringify([
    {
      coverageUnitId: unitBC.coverageUnitId,
      objectiveRefId: unitBC.objectiveRefId,
      criterionId: unitBC.criterionId,
      instrumentType: unitBC.instrumentType,
      allocationUnit: unitBC.allocationUnit,
      itemType: 'MULTIPLE_CHOICE',
      prompt: 'Soal opsi kosong',
      options: [{ text: 'Opsi Valid' }, { text: '   ' }],
    },
  ]);
  const parseResBH = parseAndValidateRawAIResponse(emptyOptJson, contract);
  assert(parseResBH.validatedUnits.length === 0, 'Case BH: Candidate with empty option text rejected');
  assert(parseResBH.issues.some((i) => i.code === 'INVALID_OPTION_TEXT'), 'Case BH: Issues contain INVALID_OPTION_TEXT');

  // Case BI: Option structure validation - Non-string / non-object option entries rejected
  const nonObjOptJson = JSON.stringify([
    {
      coverageUnitId: unitBC.coverageUnitId,
      objectiveRefId: unitBC.objectiveRefId,
      criterionId: unitBC.criterionId,
      instrumentType: unitBC.instrumentType,
      allocationUnit: unitBC.allocationUnit,
      itemType: 'MULTIPLE_CHOICE',
      prompt: 'Soal opsi number',
      options: [123, 456],
    },
  ]);
  const parseResBI = parseAndValidateRawAIResponse(nonObjOptJson, contract);
  assert(parseResBI.validatedUnits.length === 0, 'Case BI: Candidate with numeric options rejected');
  assert(parseResBI.issues.some((i) => i.code === 'INVALID_OPTION_TEXT'), 'Case BI: Issues contain INVALID_OPTION_TEXT');

  // Setup Plan for PROJECT
  const mockPlanProj: AssessmentPlan = {
    ...mockPlanMatSiap,
    id: 'plan-proj-1',
    instruments: [{ id: 'inst-proj-ref', type: 'PROJECT', label: 'Penilaian Proyek' }],
  };
  const specProj = resolveAssessmentGenerationSpec({
    academicSetting: mockAcademicSettingSD4,
    assessmentPlan: mockPlanProj,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  const planProj = resolveAssessmentGenerationPlan({ generationSpec: specProj });
  const projContract = buildGenerationContract(planProj);

  // Case BJ: Project brief uses task content directly without fallback string
  const projProvider = new MockAIProvider(() =>
    JSON.stringify([
      {
        coverageUnitId: projContract.units[0].coverageUnitId,
        objectiveRefId: projContract.units[0].objectiveRefId,
        criterionId: projContract.units[0].criterionId,
        instrumentType: 'PROJECT',
        allocationUnit: 'TASK',
        taskTitle: 'Proyek Daur Ulang',
        taskPrompt: 'Buatlah kerajinan dari bahan daur ulang.',
      },
    ])
  );
  const projResult = await generateAssessmentPackageDraft({
    generationPlan: planProj,
    provider: projProvider,
  });
  const projInst = projResult.generatedPackage?.instruments[0] as any;
  assert(projInst?.projectBrief === 'Buatlah kerajinan dari bahan daur ulang.', 'Case BJ: Project brief derived directly from taskPrompt without fallback string');

  // Setup Plan for PRODUCT
  const mockPlanProd: AssessmentPlan = {
    ...mockPlanMatSiap,
    id: 'plan-prod-1',
    instruments: [{ id: 'inst-prod-ref', type: 'PRODUCT', label: 'Penilaian Produk' }],
  };
  const specProd = resolveAssessmentGenerationSpec({
    academicSetting: mockAcademicSettingSD4,
    assessmentPlan: mockPlanProd,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  const planProd = resolveAssessmentGenerationPlan({ generationSpec: specProd });
  const prodContract = buildGenerationContract(planProd);

  // Case BK: Product brief uses task content directly without fallback string
  const prodProvider = new MockAIProvider(() =>
    JSON.stringify([
      {
        coverageUnitId: prodContract.units[0].coverageUnitId,
        objectiveRefId: prodContract.units[0].objectiveRefId,
        criterionId: prodContract.units[0].criterionId,
        instrumentType: 'PRODUCT',
        allocationUnit: 'TASK',
        taskTitle: 'Produk Poster',
        instructions: 'Buatlah poster infografis pecahan.',
      },
    ])
  );
  const prodResult = await generateAssessmentPackageDraft({
    generationPlan: planProd,
    provider: prodProvider,
  });
  const prodInst = prodResult.generatedPackage?.instruments[0] as any;
  assert(prodInst?.productBrief === 'Buatlah poster infografis pecahan.', 'Case BK: Product brief derived directly from instructions without fallback string');

  // Setup Plan for ASSIGNMENT
  const mockPlanAssign: AssessmentPlan = {
    ...mockPlanMatSiap,
    id: 'plan-assign-1',
    instruments: [{ id: 'inst-assign-ref', type: 'ASSIGNMENT', label: 'Penugasan Terstruktur' }],
  };
  const specAssign = resolveAssessmentGenerationSpec({
    academicSetting: mockAcademicSettingSD4,
    assessmentPlan: mockPlanAssign,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  const planAssign = resolveAssessmentGenerationPlan({ generationSpec: specAssign });
  const assignContract = buildGenerationContract(planAssign);

  // Case BL & BM: Scoring guide maxScore and instructions preserved without fallbacks
  const taskNoScoringFallbackProvider = new MockAIProvider(() =>
    JSON.stringify([
      {
        coverageUnitId: assignContract.units[0].coverageUnitId,
        objectiveRefId: assignContract.units[0].objectiveRefId,
        criterionId: assignContract.units[0].criterionId,
        instrumentType: 'ASSIGNMENT',
        allocationUnit: 'TASK',
        taskTitle: 'Penugasan Mandiri',
        scoringGuideDraft: {
          instructions: undefined,
          maxScore: undefined,
        },
      },
    ])
  );
  const taskNoScoringResult = await generateAssessmentPackageDraft({
    generationPlan: planAssign,
    provider: taskNoScoringFallbackProvider,
  });
  const scoringGuideBL = taskNoScoringResult.generatedPackage?.scoringGuides[0];
  assert(scoringGuideBL?.maxScore === undefined, 'Case BL: Scoring guide maxScore is undefined when not generated (NO FALLBACK 100)');
  assert(scoringGuideBL?.instructions === undefined, 'Case BM: Scoring guide instructions are undefined when not generated (NO FALLBACK TEXT)');

  // Case BN-BQ: Instrument instructions undefined when not explicitly provided
  assert(writtenInst.instructions === undefined, 'Case BN: Written test instructions undefined');
  assert(perfInst.instructions === undefined, 'Case BP: Performance instructions undefined');
  assert(obsInst.instructions === 'Amati keaktifan murid saat diskusi kelompok.', 'Case BQ: Observation instructions preserved when provided by AI');

  // Case BR: Assignment instructions derived directly from task
  const assignInst = taskNoScoringResult.generatedPackage?.instruments[0] as any;
  assert(assignInst.instructions === 'Penugasan Mandiri', 'Case BR: Assignment instructions derived directly from taskTitle when prompt/instructions absent');

  // Case BS & BT: Provenance tracking for indicators and materials
  assert(contractBB.units[0].indicatorSource === 'TEACHER', 'Case BS: Teacher indicator source tracked');
  assert(contract.units[0].indicatorSource === undefined, 'Case BS: Indicator source is undefined when indicator absent before AI generation');
  assert(contract.units[0].materialSource === undefined, 'Case BT: Material source is undefined when material absent before AI generation');

  // Case BU: Package metadata provenance
  assert(pkg.provenance?.generatedBy === 'AI', 'Case BU: Package generatedBy provenance is strictly AI');
  assert(pkg.provenance?.generatedAt !== undefined, 'Case BU: Package generatedAt timestamp exists');

  // ----------------------------------------------------
  // SECTION 5: FINAL HARDENING PATCH CASES (BV - CN)
  // ----------------------------------------------------
  console.log('\n--- SECTION 5: FINAL HARDENING PATCH CASES (BV - CN) ---');

  // Case BV: Missing indicator has no provenance before AI generation
  assert(contract.units[0].assessmentIndicator === undefined, 'Case BV: Missing indicator is undefined');
  assert(contract.units[0].indicatorSource === undefined, 'Case BV: Missing indicator source is undefined');

  // Case BW: Missing material has no provenance before AI generation
  assert(contract.units[0].materialOrContext === undefined, 'Case BW: Missing material is undefined');
  assert(contract.units[0].materialSource === undefined, 'Case BW: Missing material source is undefined');

  const teacherContext = { instructions: 'Sertakan contoh benda konkret' };

  // Case BX: AI indicator gets provenance only after generation
  const mockAIProviderWithIndicator: AssessmentAIGenerationProvider = {
    generate: async () => ({
      rawText: JSON.stringify([
        {
          coverageUnitId: unit0.coverageUnitId,
          objectiveRefId: unit0.objectiveRefId,
          criterionId: unit0.criterionId,
          allocationUnit: unit0.allocationUnit,
          instrumentType: unit0.instrumentType,
          itemType: 'MULTIPLE_CHOICE',
          prompt: 'Berapakah 1/2 + 1/4?',
          options: [
            { id: 'opt-1', text: '3/4', isCorrect: true },
            { id: 'opt-2', text: '1/4', isCorrect: false },
          ],
          assessmentIndicator: 'Indikator Draf AI Hasil Generasi',
        },
      ]),
    }),
  };

  const genWithIndicatorResult = await generateAssessmentPackageDraft({
    generationPlan: validPlan,
    provider: mockAIProviderWithIndicator,
  });

  const generatedUnitWithIndicator = genWithIndicatorResult.generatedUnits[0];
  assert(generatedUnitWithIndicator?.assessmentIndicator === 'Indikator Draf AI Hasil Generasi', 'Case BX: AI indicator populated');
  assert(generatedUnitWithIndicator?.indicatorSource === 'AI_DRAFT', 'Case BX: AI indicator source set to AI_DRAFT after generation');

  // Case BY: AI material gets provenance only after generation
  const mockAIProviderWithMaterial: AssessmentAIGenerationProvider = {
    generate: async () => ({
      rawText: JSON.stringify([
        {
          coverageUnitId: unit0.coverageUnitId,
          objectiveRefId: unit0.objectiveRefId,
          criterionId: unit0.criterionId,
          allocationUnit: unit0.allocationUnit,
          instrumentType: unit0.instrumentType,
          itemType: 'MULTIPLE_CHOICE',
          prompt: 'Berapakah 1/2 + 1/4?',
          options: [
            { id: 'opt-1', text: '3/4', isCorrect: true },
            { id: 'opt-2', text: '1/4', isCorrect: false },
          ],
          materialOrContext: 'Materi Sintesis AI Tentang Pecahan',
        },
      ]),
    }),
  };

  const genWithMaterialResult = await generateAssessmentPackageDraft({
    generationPlan: validPlan,
    provider: mockAIProviderWithMaterial,
  });

  const generatedUnitWithMaterial = genWithMaterialResult.generatedUnits[0];
  assert(generatedUnitWithMaterial?.materialOrContext === 'Materi Sintesis AI Tentang Pecahan', 'Case BY: AI material populated');
  assert(generatedUnitWithMaterial?.materialSource === 'AI_SYNTHETIC', 'Case BY: AI material source set to AI_SYNTHETIC after generation');

  // Case BZ: Upstream indicator cannot be overwritten by AI
  const contractWithTeacherIndicator = buildGenerationContract(
    {
      ...validPlan,
      coverageUnits: [
        {
          ...validPlan.coverageUnits[0],
          assessmentIndicator: 'Indikator Upstream Guru',
        },
      ],
    },
    teacherContext
  );

  const parsedOverwriteIndicatorResult = parseAndValidateRawAIResponse(
    JSON.stringify([
      {
        coverageUnitId: unit0.coverageUnitId,
        objectiveRefId: unit0.objectiveRefId,
        criterionId: unit0.criterionId,
        allocationUnit: unit0.allocationUnit,
        instrumentType: unit0.instrumentType,
        itemType: 'MULTIPLE_CHOICE',
        prompt: 'Soal?',
        options: [
          { id: 'o1', text: 'A', isCorrect: true },
          { id: 'o2', text: 'B', isCorrect: false },
        ],
        assessmentIndicator: 'Indikator AI Mencoba Mengubah',
      },
    ]),
    contractWithTeacherIndicator
  );

  assert(
    parsedOverwriteIndicatorResult.validatedUnits[0]?.assessmentIndicator === 'Indikator Upstream Guru',
    'Case BZ: Upstream indicator preserved and NOT overwritten by AI'
  );
  assert(
    parsedOverwriteIndicatorResult.validatedUnits[0]?.indicatorSource === 'TEACHER',
    'Case BZ: Upstream indicator source TEACHER preserved'
  );

  // Case CA: Upstream material cannot be overwritten by AI
  const contractWithTeacherMaterial = buildGenerationContract(
    {
      ...validPlan,
      coverageUnits: [
        {
          ...validPlan.coverageUnits[0],
          materialOrContext: 'Materi Upstream Guru',
        },
      ],
    },
    teacherContext
  );

  const parsedOverwriteMaterialResult = parseAndValidateRawAIResponse(
    JSON.stringify([
      {
        coverageUnitId: unit0.coverageUnitId,
        objectiveRefId: unit0.objectiveRefId,
        criterionId: unit0.criterionId,
        allocationUnit: unit0.allocationUnit,
        instrumentType: unit0.instrumentType,
        itemType: 'MULTIPLE_CHOICE',
        prompt: 'Soal?',
        options: [
          { id: 'o1', text: 'A', isCorrect: true },
          { id: 'o2', text: 'B', isCorrect: false },
        ],
        materialOrContext: 'Materi AI Mencoba Mengubah',
      },
    ]),
    contractWithTeacherMaterial
  );

  assert(
    parsedOverwriteMaterialResult.validatedUnits[0]?.materialOrContext === 'Materi Upstream Guru',
    'Case CA: Upstream material preserved and NOT overwritten by AI'
  );
  assert(
    parsedOverwriteMaterialResult.validatedUnits[0]?.materialSource === 'TEACHER',
    'Case CA: Upstream material source TEACHER preserved'
  );

  // Case CB: Empty TASK rejected with EMPTY_TASK_CONTENT
  const perfUnit0 = perfContract.units[0];
  const parsedEmptyTaskResult = parseAndValidateRawAIResponse(
    JSON.stringify([
      {
        coverageUnitId: perfUnit0.coverageUnitId,
        objectiveRefId: perfUnit0.objectiveRefId,
        criterionId: perfUnit0.criterionId,
        allocationUnit: 'TASK',
        instrumentType: 'PERFORMANCE',
        taskTitle: '',
        taskPrompt: '',
        instructions: '',
        expectedDeliverable: '',
      },
    ]),
    perfContract
  );

  assert(parsedEmptyTaskResult.validatedUnits.length === 0, 'Case CB: Empty task unit rejected');
  assert(
    parsedEmptyTaskResult.issues.some((i) => i.code === 'EMPTY_TASK_PROMPT'),
    'Case CB: Issue code EMPTY_TASK_PROMPT recorded'
  );

  // Case CC: Whitespace-only TASK rejected with EMPTY_TASK_CONTENT
  const parsedWhitespaceTaskResult = parseAndValidateRawAIResponse(
    JSON.stringify([
      {
        coverageUnitId: perfUnit0.coverageUnitId,
        objectiveRefId: perfUnit0.objectiveRefId,
        criterionId: perfUnit0.criterionId,
        allocationUnit: 'TASK',
        instrumentType: 'PERFORMANCE',
        taskTitle: '   ',
        taskPrompt: '  \n\t ',
        instructions: '   ',
      },
    ]),
    perfContract
  );

  assert(parsedWhitespaceTaskResult.validatedUnits.length === 0, 'Case CC: Whitespace task unit rejected');
  assert(
    parsedWhitespaceTaskResult.issues.some((i) => i.code === 'EMPTY_TASK_PROMPT'),
    'Case CC: Issue code EMPTY_TASK_PROMPT recorded'
  );

  // Case CD: PROJECT never maps empty projectBrief
  const mockPlanProjSec5: AssessmentPlan = {
    ...mockPlanMatSiap,
    id: 'plan-proj-sec5',
    instruments: [{ id: 'inst-proj-sec5', type: 'PROJECT', label: 'Penilaian Proyek' }],
  };
  const specProjSec5 = resolveAssessmentGenerationSpec({
    academicSetting: mockAcademicSettingSD4,
    assessmentPlan: mockPlanProjSec5,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  const planProject = resolveAssessmentGenerationPlan({ generationSpec: specProjSec5 });
  const projContractSec5 = buildGenerationContract(planProject, teacherContext);

  const projectProvider: AssessmentAIGenerationProvider = {
    generate: async () => ({
      rawText: JSON.stringify([
        {
          coverageUnitId: projContractSec5.units[0].coverageUnitId,
          objectiveRefId: projContractSec5.units[0].objectiveRefId,
          criterionId: projContractSec5.units[0].criterionId,
          allocationUnit: 'TASK',
          instrumentType: 'PROJECT',
          taskPrompt: 'Rancanglah mini proyek pengolahan sampah organik.',
        },
      ]),
    }),
  };

  const projectResult = await generateAssessmentPackageDraft({
    generationPlan: planProject,
    provider: projectProvider,
  });

  const projectInst = projectResult.generatedPackage?.instruments[0] as any;
  assert(projectInst?.projectBrief === 'Rancanglah mini proyek pengolahan sampah organik.', 'Case CD: projectBrief is non-empty string');
  assert(projectInst?.projectBrief !== '', 'Case CD: projectBrief is never empty string');

  const projectBlueprint = projectResult.generatedPackage?.blueprintItems.find((bp) => bp.instrumentType === 'PROJECT')!;
  assert(
    projectBlueprint.coverageUnitId === projContractSec5.units[0].coverageUnitId &&
      projectBlueprint.instrumentId === projectInst.id &&
      projectBlueprint.instrumentItemIds.length === 0,
    'B.1.2b Case 7: PROJECT blueprint uses explicit instrumentId without fake child IDs'
  );

  // Case CE: PRODUCT never maps empty productBrief
  const mockPlanProdSec5: AssessmentPlan = {
    ...mockPlanMatSiap,
    id: 'plan-prod-sec5',
    instruments: [{ id: 'inst-prod-sec5', type: 'PRODUCT', label: 'Penilaian Produk' }],
  };
  const specProductSec5 = resolveAssessmentGenerationSpec({
    academicSetting: mockAcademicSettingSD4,
    assessmentPlan: mockPlanProdSec5,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  const planProduct = resolveAssessmentGenerationPlan({ generationSpec: specProductSec5 });
  const productContractSec5 = buildGenerationContract(planProduct, teacherContext);

  const productProvider: AssessmentAIGenerationProvider = {
    generate: async () => ({
      rawText: JSON.stringify([
        {
          coverageUnitId: productContractSec5.units[0].coverageUnitId,
          objectiveRefId: productContractSec5.units[0].objectiveRefId,
          criterionId: productContractSec5.units[0].criterionId,
          allocationUnit: 'TASK',
          instrumentType: 'PRODUCT',
          taskTitle: 'Poster Hemat Energi',
          instructions: 'Buatlah poster karya ilmiah tentang penghematan listrik.',
        },
      ]),
    }),
  };

  const productResult = await generateAssessmentPackageDraft({
    generationPlan: planProduct,
    provider: productProvider,
  });

  const productInst = productResult.generatedPackage?.instruments[0] as any;
  assert(productInst?.productBrief.includes('Buatlah poster'), 'Case CE: productBrief is non-empty string');
  assert(productInst?.productBrief !== '', 'Case CE: productBrief is never empty string');

  const productBlueprint = productResult.generatedPackage?.blueprintItems.find((bp) => bp.instrumentType === 'PRODUCT')!;
  assert(
    productBlueprint.coverageUnitId === productContractSec5.units[0].coverageUnitId &&
      productBlueprint.instrumentId === productInst.id &&
      productBlueprint.instrumentItemIds.length === 0,
    'B.1.2b Case 8: PRODUCT blueprint uses explicit instrumentId without fake child IDs'
  );

  // Case CF: PERFORMANCE never maps empty task
  const perfFallbackProvider: AssessmentAIGenerationProvider = {
    generate: async () => ({
      rawText: JSON.stringify([
        {
          coverageUnitId: perfContract.units[0].coverageUnitId,
          objectiveRefId: perfContract.units[0].objectiveRefId,
          criterionId: perfContract.units[0].criterionId,
          allocationUnit: 'TASK',
          instrumentType: 'PERFORMANCE',
          taskPrompt: 'Demonstrasikan cara mengukur panjang meja menggunakan penggaris secara tepat.',
        },
      ]),
    }),
  };

  const perfCaseCFResult = await generateAssessmentPackageDraft({
    generationPlan: planPerf,
    provider: perfFallbackProvider,
  });

  const perfInstItem = perfCaseCFResult.generatedPackage?.instruments[0] as any;
  assert(perfInstItem?.task === 'Demonstrasikan cara mengukur panjang meja menggunakan penggaris secara tepat.', 'Case CF: Performance task is non-empty string');
  assert(perfInstItem?.task !== '', 'Case CF: Performance task is never empty string');

  // Case CG: ASSIGNMENT does not use empty semantic fallback
  const assignResult = await generateAssessmentPackageDraft({
    generationPlan: planAssign,
    provider: taskNoScoringFallbackProvider,
  });

  const assignInstItem = assignResult.generatedPackage?.instruments[0] as any;
  assert(assignInstItem?.instructions === 'Penugasan Mandiri', 'Case CG: Assignment instructions non-empty string derived from valid task content');
  assert(assignInstItem?.instructions !== '', 'Case CG: Assignment instructions is never empty string');

  const assignBlueprint = assignResult.generatedPackage?.blueprintItems.find((bp) => bp.instrumentType === 'ASSIGNMENT')!;
  assert(
    assignBlueprint.coverageUnitId === assignContract.units[0].coverageUnitId &&
      assignBlueprint.instrumentId === assignInstItem.id &&
      assignBlueprint.instrumentItemIds.length === 0,
    'B.1.2b Case 9: ASSIGNMENT blueprint uses explicit instrumentId without fake child IDs'
  );

  // Case CH: Portfolio instructions are not forced to empty string when missing
  const mockPlanPortSec5: AssessmentPlan = {
    ...mockPlanMatSiap,
    id: 'plan-port-sec5',
    instruments: [{ id: 'inst-port-sec5', type: 'PORTFOLIO', label: 'Portofolio' }],
  };
  const specPortSec5 = resolveAssessmentGenerationSpec({
    academicSetting: mockAcademicSettingSD4,
    assessmentPlan: mockPlanPortSec5,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  const planPort = resolveAssessmentGenerationPlan({ generationSpec: specPortSec5 });
  const portContractSec5 = buildGenerationContract(planPort, teacherContext);

  const b12MinimalPortfolio = parseAndValidateRawAIResponse(
    JSON.stringify([
      {
        coverageUnitId:
          portContractSec5.units[0].coverageUnitId,
        evidenceRequirements: [
          'Dokumentasi hasil belajar murid',
        ],
      },
    ]),
    portContractSec5
  );

  assert(
    b12MinimalPortfolio.validatedUnits.length === 1 &&
      b12MinimalPortfolio.validatedUnits[0]
        .allocationUnit === 'EVIDENCE',
    'B.1.2 Case 5: Minimal structured PORTFOLIO EVIDENCE is accepted'
  );

  const portNoInstructionsProvider: AssessmentAIGenerationProvider = {
    generate: async () => ({
      rawText: JSON.stringify([
        {
          coverageUnitId: portContractSec5.units[0].coverageUnitId,
          objectiveRefId: portContractSec5.units[0].objectiveRefId,
          criterionId: portContractSec5.units[0].criterionId,
          allocationUnit: 'EVIDENCE',
          instrumentType: 'PORTFOLIO',
          evidenceRequirements: ['Laporan hasil praktikum pecahan'],
        },
      ]),
    }),
  };

  const portResult = await generateAssessmentPackageDraft({
    generationPlan: planPort,
    provider: portNoInstructionsProvider,
  });

  const portInst = portResult.generatedPackage?.instruments[0] as any;
  assert(portInst?.instructions === undefined, 'Case CH: Portfolio instructions are undefined when missing (NOT forced to empty string)');

  const portBlueprint = portResult.generatedPackage?.blueprintItems.find((bp) => bp.instrumentType === 'PORTFOLIO')!;
  assert(
    portBlueprint.coverageUnitId === portContractSec5.units[0].coverageUnitId &&
      portBlueprint.instrumentId === portInst.id &&
      portBlueprint.instrumentItemIds.length === 0,
    'B.1.2b Case 10: PORTFOLIO blueprint uses explicit instrumentId without fake child IDs'
  );

  // Case CI: Empty evidence requirement rejected
  const portUnit0 = portContractSec5.units[0];
  const parsedEmptyEvidenceResult = parseAndValidateRawAIResponse(
    JSON.stringify([
      {
        coverageUnitId: portUnit0.coverageUnitId,
        objectiveRefId: portUnit0.objectiveRefId,
        criterionId: portUnit0.criterionId,
        allocationUnit: 'EVIDENCE',
        instrumentType: 'PORTFOLIO',
        evidenceRequirements: ['  ', ''],
      },
    ]),
    portContractSec5
  );

  assert(parsedEmptyEvidenceResult.validatedUnits.length === 0, 'Case CI: Empty evidence requirements unit rejected');
  assert(
    parsedEmptyEvidenceResult.issues.some((i) => i.code === 'EMPTY_EVIDENCE_REQUIREMENTS'),
    'Case CI: Issue code EMPTY_EVIDENCE_REQUIREMENTS recorded'
  );

  // Case CJ: Observation optional metadata remains undefined when absent
  const mockPlanObsSec5: AssessmentPlan = {
    ...mockPlanMatSiap,
    id: 'plan-obs-sec5',
    instruments: [{ id: 'inst-obs-sec5', type: 'OBSERVATION', label: 'Observasi' }],
  };
  const specObsSec5 = resolveAssessmentGenerationSpec({
    academicSetting: mockAcademicSettingSD4,
    assessmentPlan: mockPlanObsSec5,
    tp: mockTPMat,
    assessmentCriteria: mockCriteriaMat,
  });
  const planObsSimple = resolveAssessmentGenerationPlan({ generationSpec: specObsSec5 });
  const obsContractSec5 = buildGenerationContract(planObsSimple, teacherContext);

  const obsSimpleProvider: AssessmentAIGenerationProvider = {
    generate: async () => ({
      rawText: JSON.stringify([
        {
          coverageUnitId: obsContractSec5.units[0].coverageUnitId,
          objectiveRefId: obsContractSec5.units[0].objectiveRefId,
          criterionId: obsContractSec5.units[0].criterionId,
          allocationUnit: 'OBSERVATION',
          instrumentType: 'OBSERVATION',
          aspects: [{ label: 'Keaktifan', indicator: 'Siswa bertanya' }],
        },
      ]),
    }),
  };

  const obsSimpleResult = await generateAssessmentPackageDraft({
    generationPlan: planObsSimple,
    provider: obsSimpleProvider,
  });

  const obsSimpleInst = obsSimpleResult.generatedPackage?.instruments[0] as any;
  assert(obsSimpleInst?.instructions === undefined, 'Case CJ: Observation instructions undefined when absent');
  assert(obsSimpleInst?.recordingScheme === undefined, 'Case CJ: Observation recordingScheme undefined when absent');

  // Case CK: No pre-generation fake provenance across all units in contract
  const multiUnitContract = buildGenerationContract(validPlan, teacherContext);
  multiUnitContract.units.forEach((u, i) => {
    assert(u.indicatorSource === undefined, `Case CK: Unit #${i + 1} indicatorSource undefined before generation`);
    assert(u.materialSource === undefined, `Case CK: Unit #${i + 1} materialSource undefined before generation`);
  });

  // Case CL: Existing academicSettingId regression remains correct
  assert(contract.academicSettingId === 'setting-sd-4', 'Case CL: Canonical academicSettingId preserved');

  // Case CM: Package remains DRAFT
  assert(pkg.workflowStatus === 'DRAFT', 'Case CM: Package workflowStatus is DRAFT');
  assert(pkg.needsReview === true, 'Case CM: Package needsReview is true');

  // Case CN: No auto-SIAP
  assert(pkg.workflowStatus !== 'SIAP', 'Case CN: Package workflowStatus is NEVER auto-SIAP');

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log(`\n=== REGRESSION SUITE COMPLETED ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Fatal regression suite error:', err);
  process.exit(1);
});
