import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  AssessmentGenerationContract,
  AssessmentGenerationPlan,
  AssessmentPackage,
  GeneratedTaskUnit,
  PerformanceAssessmentInstrument,
  AssignmentAssessmentInstrument,
  ProjectAssessmentInstrument,
  ProductAssessmentInstrument,
  PortfolioAssessmentInstrument,
  SubjectAssessmentProfile,
  AssessmentGenerationContractUnit,
} from '../src/types';
import {
  CanonicalAssessmentDocumentSnapshot,
} from '../src/types/assessmentExport';
import {
  parseAndValidateRawAIResponse,
  mapGeneratedUnitsToAssessmentPackage,
} from '../src/services/assessmentPackageGeneratorService';
import { validateAssessmentPackage } from '../src/services/assessmentPackageService';
import { buildNormalizedAssessmentDocumentModel } from '../src/services/documentEngine/assessmentExportService';

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

  console.log('=== B.1.2e ASSESSMENT CONTENT FIDELITY REGRESSION SUITE ===\n');

  const defaultSubjectProfile: SubjectAssessmentProfile = {
    subjectKey: 'pjok',
    subjectLabel: 'Pendidikan Jasmani',
    competencyDomains: [],
    supportedEvidenceTypes: ['PRODUCT', 'PERFORMANCE'],
    supportedInstrumentTypes: ['PERFORMANCE', 'ASSIGNMENT', 'PROJECT', 'PRODUCT', 'PORTFOLIO'],
    recommendationRules: [],
    provenance: [],
    profileStatus: 'SPECIFIC',
  };

  const basePlan: AssessmentGenerationPlan = {
    academicSettingId: 'setting-b12e',
    coverageUnits: [
      { id: 'cov-perf-1', evidenceType: 'PERFORMANCE', objectiveRefId: 'tp-1', provenance: [], status: 'RESOLVED', issues: [] },
      { id: 'cov-perf-2', evidenceType: 'PERFORMANCE', objectiveRefId: 'tp-1', provenance: [], status: 'RESOLVED', issues: [] },
      { id: 'cov-perf-3', evidenceType: 'PERFORMANCE', objectiveRefId: 'tp-1', provenance: [], status: 'RESOLVED', issues: [] },
      { id: 'cov-assign-1', evidenceType: 'PRODUCT', objectiveRefId: 'tp-1', provenance: [], status: 'RESOLVED', issues: [] },
      { id: 'cov-proj-1', evidenceType: 'PRODUCT', objectiveRefId: 'tp-1', provenance: [], status: 'RESOLVED', issues: [] },
      { id: 'cov-prod-1', evidenceType: 'PRODUCT', objectiveRefId: 'tp-1', provenance: [], status: 'RESOLVED', issues: [] },
      { id: 'cov-rub-1', evidenceType: 'PRODUCT', objectiveRefId: 'tp-1', provenance: [], status: 'RESOLVED', issues: [] },
      { id: 'cov-rub-assign', evidenceType: 'PRODUCT', objectiveRefId: 'tp-1', provenance: [], status: 'RESOLVED', issues: [] },
      { id: 'cov-rub-prod', evidenceType: 'PRODUCT', objectiveRefId: 'tp-1', provenance: [], status: 'RESOLVED', issues: [] },
      { id: 'cov-prod-empty', evidenceType: 'PRODUCT', objectiveRefId: 'tp-1', provenance: [], status: 'RESOLVED', issues: [] },
    ],
    generationSpec: {
      assessmentPlanId: 'plan-b12e',
      assessmentPackageId: 'pkg-b12e',
      academicSettingId: 'setting-b12e',
      curriculumContext: {
        academicSettingId: 'setting-b12e',
        curriculumType: 'KURIKULUM_MERDEKA',
        grade: 4,
        phase: 'B',
      },
      objectives: [],
      criteria: [],
      subjectProfile: defaultSubjectProfile,
      evidenceRecommendations: [],
      plannedInstrumentTypes: ['PERFORMANCE', 'ASSIGNMENT', 'PROJECT', 'PRODUCT', 'PORTFOLIO'],
      sourceContext: [],
      resolution: {
        status: 'RESOLVED',
        issues: [],
      },
    },
    constraints: {
      assemblyMode: 'AUTO_RECOMMENDED',
    },
    summary: {
      objectiveCount: 1,
      criterionCount: 0,
      coverageUnitCount: 10,
      allocationSummary: {
        itemCount: 0,
        taskCount: 10,
        evidenceCount: 0,
        observationCount: 0,
        unresolvedCount: 0,
      },
    },
    resolution: {
      status: 'RESOLVED',
      issues: [],
    },
  };

  function createContract(
    units: AssessmentGenerationContractUnit[],
    overrides: Partial<AssessmentGenerationContract> = {}
  ): AssessmentGenerationContract {
    return {
      assessmentPlanId: 'plan-b12e',
      assessmentPackageId: 'pkg-b12e',
      academicSettingId: 'setting-b12e',
      curriculumContext: {
        academicSettingId: 'setting-b12e',
        curriculumType: 'KURIKULUM_MERDEKA',
        grade: 4,
        phase: 'B',
      },
      subjectProfile: defaultSubjectProfile,
      sourceContext: [],
      units,
      ...overrides,
    };
  }

  function createMockSnapshot(
    pkg: AssessmentPackage,
    overrides: Partial<CanonicalAssessmentDocumentSnapshot> = {}
  ): CanonicalAssessmentDocumentSnapshot {
    return {
      snapshotId: `snap-${pkg.id}`,
      mode: 'CANONICAL_PACKAGE',
      documentType: 'ASESMEN',
      documentDate: '2026-09-25',
      formattedDocumentDate: '25 September 2026',
      assessmentPlanId: 'plan-b12e',
      assessmentPackageId: pkg.id,
      assessmentPackageRevision: pkg.revision ?? 1,
      packageTitle: pkg.title,
      schoolName: 'SMA Bintang Bangsa',
      principalName: 'Kepala Sekolah',
      teacherName: 'Guru PJOK',
      academicYear: '2026/2027',
      semester: '1 (Ganjil)',
      grade: 'Kelas 4',
      subject: 'PJOK',
      curriculum: 'Kurikulum Merdeka',
      blueprintItems: pkg.blueprintItems || [],
      instruments: pkg.instruments || [],
      answerKeys: pkg.answerKeys || [],
      scoringGuides: pkg.scoringGuides || [],
      rubrics: pkg.rubrics || [],
      resolvedObjectives: {},
      documentMode: 'data',
      generatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  // ----------------------------------------------------
  // TEST 1 — PERFORMANCE PRESERVES INSTRUCTIONS
  // ----------------------------------------------------
  test('TEST 1: Performance preserves instructions when provided', () => {
    const contract = createContract([
      {
        coverageUnitId: 'cov-perf-1',
        allocationUnit: 'TASK',
        instrumentType: 'PERFORMANCE',
        objectiveRefId: 'tp-1',
        objectiveText: 'Memahami PJOK',
        requiredCount: 1,
      },
    ]);

    const rawAI = JSON.stringify({
      units: [
        {
          coverageUnitId: 'cov-perf-1',
          taskTitle: 'Praktik Senam Lantai',
          taskPrompt: 'Lakukan rangkaian gerak.',
          instructions: 'Lakukan secara aman dan berurutan.',
        },
      ],
    });

    const parsed = parseAndValidateRawAIResponse(rawAI, contract);
    assert.strictEqual(parsed.validatedUnits.length, 1);
    const taskUnit = parsed.validatedUnits[0] as GeneratedTaskUnit;
    assert.strictEqual(taskUnit.instructions, 'Lakukan secara aman dan berurutan.');

    const pkg = mapGeneratedUnitsToAssessmentPackage(parsed.validatedUnits, contract, basePlan);
    const inst = pkg.instruments[0] as PerformanceAssessmentInstrument;
    assert.strictEqual(inst.task, 'Lakukan rangkaian gerak.');
    assert.strictEqual(inst.instructions, 'Lakukan secara aman dan berurutan.');
  });

  // ----------------------------------------------------
  // TEST 2 — PERFORMANCE DOES NOT INVENT INSTRUCTIONS
  // ----------------------------------------------------
  test('TEST 2: Performance does not invent instructions when missing from AI', () => {
    const contract = createContract([
      {
        coverageUnitId: 'cov-perf-2',
        allocationUnit: 'TASK',
        instrumentType: 'PERFORMANCE',
        objectiveRefId: 'tp-1',
        objectiveText: 'Memahami PJOK',
        requiredCount: 1,
      },
    ]);

    const rawAI = JSON.stringify({
      units: [
        {
          coverageUnitId: 'cov-perf-2',
          taskTitle: 'Praktik Senam Lantai',
          taskPrompt: 'Lakukan rangkaian gerak.',
        },
      ],
    });

    const parsed = parseAndValidateRawAIResponse(rawAI, contract);
    assert.strictEqual(parsed.validatedUnits.length, 1);
    const taskUnit = parsed.validatedUnits[0] as GeneratedTaskUnit;
    assert.strictEqual(taskUnit.instructions, undefined);

    const pkg = mapGeneratedUnitsToAssessmentPackage(parsed.validatedUnits, contract, basePlan);
    const inst = pkg.instruments[0] as PerformanceAssessmentInstrument;
    assert.strictEqual(inst.task, 'Lakukan rangkaian gerak.');
    assert.strictEqual(inst.instructions, undefined, 'Performance instructions must be undefined, not duplicated from taskPrompt');
  });

  // ----------------------------------------------------
  // TEST 3 — PERFORMANCE ASPECT WEIGHT
  // ----------------------------------------------------
  test('TEST 3: Performance aspect weights are preserved in package and normalized model', () => {
    const contract = createContract([
      {
        coverageUnitId: 'cov-perf-3',
        allocationUnit: 'TASK',
        instrumentType: 'PERFORMANCE',
        objectiveRefId: 'tp-1',
        objectiveText: 'Memahami PJOK',
        requiredCount: 1,
      },
    ]);

    const rawAI = JSON.stringify({
      units: [
        {
          coverageUnitId: 'cov-perf-3',
          taskTitle: 'Praktik Gerak Berirama',
          taskPrompt: 'Praktikkan variasi gerak.',
          aspects: [
            { label: 'Kelenturan', description: 'Ketepatan gerak tubuh', weight: 40 },
            { label: 'Ketepatan Irama', description: 'Kesesuaian dengan ketukan', weight: 60 },
          ],
        },
      ],
    });

    const parsed = parseAndValidateRawAIResponse(rawAI, contract);
    const pkg = mapGeneratedUnitsToAssessmentPackage(parsed.validatedUnits, contract, basePlan);
    const inst = pkg.instruments[0] as PerformanceAssessmentInstrument;
    assert(inst.aspects && inst.aspects.length === 2);
    assert.strictEqual(inst.aspects[0].weight, 40);
    assert.strictEqual(inst.aspects[1].weight, 60);

    const snapshot = createMockSnapshot(pkg);
    const model = buildNormalizedAssessmentDocumentModel(snapshot);
    const normInst = model.instruments.list[0];
    assert(normInst.performanceAspects && normInst.performanceAspects.length === 2);
    assert.strictEqual(normInst.performanceAspects[0].weight, 40);
    assert.strictEqual(normInst.performanceAspects[1].weight, 60);
  });

  // ----------------------------------------------------
  // TEST 4 — ASSIGNMENT EXPECTED OUTPUT
  // ----------------------------------------------------
  test('TEST 4: Assignment maps expectedDeliverable to expectedOutput and preserves explicit instructions', () => {
    const contract = createContract([
      {
        coverageUnitId: 'cov-assign-1',
        allocationUnit: 'TASK',
        instrumentType: 'ASSIGNMENT',
        objectiveRefId: 'tp-1',
        objectiveText: 'Memahami PJOK',
        requiredCount: 1,
      },
    ]);

    // Subtest 4a: Derived instructions from taskPrompt, expectedDeliverable to expectedOutput
    const rawAI1 = JSON.stringify({
      units: [
        {
          coverageUnitId: 'cov-assign-1',
          taskTitle: 'Tugas Rangkuman',
          taskPrompt: 'Buat rangkuman materi ekosistem.',
          expectedDeliverable: 'Rangkuman satu halaman.',
        },
      ],
    });

    const parsed1 = parseAndValidateRawAIResponse(rawAI1, contract);
    const pkg1 = mapGeneratedUnitsToAssessmentPackage(parsed1.validatedUnits, contract, basePlan);
    const inst1 = pkg1.instruments[0] as AssignmentAssessmentInstrument;
    assert.strictEqual(inst1.instructions, 'Buat rangkuman materi ekosistem.');
    assert.strictEqual(inst1.expectedOutput, 'Rangkuman satu halaman.');

    // Subtest 4b: Explicit instructions take precedence over taskPrompt
    const rawAI2 = JSON.stringify({
      units: [
        {
          coverageUnitId: 'cov-assign-1',
          taskTitle: 'Tugas Rangkuman',
          taskPrompt: 'Buat rangkuman materi ekosistem.',
          instructions: 'Tulis tangan pada buku catatan bertinta biru.',
          expectedDeliverable: 'Rangkuman satu halaman.',
        },
      ],
    });

    const parsed2 = parseAndValidateRawAIResponse(rawAI2, contract);
    const pkg2 = mapGeneratedUnitsToAssessmentPackage(parsed2.validatedUnits, contract, basePlan);
    const inst2 = pkg2.instruments[0] as AssignmentAssessmentInstrument;
    assert.strictEqual(inst2.instructions, 'Tulis tangan pada buku catatan bertinta biru.');
    assert.strictEqual(inst2.expectedOutput, 'Rangkuman satu halaman.');
  });

  // ----------------------------------------------------
  // TEST 5 — PROJECT EXPECTED DELIVERABLE
  // ----------------------------------------------------
  test('TEST 5: Project maps taskPrompt to projectBrief and preserves expectedDeliverable', () => {
    const contract = createContract([
      {
        coverageUnitId: 'cov-proj-1',
        allocationUnit: 'TASK',
        instrumentType: 'PROJECT',
        objectiveRefId: 'tp-1',
        objectiveText: 'Memahami PJOK',
        requiredCount: 1,
      },
    ]);

    const rawAI = JSON.stringify({
      units: [
        {
          coverageUnitId: 'cov-proj-1',
          taskTitle: 'Proyek Poster Digital',
          taskPrompt: 'Rancang infografis energi terbarukan.',
          expectedDeliverable: 'Infografis digital format PDF.',
        },
      ],
    });

    const parsed = parseAndValidateRawAIResponse(rawAI, contract);
    const pkg = mapGeneratedUnitsToAssessmentPackage(parsed.validatedUnits, contract, basePlan);
    const inst = pkg.instruments[0] as ProjectAssessmentInstrument;
    assert.strictEqual(inst.projectBrief, 'Rancang infografis energi terbarukan.');
    assert.strictEqual(inst.expectedDeliverable, 'Infografis digital format PDF.');

    const snapshot = createMockSnapshot(pkg);
    const model = buildNormalizedAssessmentDocumentModel(snapshot);
    const normInst = model.instruments.list[0];
    assert.strictEqual(normInst.projectBrief, 'Rancang infografis energi terbarukan.');
    assert.strictEqual(normInst.expectedDeliverable, 'Infografis digital format PDF.');
  });

  // ----------------------------------------------------
  // TEST 6 — PRODUCT EXPECTED PRODUCT
  // ----------------------------------------------------
  test('TEST 6: Product maps taskPrompt to productBrief and expectedDeliverable to expectedProduct', () => {
    const contract = createContract([
      {
        coverageUnitId: 'cov-prod-1',
        allocationUnit: 'TASK',
        instrumentType: 'PRODUCT',
        objectiveRefId: 'tp-1',
        objectiveText: 'Memahami PJOK',
        requiredCount: 1,
      },
    ]);

    const rawAI = JSON.stringify({
      units: [
        {
          coverageUnitId: 'cov-prod-1',
          taskTitle: 'Produk Rekayasa Sederhana',
          taskPrompt: 'Buat maket jembatan sederhana.',
          expectedDeliverable: 'Maket jembatan stik es krim.',
        },
      ],
    });

    const parsed = parseAndValidateRawAIResponse(rawAI, contract);
    const pkg = mapGeneratedUnitsToAssessmentPackage(parsed.validatedUnits, contract, basePlan);
    const inst = pkg.instruments[0] as ProductAssessmentInstrument;
    assert.strictEqual(inst.productBrief, 'Buat maket jembatan sederhana.');
    assert.strictEqual(inst.expectedProduct, 'Maket jembatan stik es krim.');

    const snapshot = createMockSnapshot(pkg);
    const model = buildNormalizedAssessmentDocumentModel(snapshot);
    const normInst = model.instruments.list[0];
    assert.strictEqual(normInst.productBrief, 'Buat maket jembatan sederhana.');
    assert.strictEqual(normInst.expectedProduct, 'Maket jembatan stik es krim.');
  });

  // ----------------------------------------------------
  // TEST 7 — RUBRIC CRITERIA WEIGHT PRESERVED
  // ----------------------------------------------------
  test('TEST 7: Rubric criteria weights are preserved in package and normalized model (PROJECT)', () => {
    const contract = createContract([
      {
        coverageUnitId: 'cov-rub-1',
        allocationUnit: 'TASK',
        instrumentType: 'PROJECT',
        objectiveRefId: 'tp-1',
        objectiveText: 'Memahami PJOK',
        requiredCount: 1,
      },
    ]);

    const rawAI = JSON.stringify({
      units: [
        {
          coverageUnitId: 'cov-rub-1',
          taskTitle: 'Proyek Presentasi',
          taskPrompt: 'Presentasikan hasil riset.',
          rubricDraft: {
            title: 'Rubrik Presentasi',
            criteria: [
              { label: 'Kesesuaian', indicator: 'Materi relevan', weight: 50 },
              { label: 'Kerapian', indicator: 'Slide terstruktur', weight: 50 },
            ],
            scale: [
              { label: 'Baik', score: 3, descriptor: 'Lengkap', order: 1 },
              { label: 'Cukup', score: 2, descriptor: 'Sebagian', order: 2 },
            ],
          },
        },
      ],
    });

    const parsed = parseAndValidateRawAIResponse(rawAI, contract);
    const pkg = mapGeneratedUnitsToAssessmentPackage(parsed.validatedUnits, contract, basePlan);
    assert(pkg.rubrics && pkg.rubrics.length === 1);
    assert.strictEqual(pkg.rubrics[0].criteria[0].weight, 50);
    assert.strictEqual(pkg.rubrics[0].criteria[1].weight, 50);

    const snapshot = createMockSnapshot(pkg);
    const model = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(model.rubrics.list[0].criteria[0].weight, 50);
    assert.strictEqual(model.rubrics.list[0].criteria[1].weight, 50);
  });

  // ----------------------------------------------------
  // TEST 7b — ASSIGNMENT RUBRIC WEIGHT PRESERVED
  // ----------------------------------------------------
  test('TEST 7b: Assignment rubric criteria weights are preserved in package and normalized model', () => {
    const contract = createContract([
      {
        coverageUnitId: 'cov-rub-assign',
        allocationUnit: 'TASK',
        instrumentType: 'ASSIGNMENT',
        objectiveRefId: 'tp-1',
        objectiveText: 'Memahami PJOK',
        requiredCount: 1,
      },
    ]);

    const rawAI = JSON.stringify({
      units: [
        {
          coverageUnitId: 'cov-rub-assign',
          taskPrompt: 'Susun laporan singkat.',
          rubricDraft: {
            title: 'Rubrik Penugasan',
            criteria: [
              {
                label: 'Ketepatan Isi',
                indicator: 'Isi sesuai materi.',
                weight: 60,
              },
              {
                label: 'Kerapian',
                indicator: 'Laporan disusun rapi.',
                weight: 40,
              },
            ],
            scale: [
              {
                label: 'Baik',
                score: 3,
                descriptor: 'Memenuhi kriteria.',
                order: 1,
              },
            ],
          },
        },
      ],
    });

    const parsed = parseAndValidateRawAIResponse(rawAI, contract);
    const pkg = mapGeneratedUnitsToAssessmentPackage(parsed.validatedUnits, contract, basePlan);
    assert(pkg.rubrics && pkg.rubrics.length === 1);
    assert.strictEqual(pkg.rubrics[0].criteria[0].weight, 60);
    assert.strictEqual(pkg.rubrics[0].criteria[1].weight, 40);

    const snapshot = createMockSnapshot(pkg);
    const model = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(model.rubrics.list[0].criteria[0].weight, 60);
    assert.strictEqual(model.rubrics.list[0].criteria[1].weight, 40);
  });

  // ----------------------------------------------------
  // TEST 7c — PRODUCT RUBRIC WEIGHT PRESERVED
  // ----------------------------------------------------
  test('TEST 7c: Product rubric criteria weights are preserved in package and normalized model', () => {
    const contract = createContract([
      {
        coverageUnitId: 'cov-rub-prod',
        allocationUnit: 'TASK',
        instrumentType: 'PRODUCT',
        objectiveRefId: 'tp-1',
        objectiveText: 'Memahami PJOK',
        requiredCount: 1,
      },
    ]);

    const rawAI = JSON.stringify({
      units: [
        {
          coverageUnitId: 'cov-rub-prod',
          taskPrompt: 'Buat model tiga dimensi.',
          rubricDraft: {
            title: 'Rubrik Produk',
            criteria: [
              {
                label: 'Fungsi',
                indicator: 'Produk berfungsi sesuai tujuan.',
                weight: 70,
              },
              {
                label: 'Kerapian',
                indicator: 'Produk tersusun rapi.',
                weight: 30,
              },
            ],
            scale: [
              {
                label: 'Baik',
                score: 3,
                descriptor: 'Memenuhi kriteria.',
                order: 1,
              },
            ],
          },
        },
      ],
    });

    const parsed = parseAndValidateRawAIResponse(rawAI, contract);
    const pkg = mapGeneratedUnitsToAssessmentPackage(parsed.validatedUnits, contract, basePlan);
    assert(pkg.rubrics && pkg.rubrics.length === 1);
    assert.strictEqual(pkg.rubrics[0].criteria[0].weight, 70);
    assert.strictEqual(pkg.rubrics[0].criteria[1].weight, 30);

    const snapshot = createMockSnapshot(pkg);
    const model = buildNormalizedAssessmentDocumentModel(snapshot);
    assert.strictEqual(model.rubrics.list[0].criteria[0].weight, 70);
    assert.strictEqual(model.rubrics.list[0].criteria[1].weight, 30);
  });

  // ----------------------------------------------------
  // TEST 8 — PORTFOLIO WITHOUT INSTRUCTIONS PASSES VALIDATION
  // ----------------------------------------------------
  test('TEST 8: Portfolio instrument without instructions passes package validation', () => {
    const portfolioPkg: AssessmentPackage = {
      id: 'pkg-port-valid',
      assessmentPlanId: 'plan-port-1',
      academicSettingId: 'setting-1',
      title: 'Perangkat Portofolio',
      blueprintItems: [],
      instruments: [
        {
          id: 'inst-port-1',
          type: 'PORTFOLIO',
          title: 'Instrumen Portofolio',
          instructions: undefined,
          evidenceRequirements: ['Laporan praktikum'],
        } as PortfolioAssessmentInstrument,
      ],
      answerKeys: [],
      scoringGuides: [],
      rubrics: [],
      workflowStatus: 'DRAFT',
      needsReview: false,
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provenance: {
        generatedBy: 'USER',
        generatedAt: new Date().toISOString(),
      },
    };

    const result = validateAssessmentPackage(portfolioPkg, {
      academicSetting: {
        id: 'setting-1',
        profileId: 'prof-1',
        curriculum: 'Kurikulum Merdeka',
        academicYear: '2025/2026',
        semester: '1 (Ganjil)',
        grade: 'Kelas 4',
        phase: 'B',
        subject: 'PJOK',
        updatedAt: new Date().toISOString(),
      },
      assessmentPlan: {
        id: 'plan-port-1',
        academicSettingId: 'setting-1',
        title: 'Rencana Portofolio',
        workflowStatus: 'SIAP',
        purpose: 'SUMMATIVE',
        timing: 'POST',
        scopeType: 'TP',
        tpIds: [],
        criterionIds: [],
        instruments: [{ id: 'inst-port-1', type: 'PORTFOLIO', label: 'Portofolio' }],
        createdAt: '',
        updatedAt: '',
      },
    });

    const hasPortfolioInstructionError = result.errors.some((e) =>
      e.includes('Asesmen Portofolio wajib memiliki instruksi.')
    );
    assert.strictEqual(
      hasPortfolioInstructionError,
      false,
      'validateAssessmentPackage must not require instructions for PORTFOLIO'
    );
  });

  // ----------------------------------------------------
  // TEST 8b — PORTFOLIO EVIDENCE REQUIRED (EMPTY ARRAY)
  // ----------------------------------------------------
  test('TEST 8b: Portfolio instrument with empty evidenceRequirements is invalid', () => {
    const invalidPortfolioPkg: AssessmentPackage = {
      id: 'pkg-port-invalid-empty',
      assessmentPlanId: 'plan-port-invalid',
      academicSettingId: 'setting-1',
      title: 'Perangkat Portofolio Invalid Empty',
      blueprintItems: [],
      instruments: [
        {
          id: 'inst-port-invalid-1',
          type: 'PORTFOLIO',
          title: 'Instrumen Portofolio',
          instructions: undefined,
          evidenceRequirements: [],
        } as PortfolioAssessmentInstrument,
      ],
      answerKeys: [],
      scoringGuides: [],
      rubrics: [],
      workflowStatus: 'DRAFT',
      needsReview: false,
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provenance: {
        generatedBy: 'USER',
        generatedAt: new Date().toISOString(),
      },
    };

    const result = validateAssessmentPackage(invalidPortfolioPkg, {
      academicSetting: {
        id: 'setting-1',
        profileId: 'prof-1',
        curriculum: 'Kurikulum Merdeka',
        academicYear: '2025/2026',
        semester: '1 (Ganjil)',
        grade: 'Kelas 4',
        phase: 'B',
        subject: 'PJOK',
        updatedAt: new Date().toISOString(),
      },
      assessmentPlan: {
        id: 'plan-port-invalid',
        academicSettingId: 'setting-1',
        title: 'Rencana Portofolio',
        workflowStatus: 'SIAP',
        purpose: 'SUMMATIVE',
        timing: 'POST',
        scopeType: 'TP',
        tpIds: [],
        criterionIds: [],
        instruments: [{ id: 'inst-port-invalid-1', type: 'PORTFOLIO', label: 'Portofolio' }],
        createdAt: '',
        updatedAt: '',
      },
    });

    assert.strictEqual(result.valid, false, 'Portfolio without evidence requirements must be invalid');
    const hasEvidenceError = result.errors.some((e) =>
      e.includes('persyaratan bukti')
    );
    assert.strictEqual(
      hasEvidenceError,
      true,
      'validateAssessmentPackage must fail when portfolio evidenceRequirements is empty'
    );
  });

  // ----------------------------------------------------
  // TEST 8c — PORTFOLIO EVIDENCE REQUIRED (UNDEFINED)
  // ----------------------------------------------------
  test('TEST 8c: Portfolio instrument with undefined evidenceRequirements is invalid', () => {
    const invalidPortfolioPkg: AssessmentPackage = {
      id: 'pkg-port-invalid-undef',
      assessmentPlanId: 'plan-port-invalid',
      academicSettingId: 'setting-1',
      title: 'Perangkat Portofolio Invalid Undefined',
      blueprintItems: [],
      instruments: [
        {
          id: 'inst-port-invalid-2',
          type: 'PORTFOLIO',
          title: 'Instrumen Portofolio',
          instructions: undefined,
          evidenceRequirements: undefined as any,
        } as PortfolioAssessmentInstrument,
      ],
      answerKeys: [],
      scoringGuides: [],
      rubrics: [],
      workflowStatus: 'DRAFT',
      needsReview: false,
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provenance: {
        generatedBy: 'USER',
        generatedAt: new Date().toISOString(),
      },
    };

    const result = validateAssessmentPackage(invalidPortfolioPkg, {
      academicSetting: {
        id: 'setting-1',
        profileId: 'prof-1',
        curriculum: 'Kurikulum Merdeka',
        academicYear: '2025/2026',
        semester: '1 (Ganjil)',
        grade: 'Kelas 4',
        phase: 'B',
        subject: 'PJOK',
        updatedAt: new Date().toISOString(),
      },
      assessmentPlan: {
        id: 'plan-port-invalid',
        academicSettingId: 'setting-1',
        title: 'Rencana Portofolio',
        workflowStatus: 'SIAP',
        purpose: 'SUMMATIVE',
        timing: 'POST',
        scopeType: 'TP',
        tpIds: [],
        criterionIds: [],
        instruments: [{ id: 'inst-port-invalid-2', type: 'PORTFOLIO', label: 'Portofolio' }],
        createdAt: '',
        updatedAt: '',
      },
    });

    assert.strictEqual(result.valid, false, 'Portfolio with undefined evidence requirements must be invalid');
    const hasEvidenceError = result.errors.some((e) =>
      e.includes('persyaratan bukti')
    );
    assert.strictEqual(
      hasEvidenceError,
      true,
      'validateAssessmentPackage must fail when portfolio evidenceRequirements is undefined'
    );
  });

  // ----------------------------------------------------
  // TEST 9 — DOCX & PDF STRING / MODEL ASSERTIONS
  // ----------------------------------------------------
  test('TEST 9: DOCX & PDF renderers include performance weight, rubric weight, and expectedProduct', () => {
    const exportServicePath = path.resolve('src/services/documentEngine/assessmentExportService.ts');
    const source = fs.readFileSync(exportServicePath, 'utf8');

    // Performance weight rendered if present in DOCX
    assert(
      source.includes('asp.weight !== undefined') &&
      source.includes('— Bobot: ${asp.weight}'),
      'DOCX and PDF must render performance aspect weight when defined'
    );

    // Rubric weight rendered if present in DOCX and PDF
    assert(
      source.includes('c.weight !== undefined ? `${c.label} — Bobot: ${c.weight}` : c.label'),
      'DOCX and PDF must render rubric criterion weight when defined'
    );

    // expectedProduct rendered if present in DOCX and PDF
    assert(
      source.includes('Produk / Hasil yang Diharapkan:'),
      'DOCX and PDF must render expectedProduct when defined'
    );
  });

  // ----------------------------------------------------
  // TEST 10 — PRODUCT EXPORT SOURCE GUARD
  // ----------------------------------------------------
  test('TEST 10: Export service contains rendering branches for inst.expectedProduct in DOCX and PDF', () => {
    const exportServicePath = path.resolve('src/services/documentEngine/assessmentExportService.ts');
    const source = fs.readFileSync(exportServicePath, 'utf8');

    const matches = source.match(/inst\.expectedProduct/g) || [];
    assert(
      matches.length >= 2,
      `Expected at least 2 references to inst.expectedProduct in export service, found ${matches.length}`
    );
  });

  // ----------------------------------------------------
  // TEST 11 — NO FAKE VALUES
  // ----------------------------------------------------
  test('TEST 11: No fallback to taskPrompt when expectedDeliverable is absent', () => {
    const generatorServicePath = path.resolve('src/services/assessmentPackageGeneratorService.ts');
    const source = fs.readFileSync(generatorServicePath, 'utf8');

    // Source guard: must not assign expected deliverable fields from taskPrompt
    assert(
      !source.includes('expectedDeliverable || taskPrompt'),
      'Generator service must not fall back to taskPrompt for expected deliverables'
    );
    assert(
      !source.includes('expectedOutput = taskUnit.taskPrompt'),
      'expectedOutput must not be populated with taskPrompt'
    );
    assert(
      !source.includes('expectedProduct = taskUnit.taskPrompt'),
      'expectedProduct must not be populated with taskPrompt'
    );

    // Behavioral test: when expectedDeliverable is undefined, instruments must keep them undefined
    const contract = createContract([
      {
        coverageUnitId: 'cov-prod-empty',
        allocationUnit: 'TASK',
        instrumentType: 'PRODUCT',
        objectiveRefId: 'tp-1',
        objectiveText: 'Memahami PJOK',
        requiredCount: 1,
      },
    ]);

    const rawAI = JSON.stringify({
      units: [
        {
          coverageUnitId: 'cov-prod-empty',
          taskTitle: 'Produk Tanpa Output Spesifik',
          taskPrompt: 'Buat prototipe fungsional.',
        },
      ],
    });

    const parsed = parseAndValidateRawAIResponse(rawAI, contract);
    const pkg = mapGeneratedUnitsToAssessmentPackage(parsed.validatedUnits, contract, basePlan);
    const inst = pkg.instruments[0] as ProductAssessmentInstrument;
    assert.strictEqual(inst.expectedProduct, undefined, 'expectedProduct must remain undefined when AI did not generate expectedDeliverable');
  });

  console.log(`\nRegression results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
