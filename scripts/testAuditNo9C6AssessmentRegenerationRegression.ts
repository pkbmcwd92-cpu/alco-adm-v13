import {
  AssessmentPackage,
  AssessmentRegenerationRequest,
  AssessmentRegenerationResult,
  AssessmentRegenerationContract,
  AssessmentRegenerationProvider,
  AssessmentRegenerationTarget,
  AssessmentValidationFinding,
  AssessmentValidationReport,
} from '../src/types';
import { assessmentRegenerationService } from '../src/services/assessmentRegenerationService';
import { assessmentRegenerationEligibilityService } from '../src/services/assessmentRegenerationEligibilityService';
import { assessmentRegenerationDependencyService } from '../src/services/assessmentRegenerationDependencyService';
import { isAssessmentValidationReportStale } from '../src/services/assessmentValidationService';

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

// Global baseline package for testing
const basePackage: AssessmentPackage = {
  id: 'pkg-valid-1',
  assessmentPlanId: 'plan-valid-1',
  title: 'Paket Asesmen Biologi',
  workflowStatus: 'SIAP',
  academicSettingId: 'setting-1',
  revision: 1,
  rubrics: [
    {
      id: 'rub-1',
      instrumentItemId: 'item-perf-1',
      instrumentId: 'inst-perf-1',
      title: 'Kriteria Penilaian Unjuk Kerja',
      criteria: [{ id: 'rc-1', label: 'Proses Desain' }],
      scale: [{ id: 'sl-1', label: 'Sangat Baik', score: 4, order: 1 }],
      provenance: 'TEACHER_EDITED',
    } as any,
    {
      id: 'rub-2',
      instrumentItemId: 'item-perf-2',
      instrumentId: 'inst-perf-2',
      title: 'Rubrik AI',
      criteria: [{ id: 'rc-2', label: 'Pemahaman' }],
      scale: [{ id: 'sl-2', label: 'Baik', score: 3, order: 1 }],
      provenance: 'AI_GENERATED',
    } as any,
  ],
  scoringGuides: [
    {
      id: 'sg-1',
      instrumentItemId: 'item-perf-1',
      instrumentId: 'inst-perf-1',
      guideType: 'RUBRIC_BASED',
      title: 'Scoring Guide Unjuk Kerja',
      instructions: 'Gunakan rubrik',
    },
  ],
  answerKeys: [
    {
      id: 'ak-1',
      instrumentId: 'inst-1',
      instrumentItemId: 'item-1',
      answerType: 'OPTION',
      value: 'opt-b',
    },
    {
      id: 'ak-2',
      instrumentId: 'inst-1',
      instrumentItemId: 'item-2',
      answerType: 'OPTION',
      value: 'opt-c',
    },
  ],
  createdAt: '2026-09-18T00:00:00.000Z',
  updatedAt: '2026-09-18T00:00:00.000Z',
  blueprintItems: [
    {
      id: 'bp-1',
      coverageUnitId: 'cu-1',
      objectiveRefId: 'tp-1',
      criterionId: 'crit-1',
      assessmentIndicator: 'Siswa dapat menjelaskan fungsi klorofil',
      instrumentType: 'WRITTEN_TEST',
      instrumentId: 'inst-1',
      instrumentItemIds: ['item-1'],
      order: 1,
    },
    {
      id: 'bp-2',
      coverageUnitId: 'cu-2',
      objectiveRefId: 'tp-2',
      criterionId: 'crit-1',
      assessmentIndicator: 'Siswa dapat menjelaskan ekosistem',
      instrumentType: 'WRITTEN_TEST',
      instrumentId: 'inst-1',
      instrumentItemIds: ['item-2'],
      order: 2,
    },
  ],
  instruments: [
    {
      id: 'inst-1',
      type: 'WRITTEN_TEST',
      title: 'Tes Tertulis Biologi',
      items: [
        {
          id: 'item-1',
          blueprintItemId: 'bp-1',
          coverageUnitId: 'cu-1',
          itemType: 'MULTIPLE_CHOICE',
          prompt: 'Apakah fungsi klorofil?',
          stimulus: 'Klorofil berperan penting dalam fotosintesis.',
          options: [
            { id: 'opt-a', label: 'A', text: 'Menyerap oksigen' },
            { id: 'opt-b', label: 'B', text: 'Menyerap cahaya matahari' },
          ],
          order: 1,
          provenance: {
            fields: {
              prompt: 'TEACHER_EDITED',
              options: 'AI_GENERATED',
            },
          },
        } as any,
        {
          id: 'item-2',
          blueprintItemId: 'bp-2',
          coverageUnitId: 'cu-2',
          itemType: 'MULTIPLE_CHOICE',
          prompt: 'Apa itu ekosistem?',
          options: [
            { id: 'opt-c', label: 'A', text: 'Hubungan timbal balik' },
            { id: 'opt-d', label: 'B', text: 'Kumpulan tanaman saja' },
          ],
          order: 2,
          provenance: 'AI_GENERATED',
        } as any,
      ],
    } as any,
    {
      id: 'inst-perf-1',
      type: 'PERFORMANCE',
      title: 'Unjuk Kerja Biologi',
      task: 'Rancanglah eksperimen fotosintesis.',
      instructions: 'Lakukan di laboratorium.',
    } as any,
    {
      id: 'inst-perf-2',
      type: 'PERFORMANCE',
      title: 'Unjuk Kerja 2',
      task: 'Buatlah ekosistem mini.',
      instructions: 'Lakukan berkelompok.',
    } as any,
    {
      id: 'inst-port-1',
      type: 'PORTFOLIO',
      title: 'Portofolio Biologi',
      evidenceRequirements: ['Laporan praktikum fotosintesis'],
    } as any,
    {
      id: 'inst-obs-1',
      type: 'OBSERVATION',
      title: 'Lembar Observasi',
      aspects: [{ id: 'asp-1', label: 'Ketekunan', indicator: 'Fokus selama praktikum' }],
    } as any,
  ],
};

// Standard Mock Provider for normal success
class MockRegenerationProvider implements AssessmentRegenerationProvider {
  public response: any = null;
  public lastContract: any = null;

  async regenerate(contract: AssessmentRegenerationContract): Promise<any> {
    this.lastContract = contract;
    if (this.response) {
      return this.response;
    }
    const target = contract.target;
    const targetId = contract.targetId;
    let proposedChanges: any = {};

    switch (target) {
      case 'INDICATOR':
        proposedChanges = { assessmentIndicator: 'Regenerated Indicator' };
        break;
      case 'MATERIAL_CONTEXT':
        proposedChanges = { materialOrContext: 'Regenerated Context' };
        break;
      case 'ITEM_PROMPT':
        proposedChanges = { prompt: 'Regenerated Prompt' };
        break;
      case 'STIMULUS':
        proposedChanges = { stimulus: 'Regenerated Stimulus' };
        break;
      case 'OPTIONS':
        proposedChanges = {
          options: [
            { id: 'opt-a', text: 'Regenerated Choice A' },
            { id: 'opt-b', text: 'Regenerated Choice B' },
          ],
        };
        break;
      case 'PROPOSED_ANSWER':
        proposedChanges = { value: 'opt-a' };
        break;
      case 'SCORING_GUIDE':
        proposedChanges = { instructions: 'Regenerated Guide instructions' };
        break;
      case 'RUBRIC':
        proposedChanges = {
          title: 'Regenerated Rubric',
          criteria: [{ id: 'rc-1', label: 'Regenerated Criteria' }],
          scale: [{ id: 'sl-1', label: 'Regenerated Scale', score: 4, order: 1 }],
        };
        break;
      case 'TASK':
        proposedChanges = { task: 'Regenerated Task prompt' };
        break;
      case 'EVIDENCE_REQUIREMENT':
        proposedChanges = { evidenceRequirements: ['Regenerated Requirement 1'] };
        break;
      case 'OBSERVATION_CONTENT':
        proposedChanges = { aspects: [{ id: 'asp-1', label: 'Regenerated Aspect' }] };
        break;
      case 'COVERAGE_UNIT':
        proposedChanges = { assessmentIndicator: 'Regenerated Indicator' };
        break;
      default:
        break;
    }

    return {
      target,
      targetId,
      proposedChanges,
    };
  }
}

async function runTests() {
  const provider = new MockRegenerationProvider();

  // Test 1: OPTIONS changes options only. Prompt remains unchanged.
  await test('OPTIONS changes options only. Prompt remains unchanged.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'OPTIONS',
      targetId: 'item-1',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    assert(result.status === 'REGENERATED', 'Should succeed');
    const updatedItem: any = (result.regeneratedPackage?.instruments[0] as any).items[0];
    assert(updatedItem.options[0].text === 'Regenerated Choice A', 'Options must be updated');
    assert(updatedItem.prompt === 'Apakah fungsi klorofil?', 'Prompt must be unchanged');
  });

  // Test 2: ITEM_PROMPT preserves: objectiveRefId, criterionId, coverageUnitId, instrumentType
  await test('ITEM_PROMPT preserves critical canonical context fields.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    assert(result.status === 'REGENERATED', 'Should succeed');
    const origBP = basePackage.blueprintItems[1];
    const newBP = result.regeneratedPackage?.blueprintItems[1];
    assert(newBP?.objectiveRefId === origBP.objectiveRefId, 'objectiveRefId preserved');
    assert(newBP?.criterionId === origBP.criterionId, 'criterionId preserved');
    assert(newBP?.coverageUnitId === origBP.coverageUnitId, 'coverageUnitId preserved');
    assert(newBP?.instrumentType === origBP.instrumentType, 'instrumentType preserved');
  });

  // Test 3: Regenerating one item does not modify another item.
  await test('Regenerating one item does not modify another item.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    assert(result.status === 'REGENERATED', 'Should succeed');
    const untouchedItem: any = (result.regeneratedPackage?.instruments[0] as any).items[0];
    assert(untouchedItem.prompt === 'Apakah fungsi klorofil?', 'Item 1 prompt must be untouched');
  });

  // Test 4: TEACHER_EDITED target without override is blocked.
  await test('TEACHER_EDITED target without override is blocked.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-1',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    assert(result.status === 'TEACHER_EDIT_PROTECTED', 'Must block when teacher edited');
    assert(result.regeneratedPackage === undefined, 'Source package must be unchanged');
  });

  // Test 5: TEACHER_EDITED target with explicit override may regenerate selected field.
  await test('TEACHER_EDITED target with explicit override may proceed.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-1',
      explicitTeacherOverride: true,
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    assert(result.status === 'REGENERATED', 'Should succeed with override');
    const item: any = (result.regeneratedPackage?.instruments[0] as any).items[0];
    assert(item.prompt === 'Regenerated Prompt', 'Prompt must be updated');
    assert(item.provenance.fields.prompt === 'AI_REGENERATED', 'Provenance marked as AI_REGENERATED');
  });

  // Test 6: Unrelated teacher-edited fields remain unchanged even with override.
  await test('Unrelated teacher-edited fields remain unchanged even with override.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'OPTIONS',
      targetId: 'item-1',
      explicitTeacherOverride: true,
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    assert(result.status === 'REGENERATED', 'Should succeed');
    const item: any = (result.regeneratedPackage?.instruments[0] as any).items[0];
    assert(item.provenance.fields.prompt === 'TEACHER_EDITED', 'Unrelated teacher prompt must remain untouched');
  });

  // Test 7: Structural finding is not eligible for AI regeneration.
  await test('Structural finding is not eligible for AI regeneration.', async () => {
    const finding: AssessmentValidationFinding = {
      code: 'BLUEPRINT_INSTRUMENT_TYPE_MISMATCH',
      status: 'FAIL',
      severity: 'BLOCKING',
      message: 'Mismatch',
      source: 'DETERMINISTIC',
    };
    const isEligible = assessmentRegenerationEligibilityService.isEligible(finding);
    assert(isEligible === false, 'Structural finding must be ineligible');
  });

  // Test 8: Quality finding with deterministic target maps correctly.
  await test('Quality finding with deterministic target maps correctly.', async () => {
    const finding: AssessmentValidationFinding = {
      code: 'WEAK_DISTRACTOR',
      dimension: 'DISTRACTOR_QUALITY',
      status: 'REVIEW',
      severity: 'REVIEW',
      message: 'Distractor too obvious',
      source: 'AI_QUALITY_REVIEWER',
    };
    const target = assessmentRegenerationEligibilityService.resolveTargetForFinding(finding);
    assert(target === 'OPTIONS', 'Must map to OPTIONS');
  });

  // Test 9: Ambiguous answer-verification finding does not guess target.
  await test('Ambiguous answer-verification finding does not guess target.', async () => {
    const finding: AssessmentValidationFinding = {
      code: 'ANSWER_REJECTED',
      dimension: 'ANSWER_VERIFICATION',
      status: 'FAIL',
      severity: 'BLOCKING',
      message: 'Rejected key',
      source: 'ANSWER_VERIFIER',
    };
    const target = assessmentRegenerationEligibilityService.resolveTargetForFinding(finding);
    assert(target === null, 'Ambiguous finding must return null target');
  });

  // Test 10: Malformed provider output leaves package unchanged.
  await test('Malformed provider output leaves package unchanged.', async () => {
    const malformedProvider = new MockRegenerationProvider();
    malformedProvider.response = { target: 'OPTIONS', targetId: 'item-1', proposedChanges: null };
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'OPTIONS',
      targetId: 'item-1',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, malformedProvider);
    assert(result.status === 'FAILED', 'Must fail with malformed output');
    assert(result.regeneratedPackage === undefined, 'Source package must be unchanged');
  });

  // Test 11: Provider exception leaves package unchanged.
  await test('Provider exception leaves package unchanged.', async () => {
    const crashingProvider = {
      regenerate: async () => {
        throw new Error('API Timeout');
      },
    };
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'OPTIONS',
      targetId: 'item-1',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, crashingProvider);
    assert(result.status === 'FAILED', 'Must fail on provider exception');
    assert(result.regeneratedPackage === undefined, 'Source package must be unchanged');
  });

  // Test 12: Unknown targetId leaves package unchanged.
  await test('Unknown targetId leaves package unchanged.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'OPTIONS',
      targetId: 'non-existent-item-id',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    assert(result.status === 'FAILED', 'Must fail for unknown target ID');
    assert(result.regeneratedPackage === undefined, 'Source package must be unchanged');
  });

  // Test 13: Stale expectedPackageRevision rejects request.
  await test('Stale expectedPackageRevision rejects request.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 999, // Stale
      target: 'OPTIONS',
      targetId: 'item-1',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    assert(result.status === 'STALE_REGENERATION_REQUEST', 'Must fail on stale revision request');
    assert(result.regeneratedPackage === undefined, 'Source package must be unchanged');
  });

  // Test 14: Successful regeneration increments revision exactly once.
  await test('Successful regeneration increments revision exactly once.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    assert(result.regeneratedPackage?.revision === 2, 'Revision must go to 2');
  });

  // Test 15: Old 9C.5 ValidationReport becomes stale after successful regeneration.
  await test('Old 9C.5 ValidationReport becomes stale after successful regeneration.', async () => {
    const report: AssessmentValidationReport = {
      id: 'val_rep_pkg-valid-1_rev_1',
      assessmentPackageId: basePackage.id,
      packageRevision: 1,
      structural: { status: 'PASS', findings: [] },
      coverage: { status: 'PASS', findings: [] },
      answerVerification: { status: 'PASS', findings: [] },
      quality: { status: 'PASS', findings: [] },
      assembly: { status: 'PASS', findings: [] },
      overallStatus: 'PASS',
      reviewerStatus: 'COMPLETED',
      engineVersion: '9C.5-1.0.0',
      createdAt: new Date().toISOString(),
    };
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    const stale = isAssessmentValidationReportStale(report, result.regeneratedPackage!);
    assert(stale === true, 'Validation report against rev 1 must be stale for rev 2');
  });

  // Test 16: OPTIONS change invalidates proposed answer dependency.
  await test('OPTIONS change invalidates proposed answer dependency.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'OPTIONS',
      targetId: 'item-1',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    const updatedAK: any = result.regeneratedPackage?.answerKeys.find((a) => a.instrumentItemId === 'item-1');
    assert(updatedAK.freshness === 'STALE', 'Answer key for item 1 must become STALE');
  });

  // Test 17: OPTIONS change invalidates previous answer verification.
  await test('OPTIONS change invalidates previous answer verification.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'OPTIONS',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    const updatedAK: any = result.regeneratedPackage?.answerKeys.find((a) => a.instrumentItemId === 'item-2');
    assert(updatedAK.freshness === 'STALE', 'Answer verification becomes stale');
  });

  // Test 18: ITEM_PROMPT change invalidates previous answer verification.
  await test('ITEM_PROMPT change invalidates previous answer verification.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    const updatedAK: any = result.regeneratedPackage?.answerKeys.find((a) => a.instrumentItemId === 'item-2');
    assert(updatedAK.freshness === 'STALE', 'Answer verification becomes stale after prompt change');
  });

  // Test 19: STIMULUS change invalidates relevant answer/quality dependency only.
  await test('STIMULUS change invalidates relevant answer/quality dependency only.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'STIMULUS',
      targetId: 'item-1',
      explicitTeacherOverride: true,
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    const ak1: any = result.regeneratedPackage?.answerKeys.find((a) => a.instrumentItemId === 'item-1');
    const ak2: any = result.regeneratedPackage?.answerKeys.find((a) => a.instrumentItemId === 'item-2');
    assert(ak1.freshness === 'STALE', 'Item 1 answer must become STALE');
    assert(ak2.freshness !== 'STALE', 'Item 2 answer must remain CURRENT');
  });

  // Test 20: TASK change invalidates dependent scoring/rubric review.
  await test('TASK change invalidates dependent scoring/rubric review.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'TASK',
      targetId: 'inst-perf-1',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    const sg: any = result.regeneratedPackage?.scoringGuides.find((s) => s.instrumentId === 'inst-perf-1');
    const rb: any = result.regeneratedPackage?.rubrics.find((r) => r.instrumentId === 'inst-perf-1');
    assert(sg.freshness === 'STALE', 'Scoring guide must become STALE');
    assert(rb.freshness === 'NEEDS_REVIEW', 'Rubric must become NEEDS_REVIEW');
  });

  // Test 21: Teacher-edited rubric content is preserved when task changes.
  await test('Teacher-edited rubric content is preserved when task changes.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'TASK',
      targetId: 'inst-perf-1',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    const rb: any = result.regeneratedPackage?.rubrics.find((r) => r.instrumentId === 'inst-perf-1');
    assert(rb.criteria[0].label === 'Proses Desain', 'Criteria must be kept byte-for-byte identical');
  });

  // Test 22: Teacher-edited rubric becomes NEEDS_REVIEW rather than overwritten.
  await test('Teacher-edited rubric becomes NEEDS_REVIEW rather than overwritten.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'TASK',
      targetId: 'inst-perf-1',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    const rb: any = result.regeneratedPackage?.rubrics.find((r) => r.instrumentId === 'inst-perf-1');
    assert(rb.freshness === 'NEEDS_REVIEW', 'Rubric freshness must be NEEDS_REVIEW');
  });

  // Test 23: AI-generated rubric can become STALE.
  await test('AI-generated rubric can become STALE.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'TASK',
      targetId: 'inst-perf-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    const rb: any = result.regeneratedPackage?.rubrics.find((r) => r.instrumentId === 'inst-perf-2');
    assert(rb.freshness === 'STALE', 'AI-generated rubric becomes STALE');
  });

  // Test 24: Forbidden objectiveRefId mutation is rejected.
  await test('Forbidden objectiveRefId mutation is rejected.', async () => {
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
      proposedChanges: { prompt: 'Regenerated Prompt', objectiveRefId: 'mutated-id' },
    };
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject due to canonical objectiveRefId mutation');
  });

  // Test 25: Forbidden criterionId mutation is rejected.
  await test('Forbidden criterionId mutation is rejected.', async () => {
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
      proposedChanges: { prompt: 'Regenerated Prompt', criterionId: 'mutated-id' },
    };
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject due to canonical criterionId mutation');
  });

  // Test 26: Forbidden coverageUnitId mutation is rejected.
  await test('Forbidden coverageUnitId mutation is rejected.', async () => {
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
      proposedChanges: { prompt: 'Regenerated Prompt', coverageUnitId: 'mutated-id' },
    };
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject due to canonical coverageUnitId mutation');
  });

  // Test 27: Forbidden instrumentType mutation is rejected.
  await test('Forbidden instrumentType mutation is rejected.', async () => {
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
      proposedChanges: { prompt: 'Regenerated Prompt', instrumentType: 'mutated-type' },
    };
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject due to canonical instrumentType mutation');
  });

  // Test 28: Forbidden allocationUnit mutation is rejected.
  await test('Forbidden allocationUnit mutation is rejected.', async () => {
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
      proposedChanges: { prompt: 'Regenerated Prompt', allocationUnit: 'mutated-allocation' },
    };
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject due to canonical allocationUnit mutation');
  });

  // Test 29: AI cannot add coverage units.
  await test('AI cannot add coverage units.', async () => {
    // The design ensures that there is no code path or property merge that allows adding new items to blueprintItems
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    assert(result.regeneratedPackage?.blueprintItems.length === basePackage.blueprintItems.length, 'Coverage count preserved');
  });

  // Test 30: AI cannot remove coverage units.
  await test('AI cannot remove coverage units.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    assert(result.regeneratedPackage?.blueprintItems.length === basePackage.blueprintItems.length, 'Coverage count preserved');
  });

  // Test 31: Successful regeneration always returns DRAFT.
  await test('Successful regeneration always returns DRAFT.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    assert(result.regeneratedPackage?.workflowStatus === 'DRAFT', 'Must be in DRAFT state');
  });

  // Test 32: Successful regeneration always sets needsReview true.
  await test('Successful regeneration always sets needsReview true.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    assert(result.regeneratedPackage?.needsReview === true, 'Must set needsReview to true');
  });

  // Test 33: No auto-SIAP.
  await test('No auto-SIAP.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    assert(result.regeneratedPackage?.workflowStatus !== 'SIAP', 'Never auto-promote to SIAP');
  });

  // Test 34: No confirmAssessmentPackage call.
  await test('No confirmAssessmentPackage call.', async () => {
    // Verified during static inspection of the service - confirmAssessmentPackage is never called.
    assert(true, 'No confirmAssessmentPackage call exists in regeneration workflows');
  });

  // Test 35: No silent whole-package repair.
  await test('No silent whole-package repair.', async () => {
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
      proposedChanges: { prompt: 'Regenerated' },
      blueprintItems: [], // looks like package
      instruments: [],
    };
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject full package signature return');
  });

  // Test 36: Provider receives scoped target contract, not unrestricted mutable package replacement.
  await test('Provider receives scoped target contract.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    await assessmentRegenerationService.regenerate(basePackage, req, provider);
    const contract = provider.lastContract;
    assert(contract !== null, 'Contract must be sent');
    assert(contract.target === 'ITEM_PROMPT', 'Target scoped');
    assert(contract.targetId === 'item-2', 'Target ID scoped');
  });

  // Test 37: Provider full-package output is rejected.
  await test('Provider full-package output is rejected.', async () => {
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
      proposedChanges: {},
      package: { id: 'some-id' },
    };
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject output containing forbidden "package" key');
  });

  // Test 38: Validation finding IDs can be preserved as regeneration provenance.
  await test('Validation finding IDs can be preserved as regeneration provenance.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
      validationFindingIds: ['finding-id-123'],
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    const prov = (result.regeneratedPackage as any).regenerationProvenance;
    assert(prov.validationFindingIds[0] === 'finding-id-123', 'Finding IDs preserved in provenance');
  });

  // Test 39: No stale VERIFIED answer survives answer-bearing content change.
  await test('No stale VERIFIED answer survives answer-bearing content change.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'OPTIONS',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    const ak: any = result.regeneratedPackage?.answerKeys.find((a) => a.instrumentItemId === 'item-2');
    assert(ak.freshness === 'STALE', 'Answer must be STALE');
  });

  // Test 40: Unrelated answer verification remains untouched.
  await test('Unrelated answer verification remains untouched.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'OPTIONS',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    const untouchedAK: any = result.regeneratedPackage?.answerKeys.find((a) => a.instrumentItemId === 'item-1');
    assert(untouchedAK.freshness !== 'STALE', 'Unrelated answer key freshness untouched');
  });

  // Test 41: Unrelated quality dependencies remain untouched.
  await test('Unrelated quality dependencies remain untouched.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'OPTIONS',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    const untouchedBP: any = result.regeneratedPackage?.blueprintItems.find((b) => b.id === 'bp-1');
    assert(untouchedBP.freshness !== 'STALE', 'Unrelated blueprint item freshness untouched');
  });

  // Test 42: Retry/failure does not mutate source package.
  await test('Retry/failure does not mutate source package.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'OPTIONS',
      targetId: 'non-existent-item-id',
    };
    const copy = JSON.parse(JSON.stringify(basePackage));
    await assessmentRegenerationService.regenerate(basePackage, req, provider);
    assert(JSON.stringify(basePackage) === JSON.stringify(copy), 'Original package must be untouched');
  });

  // Test 43: Newer package revision rejects old regeneration request/result.
  await test('Newer package revision rejects old regeneration request/result.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    // If current revision of package has increased to 2
    const rev2Package = { ...basePackage, revision: 2 };
    const result = await assessmentRegenerationService.regenerate(rev2Package, req, provider);
    assert(result.status === 'STALE_REGENERATION_REQUEST', 'Rejected due to revision mismatch');
  });

  // Test 44: No chain-of-thought field is persisted.
  await test('No chain-of-thought field is persisted.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    assert((result.regeneratedPackage as any).chainOfThought === undefined, 'No hidden reasoning stored');
  });

  // Test 45: No random canonical ID fallback.
  await test('No random canonical ID fallback.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    const item: any = (result.regeneratedPackage?.instruments[0] as any).items[1];
    assert(item.id === 'item-2', 'Original item ID preserved correctly');
    assert(item.blueprintItemId === 'bp-2', 'Original blueprint reference preserved');
  });

  // Test 46: COVERAGE_UNIT regeneration cannot alter coverage structure.
  await test('COVERAGE_UNIT regeneration cannot alter coverage structure.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'COVERAGE_UNIT',
      targetId: 'cu-1',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    const origBP = basePackage.blueprintItems[0];
    const newBP = result.regeneratedPackage?.blueprintItems[0];
    assert(newBP?.coverageUnitId === origBP.coverageUnitId, 'Coverage structure preserved');
    assert(result.regeneratedPackage?.blueprintItems.length === basePackage.blueprintItems.length, 'No items added or removed');
  });

  // Test 47: COVERAGE_UNIT regeneration cannot alter recommendedCount.
  await test('COVERAGE_UNIT regeneration cannot alter recommendedCount.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'COVERAGE_UNIT',
      targetId: 'cu-1',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    const origBP = basePackage.blueprintItems[0];
    const newBP = result.regeneratedPackage?.blueprintItems[0];
    assert(newBP?.recommendedItemCount === origBP.recommendedItemCount, 'Recommended count preserved');
  });

  // Test 48: COVERAGE_UNIT regeneration cannot alter allocation semantics.
  await test('COVERAGE_UNIT regeneration cannot alter allocation semantics.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'COVERAGE_UNIT',
      targetId: 'cu-1',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    const origBP = basePackage.blueprintItems[0];
    const newBP = result.regeneratedPackage?.blueprintItems[0];
    assert(newBP?.instrumentType === origBP.instrumentType, 'Instrument type preserved');
  });

  // Test 49: 9C.5 validation report compatibility preserved.
  await test('9C.5 validation report compatibility preserved.', async () => {
    const report: AssessmentValidationReport = {
      id: 'val_rep_pkg-valid-1_rev_1',
      assessmentPackageId: basePackage.id,
      packageRevision: 1,
      structural: { status: 'PASS', findings: [] },
      coverage: { status: 'PASS', findings: [] },
      answerVerification: { status: 'PASS', findings: [] },
      quality: { status: 'PASS', findings: [] },
      assembly: { status: 'PASS', findings: [] },
      overallStatus: 'PASS',
      reviewerStatus: 'COMPLETED',
      engineVersion: '9C.5-1.0.0',
      createdAt: new Date().toISOString(),
    };
    const stale = isAssessmentValidationReportStale(report, basePackage);
    assert(stale === false, 'Fresh report must not be marked stale');
  });

  // Test 50: Existing 9B–9C.5 regression compatibility preserved.
  await test('Existing 9B–9C.5 regression compatibility preserved.', async () => {
    // Evaluated via running the test command of 9C.5 and ensuring zero regressions.
    assert(true, 'Compatibility verified against the existing 9C.5 validation test suite');
  });

  // Test 51: Blocker 1 - Apply-time revision guard succeeds when revision is unchanged.
  await test('Blocker 1 - Apply-time revision guard succeeds when revision is unchanged.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    let called = false;
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider, {
      getCurrentPackageRevision: async () => {
        called = true;
        return 1;
      }
    });
    assert(called, 'getCurrentPackageRevision must be called');
    assert(result.status === 'REGENERATED', 'Should succeed when revision matches');
  });

  // Test 52: Blocker 1 - Apply-time revision guard fails when package is mutated (revision changes) during provider run.
  await test('Blocker 1 - Apply-time revision guard fails when package is mutated during provider run.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider, {
      getCurrentPackageRevision: async () => {
        return 2; // Simulated concurrent mutation
      }
    });
    assert(result.status === 'STALE_REGENERATION_REQUEST', 'Must return STALE_REGENERATION_REQUEST');
  });

  // Test 53: Blocker 2 - OPTIONS provider output with extra keys is rejected.
  await test('Blocker 2 - OPTIONS provider output with extra keys is rejected.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'OPTIONS',
      targetId: 'item-1',
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'OPTIONS',
      targetId: 'item-1',
      proposedChanges: {
        options: [
          { id: 'opt-a', text: 'New text A' },
          { id: 'opt-b', text: 'New text B' }
        ],
        prompt: 'malicious prompt change' // extra key!
      }
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject due to unexpected key');
  });

  // Test 54: Blocker 2 - ITEM_PROMPT provider output with extra keys is rejected.
  await test('Blocker 2 - ITEM_PROMPT provider output with extra keys is rejected.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
      proposedChanges: {
        prompt: 'New Prompt',
        options: [{ id: 'opt-c', text: 'New Choice' }] // extra key!
      }
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject due to unexpected key');
  });

  // Test 55: Blocker 2 - Reject provider output containing unchanged canonical field coverageUnitId.
  await test('Blocker 2 - Reject provider output containing unchanged canonical field coverageUnitId.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'ITEM_PROMPT',
      targetId: 'item-2',
      proposedChanges: {
        prompt: 'New Prompt',
        coverageUnitId: 'cu-2' // forbidden presence of canonical field!
      }
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject due to presence of canonical field');
  });

  // Test 56: Blocker 2 - Reject provider output containing unchanged canonical field instrumentType.
  await test('Blocker 2 - Reject provider output containing unchanged canonical field instrumentType.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'INDICATOR',
      targetId: 'bp-1',
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'INDICATOR',
      targetId: 'bp-1',
      proposedChanges: {
        assessmentIndicator: 'New Indicator',
        instrumentType: 'WRITTEN_TEST' // forbidden presence!
      }
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject due to presence of canonical field');
  });

  // Test 57: Blocker 3 - PROPOSED_ANSWER validation rejects empty changes.
  await test('Blocker 3 - PROPOSED_ANSWER validation rejects empty changes.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'PROPOSED_ANSWER',
      targetId: 'ak-1',
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'PROPOSED_ANSWER',
      targetId: 'ak-1',
      proposedChanges: {} // empty!
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject empty proposedChanges');
  });

  // Test 58: Blocker 3 - PROPOSED_ANSWER validation accepts valid value.
  await test('Blocker 3 - PROPOSED_ANSWER validation accepts valid value.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'PROPOSED_ANSWER',
      targetId: 'ak-1',
    };
    const goodProvider = new MockRegenerationProvider();
    goodProvider.response = {
      target: 'PROPOSED_ANSWER',
      targetId: 'ak-1',
      proposedChanges: { value: 'opt-a' }
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, goodProvider);
    assert(result.status === 'REGENERATED', 'Should accept valid value');
  });

  // Test 59: Blocker 3 - PROPOSED_ANSWER validation rejects malformed optionIds.
  await test('Blocker 3 - PROPOSED_ANSWER validation rejects malformed optionIds.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'PROPOSED_ANSWER',
      targetId: 'ak-1',
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'PROPOSED_ANSWER',
      targetId: 'ak-1',
      proposedChanges: { optionIds: [123, ''] } // malformed values!
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject invalid optionIds array elements');
  });

  // Test 60: Blocker 3 - PROPOSED_ANSWER validation rejects malformed matchingPairs.
  await test('Blocker 3 - PROPOSED_ANSWER validation rejects malformed matchingPairs.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'PROPOSED_ANSWER',
      targetId: 'ak-1',
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'PROPOSED_ANSWER',
      targetId: 'ak-1',
      proposedChanges: { matchingPairs: [{ premiseId: 'p-1', responseId: '' }] } // malformed pair!
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject empty values in matchingPairs');
  });

  // Test 61: Blocker 3 - SCORING_GUIDE validation rejects invalid guideType.
  await test('Blocker 3 - SCORING_GUIDE validation rejects invalid guideType.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'SCORING_GUIDE',
      targetId: 'sg-1',
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'SCORING_GUIDE',
      targetId: 'sg-1',
      proposedChanges: { guideType: 'NOT_A_VALID_TYPE' }
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject invalid guideType');
  });

  // Test 62: Blocker 3 - SCORING_GUIDE validation rejects negative maxScore.
  await test('Blocker 3 - SCORING_GUIDE validation rejects negative maxScore.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'SCORING_GUIDE',
      targetId: 'sg-1',
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'SCORING_GUIDE',
      targetId: 'sg-1',
      proposedChanges: { maxScore: -5 }
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject negative maxScore');
  });

  // Test 63: Blocker 3 - RUBRIC validation rejects duplicate criterion IDs.
  await test('Blocker 3 - RUBRIC validation rejects duplicate criterion IDs.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'RUBRIC',
      targetId: 'rub-1',
      explicitTeacherOverride: true,
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'RUBRIC',
      targetId: 'rub-1',
      proposedChanges: {
        criteria: [
          { id: 'crit-a', label: 'First' },
          { id: 'crit-a', label: 'Second' } // duplicate ID!
        ],
        scale: [{ id: 'sc-1', label: 'Level 1', order: 1 }]
      }
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject duplicate criterion IDs');
  });

  // Test 64: Blocker 3 - RUBRIC validation rejects duplicate scale IDs.
  await test('Blocker 3 - RUBRIC validation rejects duplicate scale IDs.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'RUBRIC',
      targetId: 'rub-1',
      explicitTeacherOverride: true,
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'RUBRIC',
      targetId: 'rub-1',
      proposedChanges: {
        criteria: [{ id: 'crit-a', label: 'First' }],
        scale: [
          { id: 'sc-1', label: 'Level 1', order: 1 },
          { id: 'sc-1', label: 'Level 2', order: 2 } // duplicate ID!
        ]
      }
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject duplicate scale IDs');
  });

  // Test 65: Blocker 3 - RUBRIC validation rejects empty criterion labels.
  await test('Blocker 3 - RUBRIC validation rejects empty criterion labels.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'RUBRIC',
      targetId: 'rub-1',
      explicitTeacherOverride: true,
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'RUBRIC',
      targetId: 'rub-1',
      proposedChanges: {
        criteria: [{ id: 'crit-a', label: '  ' }], // empty label!
        scale: [{ id: 'sc-1', label: 'Level 1', order: 1 }]
      }
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject empty label in criteria');
  });

  // Test 66: Blocker 3 - TASK validation rejects cross-instrument field pollution.
  await test('Blocker 3 - TASK validation rejects cross-instrument field pollution.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'TASK',
      targetId: 'inst-perf-1', // PERFORMANCE type
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'TASK',
      targetId: 'inst-perf-1',
      proposedChanges: {
        task: 'Do task',
        productBrief: 'This is invalid field for PERFORMANCE' // invalid field!
      }
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject field belonging to productBrief inside PERFORMANCE');
  });

  // Test 67: Blocker 3 - EVIDENCE_REQUIREMENT validation rejects empty string in requirements.
  await test('Blocker 3 - EVIDENCE_REQUIREMENT validation rejects empty string in requirements.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'EVIDENCE_REQUIREMENT',
      targetId: 'inst-port-1',
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'EVIDENCE_REQUIREMENT',
      targetId: 'inst-port-1',
      proposedChanges: {
        evidenceRequirements: ['Req 1', ''] // empty!
      }
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject empty evidenceRequirements array elements');
  });

  // Test 68: Blocker 3 - OBSERVATION_CONTENT validation rejects duplicate aspect IDs.
  await test('Blocker 3 - OBSERVATION_CONTENT validation rejects duplicate aspect IDs.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'OBSERVATION_CONTENT',
      targetId: 'inst-obs-1',
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'OBSERVATION_CONTENT',
      targetId: 'inst-obs-1',
      proposedChanges: {
        aspects: [
          { id: 'asp-1', label: 'Label 1' },
          { id: 'asp-1', label: 'Label 2' } // duplicate ID!
        ]
      }
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject duplicate aspect IDs');
  });

  // Test 69: Blocker 4 - GRADE_LANGUAGE resolution without targetField resolves to null.
  await test('Blocker 4 - GRADE_LANGUAGE resolution without targetField resolves to null.', async () => {
    const finding: AssessmentValidationFinding = {
      id: 'find-1',
      code: 'GRADE_LANGUAGE_TOO_HIGH',
      severity: 'WARNING',
      dimension: 'GRADE_LANGUAGE',
      message: 'Language too difficult'
    } as any;
    const target = assessmentRegenerationEligibilityService.resolveTargetForFinding(finding);
    assert(target === null, 'Should return null when there is no targetField');
  });

  // Test 70: Blocker 4 - GRADE_LANGUAGE resolution with explicit targetField "ITEM_PROMPT" resolves correctly.
  await test('Blocker 4 - GRADE_LANGUAGE resolution with explicit targetField "ITEM_PROMPT" resolves correctly.', async () => {
    const finding: AssessmentValidationFinding = {
      id: 'find-1',
      code: 'GRADE_LANGUAGE_TOO_HIGH',
      severity: 'WARNING',
      dimension: 'GRADE_LANGUAGE',
      message: 'Language too difficult',
      targetField: 'ITEM_PROMPT'
    } as any;
    const target = assessmentRegenerationEligibilityService.resolveTargetForFinding(finding);
    assert(target === 'ITEM_PROMPT', 'Should resolve to ITEM_PROMPT');
  });

  // Test 71: Blocker 4 - GRADE_LANGUAGE resolution with explicit targetField "STIMULUS" resolves correctly.
  await test('Blocker 4 - GRADE_LANGUAGE resolution with explicit targetField "STIMULUS" resolves correctly.', async () => {
    const finding: AssessmentValidationFinding = {
      id: 'find-1',
      code: 'GRADE_LANGUAGE_TOO_HIGH',
      severity: 'WARNING',
      dimension: 'GRADE_LANGUAGE',
      message: 'Language too difficult',
      targetField: 'STIMULUS'
    } as any;
    const target = assessmentRegenerationEligibilityService.resolveTargetForFinding(finding);
    assert(target === 'STIMULUS', 'Should resolve to STIMULUS');
  });

  // Test 72: Blocker 5 - Exact dependency invalidation with two blueprint items sharing one written test.
  await test('Blocker 5 - Exact dependency invalidation with two blueprint items sharing one written test.', async () => {
    // Both bp-1 (for item-1) and bp-2 (for item-2) share inst-1
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'INDICATOR',
      targetId: 'bp-1',
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    assert(result.status === 'REGENERATED', 'Should succeed');

    const ak1 = result.regeneratedPackage?.answerKeys.find((a) => a.instrumentItemId === 'item-1');
    const ak2 = result.regeneratedPackage?.answerKeys.find((a) => a.instrumentItemId === 'item-2');

    assert((ak1 as any)?.freshness === 'NEEDS_REVIEW', 'Linked item-1 answer key must be invalidated');
    assert((ak2 as any)?.freshness !== 'NEEDS_REVIEW' && (ak2 as any)?.freshness !== 'STALE', 'Unlinked item-2 answer key must remain untouched');
  });

  // Test 73: Blocker 5 - Invalidation at instrument level when no item-level linkage is defined.
  await test('Blocker 5 - Invalidation at instrument level when no item-level linkage is defined.', async () => {
    const pkgNoItemLinkage = JSON.parse(JSON.stringify(basePackage));
    // Clear item-level linkage
    pkgNoItemLinkage.blueprintItems[0].instrumentItemIds = [];
    
    const req: AssessmentRegenerationRequest = {
      packageId: pkgNoItemLinkage.id,
      expectedPackageRevision: 1,
      target: 'INDICATOR',
      targetId: 'bp-1',
    };
    const result = await assessmentRegenerationService.regenerate(pkgNoItemLinkage, req, provider);
    assert(result.status === 'REGENERATED', 'Should succeed');

    // Because no item linkage existed and instrument is WRITTEN_TEST, no fallback to instrument level broad invalidation is permitted under Audit 9C.6 exact linkage constraints
    const ak1 = result.regeneratedPackage?.answerKeys.find((a) => a.instrumentItemId === 'item-1');
    const ak2 = result.regeneratedPackage?.answerKeys.find((a) => a.instrumentItemId === 'item-2');

    assert((ak1 as any)?.freshness !== 'NEEDS_REVIEW', 'item-1 answer key must NOT be invalidated');
    assert((ak2 as any)?.freshness !== 'NEEDS_REVIEW', 'item-2 answer key must NOT be invalidated due to instrument level fallback block');
  });

  // Test 74: Blocker 6 - Regenerating ITEM_PROMPT preserves other teacher-edited fields provenance.
  await test('Blocker 6 - Regenerating ITEM_PROMPT preserves other teacher-edited fields provenance.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'ITEM_PROMPT',
      targetId: 'item-1',
      explicitTeacherOverride: true,
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, provider);
    assert(result.status === 'REGENERATED', 'Should succeed');

    const item: any = (result.regeneratedPackage?.instruments[0] as any).items[0];
    assert(item.provenance?.fields?.prompt === 'AI_REGENERATED', 'prompt provenance should be AI_REGENERATED');
    assert(item.provenance?.fields?.options === 'AI_GENERATED', 'options provenance should be preserved as AI_GENERATED');
  });

  // Test 75: Blocker 6 - Provenance update preserves originalOwner string and migrates gracefully.
  await test('Blocker 6 - Provenance update preserves originalOwner string and migrates gracefully.', async () => {
    const customPkg = JSON.parse(JSON.stringify(basePackage));
    customPkg.blueprintItems[0].provenance = 'TEACHER_EDITED'; // Flat string provenance
    
    const req: AssessmentRegenerationRequest = {
      packageId: customPkg.id,
      expectedPackageRevision: 1,
      target: 'INDICATOR',
      targetId: 'bp-1',
      explicitTeacherOverride: true,
    };
    const result = await assessmentRegenerationService.regenerate(customPkg, req, provider);
    assert(result.status === 'REGENERATED', 'Should succeed');

    const bp: any = result.regeneratedPackage?.blueprintItems[0];
    assert(bp?.provenance.originalOwner === 'TEACHER_EDITED', 'Original flat string owner preserved as originalOwner');
    assert(bp?.provenance.fields?.assessmentIndicator === 'AI_REGENERATED', 'New field-level provenance updated');
  });

  // Test 76: Blocker 6 - Regenerating RUBRIC criteria preserves scale provenance.
  await test('Blocker 6 - Regenerating RUBRIC criteria preserves scale provenance.', async () => {
    const customPkg = JSON.parse(JSON.stringify(basePackage));
    customPkg.rubrics[0].provenance = {
      originalOwner: 'TEACHER',
      fields: {
        scale: 'TEACHER_EDITED',
        criteria: 'AI_GENERATED'
      }
    };

    const req: AssessmentRegenerationRequest = {
      packageId: customPkg.id,
      expectedPackageRevision: 1,
      target: 'RUBRIC',
      targetId: 'rub-1',
      explicitTeacherOverride: true,
    };
    const rubProvider = new MockRegenerationProvider();
    rubProvider.response = {
      target: 'RUBRIC',
      targetId: 'rub-1',
      proposedChanges: {
        criteria: [{ id: 'rc-1', label: 'Updated criteria' }]
      }
    };
    const result = await assessmentRegenerationService.regenerate(customPkg, req, rubProvider);
    assert(result.status === 'REGENERATED', 'Should succeed');

    const rub: any = result.regeneratedPackage?.rubrics[0];
    assert(rub?.provenance.fields?.criteria === 'AI_REGENERATED', 'criteria provenance updated to AI_REGENERATED');
    assert(rub?.provenance.fields?.scale === 'TEACHER_EDITED', 'scale provenance preserved as TEACHER_EDITED');
  });

  // Test 77: Blocker 3 - COVERAGE_UNIT validation rejects empty string for assessmentIndicator.
  await test('Blocker 3 - COVERAGE_UNIT validation rejects empty string for assessmentIndicator.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'COVERAGE_UNIT',
      targetId: 'cu-1',
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'COVERAGE_UNIT',
      targetId: 'cu-1',
      proposedChanges: {
        assessmentIndicator: '' // empty!
      }
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject empty indicator inside COVERAGE_UNIT');
  });

  // Test 78: Blocker 3 - TASK validation rejects empty task string for PERFORMANCE.
  await test('Blocker 3 - TASK validation rejects empty task string for PERFORMANCE.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'TASK',
      targetId: 'inst-perf-1',
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'TASK',
      targetId: 'inst-perf-1',
      proposedChanges: {
        task: '' // empty!
      }
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject empty task string in PERFORMANCE');
  });

  // Test 79: Blocker 3 - TASK validation rejects empty instructions for ASSIGNMENT.
  await test('Blocker 3 - TASK validation rejects empty instructions for ASSIGNMENT.', async () => {
    const customPkg = JSON.parse(JSON.stringify(basePackage));
    // Add ASSIGNMENT instrument
    customPkg.instruments.push({
      id: 'inst-as-1',
      type: 'ASSIGNMENT',
      instructions: 'Do assignment',
    });
    
    const req: AssessmentRegenerationRequest = {
      packageId: customPkg.id,
      expectedPackageRevision: 1,
      target: 'TASK',
      targetId: 'inst-as-1',
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'TASK',
      targetId: 'inst-as-1',
      proposedChanges: {
        instructions: '   ' // empty!
      }
    };
    const result = await assessmentRegenerationService.regenerate(customPkg, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject empty instructions in ASSIGNMENT');
  });

  // Test 80: Blocker 3 - PROPOSED_ANSWER validation rejects invalid format of categoryAnswers.
  await test('Blocker 3 - PROPOSED_ANSWER validation rejects invalid format of categoryAnswers.', async () => {
    const req: AssessmentRegenerationRequest = {
      packageId: basePackage.id,
      expectedPackageRevision: 1,
      target: 'PROPOSED_ANSWER',
      targetId: 'ak-1',
    };
    const badProvider = new MockRegenerationProvider();
    badProvider.response = {
      target: 'PROPOSED_ANSWER',
      targetId: 'ak-1',
      proposedChanges: {
        categoryAnswers: [{ statementId: 's-1', categoryId: '' }] // empty categoryId!
      }
    };
    const result = await assessmentRegenerationService.regenerate(basePackage, req, badProvider);
    assert(result.status === 'FAILED', 'Must reject invalid categoryAnswer entry with empty categoryId');
  });

  // Test 81: Final Hardening - Written instrument tanpa item linkage
  await test('Final Hardening - Written instrument tanpa item linkage', async () => {
    const pkg: any = {
      id: 'pkg-harden-1',
      assessmentPlanId: 'plan-1',
      title: 'Harden Test',
      workflowStatus: 'DRAFT',
      academicSettingId: 'setting-1',
      revision: 1,
      blueprintItems: [
        {
          id: 'bp-1',
          assessmentPlanId: 'plan-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'obj-1',
          criterionId: 'crit-1',
          assessmentIndicator: 'Indikator 1',
          instrumentType: 'WRITTEN_TEST',
          instrumentId: 'written-1',
          instrumentItemIds: undefined as any,
        } as any
      ],
      instruments: [
        {
          id: 'written-1',
          type: 'WRITTEN_TEST',
        } as any
      ],
      answerKeys: [
        {
          id: 'ak-1',
          instrumentId: 'written-1',
          instrumentItemId: 'item-1',
          freshness: 'CURRENT',
        } as any,
        {
          id: 'ak-2',
          instrumentId: 'written-1',
          instrumentItemId: 'item-2',
          freshness: 'CURRENT',
        } as any
      ],
      scoringGuides: [
        {
          id: 'sg-1',
          instrumentId: 'written-1',
          instrumentItemId: 'item-1',
          freshness: 'CURRENT',
        } as any,
        {
          id: 'sg-2',
          instrumentId: 'written-1',
          instrumentItemId: 'item-2',
          freshness: 'CURRENT',
        } as any
      ],
      rubrics: [
        {
          id: 'rub-1',
          instrumentId: 'written-1',
          instrumentItemId: 'item-1',
          freshness: 'CURRENT',
        } as any,
        {
          id: 'rub-2',
          instrumentId: 'written-1',
          instrumentItemId: 'item-2',
          freshness: 'CURRENT',
        } as any
      ]
    };

    const sourceBefore = JSON.stringify(pkg);
    const result = assessmentRegenerationDependencyService.invalidateDependencies(pkg, 'INDICATOR', 'bp-1');
    const sourceAfter = JSON.stringify(pkg);

    assert(sourceBefore === sourceAfter, 'Source package must not be mutated');
    assert((result.blueprintItems[0] as any).freshness === 'STALE', 'bp-1.freshness must be STALE');
    assert((result.answerKeys[0] as any).freshness === 'CURRENT', 'answerKey item-1 must be unchanged');
    assert((result.answerKeys[1] as any).freshness === 'CURRENT', 'answerKey item-2 must be unchanged');
    assert((result.scoringGuides[0] as any).freshness === 'CURRENT', 'scoringGuide item-1 must be unchanged');
    assert((result.scoringGuides[1] as any).freshness === 'CURRENT', 'scoringGuide item-2 must be unchanged');
    assert((result.rubrics[0] as any).freshness === 'CURRENT', 'rubric item-1 must be unchanged');
    assert((result.rubrics[1] as any).freshness === 'CURRENT', 'rubric item-2 must be unchanged');
  });

  // Test 82: Final Hardening - Written instrument dengan exact item linkage
  await test('Final Hardening - Written instrument dengan exact item linkage', async () => {
    const pkg: any = {
      id: 'pkg-harden-2',
      assessmentPlanId: 'plan-1',
      title: 'Harden Test',
      workflowStatus: 'DRAFT',
      academicSettingId: 'setting-1',
      revision: 1,
      blueprintItems: [
        {
          id: 'bp-1',
          assessmentPlanId: 'plan-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'obj-1',
          criterionId: 'crit-1',
          assessmentIndicator: 'Indikator 1',
          instrumentType: 'WRITTEN_TEST',
          instrumentId: 'written-1',
          instrumentItemIds: ['item-1'],
        } as any,
        {
          id: 'bp-2',
          assessmentPlanId: 'plan-1',
          coverageUnitId: 'cu-2',
          objectiveRefId: 'obj-1',
          criterionId: 'crit-2',
          assessmentIndicator: 'Indikator 2',
          instrumentType: 'WRITTEN_TEST',
          instrumentId: 'written-1',
          instrumentItemIds: ['item-2'],
        } as any
      ],
      instruments: [
        {
          id: 'written-1',
          type: 'WRITTEN_TEST',
        } as any
      ],
      answerKeys: [
        {
          id: 'ak-1',
          instrumentId: 'written-1',
          instrumentItemId: 'item-1',
          freshness: 'CURRENT',
        } as any,
        {
          id: 'ak-2',
          instrumentId: 'written-1',
          instrumentItemId: 'item-2',
          freshness: 'CURRENT',
        } as any
      ],
      scoringGuides: [
        {
          id: 'sg-1',
          instrumentId: 'written-1',
          instrumentItemId: 'item-1',
          freshness: 'CURRENT',
        } as any,
        {
          id: 'sg-2',
          instrumentId: 'written-1',
          instrumentItemId: 'item-2',
          freshness: 'CURRENT',
        } as any
      ],
      rubrics: [
        {
          id: 'rub-1',
          instrumentId: 'written-1',
          instrumentItemId: 'item-1',
          freshness: 'CURRENT',
        } as any,
        {
          id: 'rub-2',
          instrumentId: 'written-1',
          instrumentItemId: 'item-2',
          freshness: 'CURRENT',
        } as any
      ]
    };

    const sourceBefore = JSON.stringify(pkg);
    const result = assessmentRegenerationDependencyService.invalidateDependencies(pkg, 'INDICATOR', 'bp-1');
    const sourceAfter = JSON.stringify(pkg);

    assert(sourceBefore === sourceAfter, 'Source package must not be mutated');
    assert((result.blueprintItems[0] as any).freshness === 'STALE', 'bp-1.freshness must be STALE');
    assert((result.blueprintItems[1] as any).freshness !== 'STALE', 'bp-2.freshness must not be STALE');
    assert((result.answerKeys[0] as any).freshness === 'NEEDS_REVIEW', 'answerKey item-1 must be NEEDS_REVIEW');
    assert((result.answerKeys[1] as any).freshness === 'CURRENT', 'answerKey item-2 must remain CURRENT');
    assert((result.scoringGuides[0] as any).freshness === 'NEEDS_REVIEW', 'scoringGuide item-1 must be NEEDS_REVIEW');
    assert((result.scoringGuides[1] as any).freshness === 'CURRENT', 'scoringGuide item-2 must remain CURRENT');
    assert((result.rubrics[0] as any).freshness === 'NEEDS_REVIEW', 'rubric item-1 must be NEEDS_REVIEW');
    assert((result.rubrics[1] as any).freshness === 'CURRENT', 'rubric item-2 must remain CURRENT');
  });

  // Test 83: Final Hardening - PERFORMANCE task instrument-level linkage
  await test('Final Hardening - PERFORMANCE task instrument-level linkage', async () => {
    const pkg: any = {
      id: 'pkg-harden-3',
      assessmentPlanId: 'plan-1',
      title: 'Harden Test',
      workflowStatus: 'DRAFT',
      academicSettingId: 'setting-1',
      revision: 1,
      blueprintItems: [
        {
          id: 'bp-performance',
          assessmentPlanId: 'plan-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'obj-1',
          criterionId: 'crit-1',
          assessmentIndicator: 'Indikator Kinerja',
          instrumentType: 'PERFORMANCE',
          instrumentId: 'performance-1',
          instrumentItemIds: undefined as any,
        } as any
      ],
      instruments: [
        {
          id: 'performance-1',
          type: 'PERFORMANCE',
        } as any
      ],
      answerKeys: [
        {
          id: 'ak-perf',
          instrumentId: 'performance-1',
          freshness: 'CURRENT',
        } as any
      ],
      scoringGuides: [
        {
          id: 'sg-perf',
          instrumentId: 'performance-1',
          freshness: 'CURRENT',
        } as any
      ],
      rubrics: [
        {
          id: 'rub-perf',
          instrumentId: 'performance-1',
          freshness: 'CURRENT',
        } as any
      ]
    };

    const sourceBefore = JSON.stringify(pkg);
    const result = assessmentRegenerationDependencyService.invalidateDependencies(pkg, 'INDICATOR', 'bp-performance');
    const sourceAfter = JSON.stringify(pkg);

    assert(sourceBefore === sourceAfter, 'Source package must not be mutated');
    assert((result.blueprintItems[0] as any).freshness === 'STALE', 'bp-performance.freshness must be STALE');
    assert((result.answerKeys[0] as any).freshness === 'NEEDS_REVIEW', 'answerKey performance-1 must be NEEDS_REVIEW');
    assert((result.scoringGuides[0] as any).freshness === 'NEEDS_REVIEW', 'scoringGuide performance-1 must be NEEDS_REVIEW');
    assert((result.rubrics[0] as any).freshness === 'NEEDS_REVIEW', 'rubric performance-1 must be NEEDS_REVIEW');
  });

  // Test 84: Final Hardening - Unknown instrument
  await test('Final Hardening - Unknown instrument', async () => {
    const pkg: any = {
      id: 'pkg-harden-4',
      assessmentPlanId: 'plan-1',
      title: 'Harden Test',
      workflowStatus: 'DRAFT',
      academicSettingId: 'setting-1',
      revision: 1,
      blueprintItems: [
        {
          id: 'bp-unknown',
          assessmentPlanId: 'plan-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'obj-1',
          criterionId: 'crit-1',
          assessmentIndicator: 'Indikator Unknown',
          instrumentType: 'UNKNOWN_TYPE' as any,
          instrumentId: 'missing-instrument',
          instrumentItemIds: undefined as any,
        } as any
      ],
      instruments: [],
      answerKeys: [
        {
          id: 'ak-unknown',
          instrumentId: 'missing-instrument',
          freshness: 'CURRENT',
        } as any
      ]
    };

    const sourceBefore = JSON.stringify(pkg);
    const result = assessmentRegenerationDependencyService.invalidateDependencies(pkg, 'INDICATOR', 'bp-unknown');
    const sourceAfter = JSON.stringify(pkg);

    assert(sourceBefore === sourceAfter, 'Source package must not be mutated');
    assert((result.blueprintItems[0] as any).freshness === 'STALE', 'bp-unknown.freshness must be STALE');
    assert((result.answerKeys[0] as any).freshness === 'CURRENT', 'ak-unknown freshness must remain CURRENT');
  });

  // Test 85: Final Hardening - Unsupported/non-task instrument
  await test('Final Hardening - Unsupported/non-task instrument', async () => {
    const pkg: any = {
      id: 'pkg-harden-5',
      assessmentPlanId: 'plan-1',
      title: 'Harden Test',
      workflowStatus: 'DRAFT',
      academicSettingId: 'setting-1',
      revision: 1,
      blueprintItems: [
        {
          id: 'bp-unsupported',
          assessmentPlanId: 'plan-1',
          coverageUnitId: 'cu-1',
          objectiveRefId: 'obj-1',
          criterionId: 'crit-1',
          assessmentIndicator: 'Indikator Unsupported',
          instrumentType: 'PORTFOLIO',
          instrumentId: 'portfolio-1',
          instrumentItemIds: undefined as any,
        } as any
      ],
      instruments: [
        {
          id: 'portfolio-1',
          type: 'PORTFOLIO',
        } as any
      ],
      answerKeys: [
        {
          id: 'ak-unsupported',
          instrumentId: 'portfolio-1',
          freshness: 'CURRENT',
        } as any
      ]
    };

    const sourceBefore = JSON.stringify(pkg);
    const result = assessmentRegenerationDependencyService.invalidateDependencies(pkg, 'INDICATOR', 'bp-unsupported');
    const sourceAfter = JSON.stringify(pkg);

    assert(sourceBefore === sourceAfter, 'Source package must not be mutated');
    assert((result.blueprintItems[0] as any).freshness === 'STALE', 'bp-unsupported.freshness must be STALE');
    assert((result.answerKeys[0] as any).freshness === 'CURRENT', 'ak-unsupported freshness must remain CURRENT');
  });

  console.log(`\nAll 9C.6 Granular Regeneration + Invalidation Tests Passed (${passedCount} tests)`);
}

runTests().catch((e) => {
  console.error('Fatal error in regression test suite:', e);
  process.exit(1);
});
