import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  AcademicSetting,
  AssessmentAIGenerationProvider,
  AssessmentAIGenerationRawResponse,
  AssessmentAIGenerationRequest,
  AssessmentCriterion,
  AssessmentGenerationContract,
  AssessmentGenerationPlan,
  AssessmentPlan,
  TPData,
} from '../src/types';
import { AssessmentDocumentSnapshot } from '../src/types/assessmentExport';
import {
  mapInstrumentToAllocationUnit,
  resolveAssessmentGenerationPlan,
} from '../src/services/assessmentGenerationPlanService';
import { resolveAssessmentGenerationSpec } from '../src/services/assessmentGenerationSpecService';
import {
  buildGenerationContract,
  buildGenerationPrompts,
  generateAssessmentPackageDraft,
  parseAndValidateRawAIResponse,
} from '../src/services/assessmentPackageGeneratorService';
import { validateAssessmentCoverage } from '../src/services/assessmentCoverageValidationService';
import { buildNormalizedAssessmentDocumentModel } from '../src/services/documentEngine/assessmentExportService';

class MockAIProvider implements AssessmentAIGenerationProvider {
  public callCount = 0;
  public lastRequest?: AssessmentAIGenerationRequest;
  private responseGenerator: (req: AssessmentAIGenerationRequest) => string;

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

async function runTestSuite() {
  console.log('=== RUNNING B.1.3 SELF & PEER ASSESSMENT FOUNDATION REGRESSION SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      const res = fn();
      if (res && typeof (res as any).then === 'function') {
        return (res as any).then(
          () => {
            console.log(`[PASS] ${name}`);
            passed++;
          },
          (err: any) => {
            console.error(`[FAIL] ${name}`);
            console.error(`       Error: ${err?.message || err}`);
            failed++;
          }
        );
      }
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] ${name}`);
      console.error(`       Error: ${err?.message || err}`);
      failed++;
    }
  }

  // Baseline Academic Setting & TP & Criteria
  const mockAcademicSetting: AcademicSetting = {
    id: 'setting-sd-4',
    profileId: 'prof-1',
    curriculum: 'Kurikulum Merdeka',
    curriculumType: 'KURIKULUM_MERDEKA',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    level: 'SD',
    grade: 'Kelas 4',
    phase: 'Fase B',
    subject: 'Pendidikan Pancasila',
    updatedAt: new Date().toISOString(),
  };

  const mockTP: TPData = {
    id: 'tp-data-1',
    academicSettingId: 'setting-sd-4',
    workflowStatus: 'SIAP',
    needsReview: false,
    items: [
      {
        id: 'tp-1',
        code: 'TP-1',
        tp: 'Menunjukkan sikap kerja sama dan musyawarah di lingkungan sekolah',
        order: 1,
      } as any,
    ],
    updatedAt: new Date().toISOString(),
  };

  const mockCriteria: AssessmentCriterion[] = [
    {
      id: 'crit-1',
      academicSettingId: 'setting-sd-4',
      tpId: 'tp-1',
      description: 'Peserta didik mampu berpartisipasi aktif dalam kegiatan gotong royong dan refleksi diri',
      approach: 'deskripsi',
      indicators: ['Menilai keterlibatan diri sendiri dan rekan kelompok'],
      levels: [],
      workflowStatus: 'SIAP',
      needsReview: false,
      updatedAt: new Date().toISOString(),
    },
  ];

  // ----------------------------------------------------
  // TEST A1 — PLAN CONTRACT TETAP ITEM
  // ----------------------------------------------------
  test('A1: Plan contract maintains ITEM allocation for SELF_ASSESSMENT and PEER_ASSESSMENT', () => {
    assert.strictEqual(
      mapInstrumentToAllocationUnit('SELF_ASSESSMENT'),
      'ITEM',
      'SELF_ASSESSMENT must remain ITEM allocation'
    );
    assert.strictEqual(
      mapInstrumentToAllocationUnit('PEER_ASSESSMENT'),
      'ITEM',
      'PEER_ASSESSMENT must remain ITEM allocation'
    );
  });

  // ----------------------------------------------------
  // TEST A2 — GENERATION PROMPT EXPLICIT SELF/PEER CONTRACT
  // ----------------------------------------------------
  test('A2: Generation prompt explicitly defines SELF/PEER semantic contract', () => {
    const promptPlan: AssessmentPlan = {
      id: 'plan-prompt-1',
      academicSettingId: 'setting-sd-4',
      title: 'Asesmen Prompt Test',
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-1'],
      criterionIds: ['crit-1'],
      instruments: [
        { id: 'inst-s', type: 'SELF_ASSESSMENT', label: 'Diri' },
        { id: 'inst-p', type: 'PEER_ASSESSMENT', label: 'Teman' },
      ],
      workflowStatus: 'SIAP',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: mockAcademicSetting,
      assessmentPlan: promptPlan,
      tp: mockTP,
      assessmentCriteria: mockCriteria,
    });

    const plan = resolveAssessmentGenerationPlan({
      generationSpec: spec,
    });

    const contract = buildGenerationContract(plan);
    const { systemPrompt } = buildGenerationPrompts(contract);

    assert(
      systemPrompt.includes('SELF_ASSESSMENT'),
      'System prompt must explicitly mention SELF_ASSESSMENT'
    );
    assert(
      systemPrompt.includes('PEER_ASSESSMENT'),
      'System prompt must explicitly mention PEER_ASSESSMENT'
    );
    assert(
      systemPrompt.includes('SHORT_ANSWER'),
      'System prompt must explicitly require SHORT_ANSWER as transport itemType'
    );
    assert(
      systemPrompt.includes('prompt'),
      'System prompt must mention prompt field'
    );
    assert(
      systemPrompt.includes('pernyataan') || systemPrompt.includes('statement'),
      'System prompt must mention statement / pernyataan for self/peer'
    );
  });

  // ----------------------------------------------------
  // TEST A3 — SELF GENERATION → PACKAGE
  // ----------------------------------------------------
  await test('A3: AI generation creates canonical SELF_ASSESSMENT instrument and items from prompt', async () => {
    const selfPlan: AssessmentPlan = {
      id: 'plan-self-1',
      academicSettingId: 'setting-sd-4',
      title: 'Asesmen Penilaian Diri',
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-1'],
      criterionIds: ['crit-1'],
      instruments: [{ id: 'inst-self-def', type: 'SELF_ASSESSMENT', label: 'Penilaian Diri Murid' }],
      workflowStatus: 'SIAP',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: mockAcademicSetting,
      assessmentPlan: selfPlan,
      tp: mockTP,
      assessmentCriteria: mockCriteria,
    });

    const plan = resolveAssessmentGenerationPlan({
      generationSpec: spec,
    });

    const targetCuId = plan.coverageUnits[0].id;

    const selfProvider = new MockAIProvider(() =>
      JSON.stringify([
        {
          coverageUnitId: targetCuId,
          itemType: 'SHORT_ANSWER',
          prompt: 'Saya dapat menjelaskan bagian yang sudah saya kuasai.',
        },
      ])
    );

    const result = await generateAssessmentPackageDraft({
      generationPlan: plan,
      provider: selfProvider,
    });

    assert.strictEqual(result.status, 'GENERATED', 'Generation status must be GENERATED');
    assert(result.generatedPackage, 'Package must be generated');

    const selfInstruments = result.generatedPackage.instruments.filter((i) => i.type === 'SELF_ASSESSMENT');
    assert.strictEqual(selfInstruments.length, 1, 'Package must contain exactly one SELF_ASSESSMENT instrument');

    const selfInst = selfInstruments[0] as any;
    assert.strictEqual(selfInst.items.length, 1, 'SELF_ASSESSMENT instrument must have exactly 1 item');
    assert.strictEqual(
      selfInst.items[0].statement,
      'Saya dapat menjelaskan bagian yang sudah saya kuasai.',
      'Item statement must match prompt exactly'
    );
  });

  // ----------------------------------------------------
  // TEST A4 — PEER GENERATION → PACKAGE
  // ----------------------------------------------------
  await test('A4: AI generation creates canonical PEER_ASSESSMENT instrument and items from prompt', async () => {
    const peerPlan: AssessmentPlan = {
      id: 'plan-peer-1',
      academicSettingId: 'setting-sd-4',
      title: 'Asesmen Penilaian Antar-Teman',
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-1'],
      criterionIds: ['crit-1'],
      instruments: [{ id: 'inst-peer-def', type: 'PEER_ASSESSMENT', label: 'Penilaian Teman Sebaya' }],
      workflowStatus: 'SIAP',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: mockAcademicSetting,
      assessmentPlan: peerPlan,
      tp: mockTP,
      assessmentCriteria: mockCriteria,
    });

    const plan = resolveAssessmentGenerationPlan({
      generationSpec: spec,
    });

    const targetCuId = plan.coverageUnits[0].id;

    const peerProvider = new MockAIProvider(() =>
      JSON.stringify([
        {
          coverageUnitId: targetCuId,
          itemType: 'SHORT_ANSWER',
          prompt: 'Teman saya bekerja sama secara aktif dalam kelompok.',
        },
      ])
    );

    const result = await generateAssessmentPackageDraft({
      generationPlan: plan,
      provider: peerProvider,
    });

    assert.strictEqual(result.status, 'GENERATED', 'Generation status must be GENERATED');
    assert(result.generatedPackage, 'Package must be generated');

    const peerInstruments = result.generatedPackage.instruments.filter((i) => i.type === 'PEER_ASSESSMENT');
    assert.strictEqual(peerInstruments.length, 1, 'Package must contain exactly one PEER_ASSESSMENT instrument');

    const peerInst = peerInstruments[0] as any;
    assert.strictEqual(peerInst.items.length, 1, 'PEER_ASSESSMENT instrument must have exactly 1 item');
    assert.strictEqual(
      peerInst.items[0].statement,
      'Teman saya bekerja sama secara aktif dalam kelompok.',
      'Item statement must match prompt exactly'
    );
  });

  // ----------------------------------------------------
  // TEST A5 — NO ANSWER KEY
  // ----------------------------------------------------
  await test('A5: SELF and PEER assessment items never generate answer keys even if AI proposed answer', async () => {
    const hybridPlan: AssessmentPlan = {
      id: 'plan-hybrid-1',
      academicSettingId: 'setting-sd-4',
      title: 'Asesmen Campuran Refleksi',
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-1'],
      criterionIds: ['crit-1'],
      instruments: [
        { id: 'inst-s', type: 'SELF_ASSESSMENT', label: 'Diri' },
        { id: 'inst-p', type: 'PEER_ASSESSMENT', label: 'Teman' },
      ],
      workflowStatus: 'SIAP',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: mockAcademicSetting,
      assessmentPlan: hybridPlan,
      tp: mockTP,
      assessmentCriteria: mockCriteria,
    });

    const plan = resolveAssessmentGenerationPlan({
      generationSpec: spec,
    });

    const selfCu = plan.coverageUnits.find((u) => u.instrumentType === 'SELF_ASSESSMENT')!;
    const peerCu = plan.coverageUnits.find((u) => u.instrumentType === 'PEER_ASSESSMENT')!;

    const providerWithAnswers = new MockAIProvider(() =>
      JSON.stringify([
        {
          coverageUnitId: selfCu.id,
          itemType: 'SHORT_ANSWER',
          prompt: 'Pernyataan refleksi diri.',
          proposedAnswer: {
            answerType: 'EXACT',
            value: 'Kunci jawaban salah yang tidak boleh masuk',
            explanation: 'Penjelasan yang tidak boleh menjadi answer key',
          },
        },
        {
          coverageUnitId: peerCu.id,
          itemType: 'SHORT_ANSWER',
          prompt: 'Pernyataan penilaian teman.',
          proposedAnswer: {
            answerType: 'EXACT',
            value: 'Kunci jawaban tidak boleh untuk peer assessment',
          },
        },
      ])
    );

    const result = await generateAssessmentPackageDraft({
      generationPlan: plan,
      provider: providerWithAnswers,
    });

    assert.strictEqual(result.status, 'GENERATED');
    assert(result.generatedPackage);
    assert.strictEqual(
      result.generatedPackage.answerKeys.length,
      0,
      'No answer keys should be generated for SELF_ASSESSMENT or PEER_ASSESSMENT'
    );
  });

  // ----------------------------------------------------
  // TEST A6 — DETERMINISTIC ITEM LINKAGE
  // ----------------------------------------------------
  await test('A6: Blueprint maintains deterministic linkage to generated SELF and PEER items', async () => {
    const planSetup: AssessmentPlan = {
      id: 'plan-linkage-1',
      academicSettingId: 'setting-sd-4',
      title: 'Asesmen Linkage',
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-1'],
      criterionIds: ['crit-1'],
      instruments: [
        { id: 'inst-s', type: 'SELF_ASSESSMENT', label: 'Diri' },
        { id: 'inst-p', type: 'PEER_ASSESSMENT', label: 'Teman' },
      ],
      workflowStatus: 'SIAP',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: mockAcademicSetting,
      assessmentPlan: planSetup,
      tp: mockTP,
      assessmentCriteria: mockCriteria,
    });

    const plan = resolveAssessmentGenerationPlan({
      generationSpec: spec,
    });

    const selfCu = plan.coverageUnits.find((u) => u.instrumentType === 'SELF_ASSESSMENT')!;
    const peerCu = plan.coverageUnits.find((u) => u.instrumentType === 'PEER_ASSESSMENT')!;

    const provider = new MockAIProvider(() =>
      JSON.stringify([
        {
          coverageUnitId: selfCu.id,
          itemType: 'SHORT_ANSWER',
          prompt: 'Pernyataan refleksi 1.',
        },
        {
          coverageUnitId: peerCu.id,
          itemType: 'SHORT_ANSWER',
          prompt: 'Pernyataan teman 1.',
        },
      ])
    );

    const result = await generateAssessmentPackageDraft({
      generationPlan: plan,
      provider,
    });

    assert(result.generatedPackage);
    const pkg = result.generatedPackage;

    const selfInst = pkg.instruments.find((i) => i.type === 'SELF_ASSESSMENT') as any;
    const peerInst = pkg.instruments.find((i) => i.type === 'PEER_ASSESSMENT') as any;

    const selfBp = pkg.blueprintItems.find((bp) => bp.coverageUnitId === selfCu.id);
    const peerBp = pkg.blueprintItems.find((bp) => bp.coverageUnitId === peerCu.id);

    assert(selfBp, 'Blueprint item for SELF_ASSESSMENT must exist');
    assert(peerBp, 'Blueprint item for PEER_ASSESSMENT must exist');

    assert.strictEqual(
      selfBp.instrumentId,
      selfInst.id,
      'Self blueprint instrumentId must match generated instrument ID'
    );
    assert.deepStrictEqual(
      selfBp.instrumentItemIds,
      [selfInst.items[0].id],
      'Self blueprint instrumentItemIds must match exact item ID'
    );

    assert.strictEqual(
      peerBp.instrumentId,
      peerInst.id,
      'Peer blueprint instrumentId must match generated instrument ID'
    );
    assert.deepStrictEqual(
      peerBp.instrumentItemIds,
      [peerInst.items[0].id],
      'Peer blueprint instrumentItemIds must match exact item ID'
    );
  });

  // ----------------------------------------------------
  // TEST A7 — COVERAGE VALIDATION
  // ----------------------------------------------------
  await test('A7: Coverage validator recognizes SELF and PEER ITEM allocations without false positive errors', async () => {
    const planSetup: AssessmentPlan = {
      id: 'plan-cov-1',
      academicSettingId: 'setting-sd-4',
      title: 'Asesmen Coverage Test',
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-1'],
      criterionIds: ['crit-1'],
      instruments: [
        { id: 'inst-s', type: 'SELF_ASSESSMENT', label: 'Diri' },
        { id: 'inst-p', type: 'PEER_ASSESSMENT', label: 'Teman' },
      ],
      workflowStatus: 'SIAP',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: mockAcademicSetting,
      assessmentPlan: planSetup,
      tp: mockTP,
      assessmentCriteria: mockCriteria,
    });

    const plan = resolveAssessmentGenerationPlan({
      generationSpec: spec,
    });

    const selfCu = plan.coverageUnits.find((u) => u.instrumentType === 'SELF_ASSESSMENT')!;
    const peerCu = plan.coverageUnits.find((u) => u.instrumentType === 'PEER_ASSESSMENT')!;

    const provider = new MockAIProvider(() =>
      JSON.stringify([
        {
          coverageUnitId: selfCu.id,
          itemType: 'SHORT_ANSWER',
          prompt: 'Pernyataan refleksi cakupan.',
        },
        {
          coverageUnitId: peerCu.id,
          itemType: 'SHORT_ANSWER',
          prompt: 'Pernyataan penilaian teman cakupan.',
        },
      ])
    );

    const genResult = await generateAssessmentPackageDraft({
      generationPlan: plan,
      provider,
    });

    assert(genResult.generatedPackage);
    const coverageSection = validateAssessmentCoverage(genResult.generatedPackage, plan);

    const hasSemanticsMismatch = coverageSection.findings.some(
      (f) => f.code === 'ALLOCATION_SEMANTICS_MISMATCH'
    );
    assert.strictEqual(
      hasSemanticsMismatch,
      false,
      'Coverage validation must not report ALLOCATION_SEMANTICS_MISMATCH for SELF/PEER'
    );

    const hasCountMismatch = coverageSection.findings.some(
      (f) => f.code === 'COVERAGE_COUNT_MISMATCH'
    );
    assert.strictEqual(
      hasCountMismatch,
      false,
      'Coverage validation must match exact item count'
    );

    const hasUnresolvedCount = coverageSection.findings.some(
      (f) => f.code === 'COVERAGE_COUNT_UNRESOLVED'
    );
    assert.strictEqual(
      hasUnresolvedCount,
      false,
      'Coverage validation must deterministically resolve item count'
    );
  });

  // ----------------------------------------------------
  // TEST A8 — NORMALIZED MODEL
  // ----------------------------------------------------
  test('A8: Normalized assessment model preserves selfPeerItems statements and omits fake category', () => {
    const snapshotFixture: AssessmentDocumentSnapshot = {
      snapshotId: 'snap-norm-self-peer',
      mode: 'CANONICAL_PACKAGE',
      documentType: 'ASESMEN',
      documentDate: '2026-09-24',
      formattedDocumentDate: 'Jakarta, 24 September 2026',
      schoolName: 'SD Maju Bangsa',
      npsn: '12345678',
      schoolAddress: 'Jl. Merdeka No. 1',
      curriculum: 'Kurikulum Merdeka',
      subject: 'Pendidikan Pancasila',
      grade: 'Kelas 4',
      phase: 'Fase B',
      academicYear: '2025/2026',
      semester: '1 (Ganjil)',
      teacherName: 'Budi Santoso, S.Pd.',
      teacherNip: '198501012010011001',
      principalName: 'Siti Aminah, M.Pd.',
      principalNip: '197501012000012001',
      assessmentPackageId: 'pkg-norm-1',
      assessmentPackageRevision: 1,
      packageTitle: 'Paket Evaluasi Diri',
      blueprintItems: [],
      instruments: [
        {
          id: 'inst-self',
          type: 'SELF_ASSESSMENT',
          title: 'Instrumen Penilaian Diri',
          items: [
            {
              id: 'item-s-1',
              statement: 'Saya memahami konsep musyawarah dengan baik.',
            },
          ],
        },
        {
          id: 'inst-peer',
          type: 'PEER_ASSESSMENT',
          title: 'Instrumen Penilaian Antar-Teman',
          items: [
            {
              id: 'item-p-1',
              statement: 'Teman saya menghargai pendapat orang lain.',
              category: 'Sikap Sosial',
            },
          ],
        },
      ],
      answerKeys: [],
      scoringGuides: [],
      rubrics: [],
      resolvedObjectives: {},
      documentMode: 'data',
      generatedAt: new Date().toISOString(),
    };

    const model = buildNormalizedAssessmentDocumentModel(snapshotFixture);

    assert.strictEqual(model.instruments.list.length, 2, 'Model must have 2 instruments');

    const selfNorm = model.instruments.list.find((i) => i.type === 'SELF_ASSESSMENT');
    assert(selfNorm, 'Normalized SELF_ASSESSMENT must be present');
    assert(selfNorm.selfPeerItems, 'selfPeerItems must be populated');
    assert.strictEqual(selfNorm.selfPeerItems.length, 1);
    assert.strictEqual(selfNorm.selfPeerItems[0].statement, 'Saya memahami konsep musyawarah dengan baik.');
    assert.strictEqual(selfNorm.selfPeerItems[0].category, undefined, 'Undefined category must remain undefined');

    const peerNorm = model.instruments.list.find((i) => i.type === 'PEER_ASSESSMENT');
    assert(peerNorm, 'Normalized PEER_ASSESSMENT must be present');
    assert(peerNorm.selfPeerItems, 'selfPeerItems must be populated');
    assert.strictEqual(peerNorm.selfPeerItems.length, 1);
    assert.strictEqual(peerNorm.selfPeerItems[0].statement, 'Teman saya menghargai pendapat orang lain.');
    assert.strictEqual(peerNorm.selfPeerItems[0].category, 'Sikap Sosial', 'Category must be preserved if provided');
  });

  // ----------------------------------------------------
  // TEST A9 — EXPORT RENDERER SOURCE GUARD
  // ----------------------------------------------------
  test('A9: Export service source guard verifies DOCX and PDF render branches for SELF and PEER', () => {
    const exportServicePath = path.resolve('src/services/documentEngine/assessmentExportService.ts');
    const source = fs.readFileSync(exportServicePath, 'utf8');

    // DOCX rendering verification
    assert(
      source.includes("inst.type === 'SELF_ASSESSMENT' || inst.type === 'PEER_ASSESSMENT'") &&
      source.includes('inst.selfPeerItems'),
      'Export service must contain DOCX renderer branch for SELF_ASSESSMENT/PEER_ASSESSMENT with selfPeerItems'
    );

    // PDF rendering verification
    const countOccurrences = (source.match(/inst\.type === 'SELF_ASSESSMENT' \|\| inst\.type === 'PEER_ASSESSMENT'/g) || []).length;
    assert(
      countOccurrences >= 2,
      'Export service must handle SELF/PEER rendering in both DOCX and PDF sections'
    );
  });

  // ----------------------------------------------------
  // TEST A10 — SELF WRONG ITEM TYPE REJECTED
  // ----------------------------------------------------
  test('A10: SELF_ASSESSMENT with MULTIPLE_CHOICE itemType is rejected with INVALID_SELF_PEER_ITEM_TYPE', () => {
    const selfPlan: AssessmentPlan = {
      id: 'plan-self-a10',
      academicSettingId: 'setting-sd-4',
      title: 'Asesmen Diri A10',
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-1'],
      criterionIds: ['crit-1'],
      instruments: [{ id: 'inst-self-a10', type: 'SELF_ASSESSMENT', label: 'Penilaian Diri' }],
      workflowStatus: 'SIAP',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: mockAcademicSetting,
      assessmentPlan: selfPlan,
      tp: mockTP,
      assessmentCriteria: mockCriteria,
    });

    const plan = resolveAssessmentGenerationPlan({
      generationSpec: spec,
    });

    const contract = buildGenerationContract(plan);
    const selfCuId = contract.units[0].coverageUnitId;

    const rawResponse = JSON.stringify([
      {
        coverageUnitId: selfCuId,
        itemType: 'MULTIPLE_CHOICE',
        prompt: 'Manakah perilaku yang paling tepat?',
        options: [{ text: 'A' }, { text: 'B' }],
      },
    ]);

    const result = parseAndValidateRawAIResponse(rawResponse, contract);

    assert.strictEqual(result.validatedUnits.length, 0, 'No units should be validated for invalid itemType');
    assert(result.failedCoverageUnitIds.includes(selfCuId), 'failedCoverageUnitIds must include the self coverage unit ID');
    assert(
      result.issues.some((issue) => issue.code === 'INVALID_SELF_PEER_ITEM_TYPE'),
      'Must record INVALID_SELF_PEER_ITEM_TYPE issue'
    );
  });

  // ----------------------------------------------------
  // TEST A11 — PEER WRONG ITEM TYPE REJECTED
  // ----------------------------------------------------
  test('A11: PEER_ASSESSMENT with ESSAY itemType is rejected with INVALID_SELF_PEER_ITEM_TYPE', () => {
    const peerPlan: AssessmentPlan = {
      id: 'plan-peer-a11',
      academicSettingId: 'setting-sd-4',
      title: 'Asesmen Teman A11',
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-1'],
      criterionIds: ['crit-1'],
      instruments: [{ id: 'inst-peer-a11', type: 'PEER_ASSESSMENT', label: 'Penilaian Teman' }],
      workflowStatus: 'SIAP',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: mockAcademicSetting,
      assessmentPlan: peerPlan,
      tp: mockTP,
      assessmentCriteria: mockCriteria,
    });

    const plan = resolveAssessmentGenerationPlan({
      generationSpec: spec,
    });

    const contract = buildGenerationContract(plan);
    const peerCuId = contract.units[0].coverageUnitId;

    const rawResponse = JSON.stringify([
      {
        coverageUnitId: peerCuId,
        itemType: 'ESSAY',
        prompt: 'Jelaskan kualitas temanmu.',
      },
    ]);

    const result = parseAndValidateRawAIResponse(rawResponse, contract);

    assert.strictEqual(result.validatedUnits.length, 0, 'No units should be validated for invalid itemType');
    assert(result.failedCoverageUnitIds.includes(peerCuId), 'failedCoverageUnitIds must include peer coverage unit ID');
    assert(
      result.issues.some((issue) => issue.code === 'INVALID_SELF_PEER_ITEM_TYPE'),
      'Must record INVALID_SELF_PEER_ITEM_TYPE issue'
    );
  });

  // ----------------------------------------------------
  // TEST A12 — SELF MISSING ITEM TYPE REJECTED
  // ----------------------------------------------------
  test('A12: SELF_ASSESSMENT with missing itemType is rejected with INVALID_SELF_PEER_ITEM_TYPE without fallback', () => {
    const selfPlan: AssessmentPlan = {
      id: 'plan-self-a12',
      academicSettingId: 'setting-sd-4',
      title: 'Asesmen Diri A12',
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-1'],
      criterionIds: ['crit-1'],
      instruments: [{ id: 'inst-self-a12', type: 'SELF_ASSESSMENT', label: 'Penilaian Diri' }],
      workflowStatus: 'SIAP',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: mockAcademicSetting,
      assessmentPlan: selfPlan,
      tp: mockTP,
      assessmentCriteria: mockCriteria,
    });

    const plan = resolveAssessmentGenerationPlan({
      generationSpec: spec,
    });

    const contract = buildGenerationContract(plan);
    const selfCuId = contract.units[0].coverageUnitId;

    const rawResponse = JSON.stringify([
      {
        coverageUnitId: selfCuId,
        prompt: 'Saya berpartisipasi aktif dalam diskusi kelompok.',
      },
    ]);

    const result = parseAndValidateRawAIResponse(rawResponse, contract);

    assert.strictEqual(result.validatedUnits.length, 0, 'No units should be validated when itemType is missing');
    assert(result.failedCoverageUnitIds.includes(selfCuId), 'failedCoverageUnitIds must include self coverage unit ID');
    assert(
      result.issues.some((issue) => issue.code === 'INVALID_SELF_PEER_ITEM_TYPE'),
      'Must record INVALID_SELF_PEER_ITEM_TYPE issue'
    );
  });

  // ----------------------------------------------------
  // TEST A13 — PEER MISSING ITEM TYPE REJECTED
  // ----------------------------------------------------
  test('A13: PEER_ASSESSMENT with missing itemType is rejected with INVALID_SELF_PEER_ITEM_TYPE without fallback', () => {
    const peerPlan: AssessmentPlan = {
      id: 'plan-peer-a13',
      academicSettingId: 'setting-sd-4',
      title: 'Asesmen Teman A13',
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-1'],
      criterionIds: ['crit-1'],
      instruments: [{ id: 'inst-peer-a13', type: 'PEER_ASSESSMENT', label: 'Penilaian Teman' }],
      workflowStatus: 'SIAP',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: mockAcademicSetting,
      assessmentPlan: peerPlan,
      tp: mockTP,
      assessmentCriteria: mockCriteria,
    });

    const plan = resolveAssessmentGenerationPlan({
      generationSpec: spec,
    });

    const contract = buildGenerationContract(plan);
    const peerCuId = contract.units[0].coverageUnitId;

    const rawResponse = JSON.stringify([
      {
        coverageUnitId: peerCuId,
        prompt: 'Teman saya menghargai pendapat anggota kelompok.',
      },
    ]);

    const result = parseAndValidateRawAIResponse(rawResponse, contract);

    assert.strictEqual(result.validatedUnits.length, 0, 'No units should be validated when itemType is missing');
    assert(result.failedCoverageUnitIds.includes(peerCuId), 'failedCoverageUnitIds must include peer coverage unit ID');
    assert(
      result.issues.some((issue) => issue.code === 'INVALID_SELF_PEER_ITEM_TYPE'),
      'Must record INVALID_SELF_PEER_ITEM_TYPE issue'
    );
  });

  // ----------------------------------------------------
  // TEST A14 — VALID SELF/PEER TETAP LOLOS
  // ----------------------------------------------------
  test('A14: Direct parser assertion: SELF and PEER with SHORT_ANSWER are successfully validated', () => {
    const hybridPlan: AssessmentPlan = {
      id: 'plan-hybrid-a14',
      academicSettingId: 'setting-sd-4',
      title: 'Asesmen Hybrid A14',
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
      tpIds: ['tp-1'],
      criterionIds: ['crit-1'],
      instruments: [
        { id: 'inst-s-a14', type: 'SELF_ASSESSMENT', label: 'Diri' },
        { id: 'inst-p-a14', type: 'PEER_ASSESSMENT', label: 'Teman' },
      ],
      workflowStatus: 'SIAP',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const spec = resolveAssessmentGenerationSpec({
      academicSetting: mockAcademicSetting,
      assessmentPlan: hybridPlan,
      tp: mockTP,
      assessmentCriteria: mockCriteria,
    });

    const plan = resolveAssessmentGenerationPlan({
      generationSpec: spec,
    });

    const contract = buildGenerationContract(plan);
    const selfCu = contract.units.find((u) => u.instrumentType === 'SELF_ASSESSMENT')!;
    const peerCu = contract.units.find((u) => u.instrumentType === 'PEER_ASSESSMENT')!;

    const rawResponse = JSON.stringify([
      {
        coverageUnitId: selfCu.coverageUnitId,
        itemType: 'SHORT_ANSWER',
        prompt: 'Saya memahami materi musyawarah.',
      },
      {
        coverageUnitId: peerCu.coverageUnitId,
        itemType: 'SHORT_ANSWER',
        prompt: 'Teman saya mendengarkan penjelasan.',
      },
    ]);

    const result = parseAndValidateRawAIResponse(rawResponse, contract);

    assert.strictEqual(result.validatedUnits.length, 2, 'Both units should be successfully validated');
    assert.strictEqual(result.failedCoverageUnitIds.length, 0, 'No failed coverage units');
    assert(
      !result.issues.some((issue) => issue.code === 'INVALID_SELF_PEER_ITEM_TYPE'),
      'No INVALID_SELF_PEER_ITEM_TYPE issue should be present'
    );
  });

  console.log(`\n==========================================`);
  console.log(`TOTAL PASSED: ${passed}`);
  console.log(`TOTAL FAILED: ${failed}`);
  console.log(`==========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
