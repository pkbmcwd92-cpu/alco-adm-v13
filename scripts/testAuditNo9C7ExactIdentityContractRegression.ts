import assert from 'assert';
import { assessmentRegenerationEligibilityService } from '../src/services/assessmentRegenerationEligibilityService';
import { assessmentRegenerationService } from '../src/services/assessmentRegenerationService';
import {
  AssessmentPackage,
  AssessmentRegenerationTarget,
  AssessmentValidationFinding,
} from '../src/types';

console.log('Running Audit 9C.7 Exact Identity Contract & Final Hardening Regression Suite...\n');

let passedTests = 0;

async function runTest(description: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      await res;
    }
    passedTests++;
    console.log(`[PASS] ${description}`);
  } catch (err) {
    console.error(`[FAIL] ${description}`);
    console.error(err);
    process.exit(1);
  }
}

function createMockPackage(overrides: Partial<AssessmentPackage> = {}): AssessmentPackage {
  return {
    id: 'pkg-1',
    title: 'Test Package',
    academicSettingId: 'setting-1',
    assessmentPlanId: 'plan-1',
    revision: 1,
    workflowStatus: 'DRAFT',
    blueprintItems: [],
    instruments: [],
    answerKeys: [],
    scoringGuides: [],
    rubrics: [],
    createdAt: '2026-09-20T00:00:00Z',
    updatedAt: '2026-09-20T00:00:00Z',
    ...overrides,
  };
}

async function runAllTests() {
  // --- Section 1: 0 MATCH = FAIL CLOSED ---
  await runTest('1.1: locateTarget with 0 match fails closed (TARGET_NOT_FOUND) for INDICATOR', async () => {
    const pkg = createMockPackage({
      blueprintItems: [{ id: 'bp-1', coverageUnitId: 'cu-1', assessmentIndicator: 'Ind 1' } as any],
    });
    const res = await assessmentRegenerationService.regenerate(
      pkg,
      {
        packageId: 'pkg-1',
        expectedPackageRevision: 1,
        target: 'INDICATOR',
        targetId: 'bp-non-existent',
      },
      { regenerate: async () => ({ target: 'INDICATOR', targetId: 'bp-non-existent', proposedChanges: { assessmentIndicator: 'New' } }) }
    );
    assert.strictEqual(res.status, 'FAILED');
    assert.ok(res.issues?.[0].includes('not found'));
  });

  await runTest('1.2: locateTarget with 0 match fails closed for ITEM_PROMPT', async () => {
    const pkg = createMockPackage({
      instruments: [{ id: 'inst-1', type: 'WRITTEN_TEST', items: [{ id: 'item-1', prompt: 'Q1' }] } as any],
    });
    const res = await assessmentRegenerationService.regenerate(
      pkg,
      {
        packageId: 'pkg-1',
        expectedPackageRevision: 1,
        target: 'ITEM_PROMPT',
        targetId: 'item-999',
      },
      { regenerate: async () => ({}) }
    );
    assert.strictEqual(res.status, 'FAILED');
    assert.ok(res.issues?.[0].includes('not found'));
  });

  // --- Section 2: >1 MATCH = AMBIGUOUS / FAIL CLOSED ---
  await runTest('2.1: locateTarget with >1 match fails closed (AMBIGUOUS_TARGET) for ITEM_PROMPT', async () => {
    const pkg = createMockPackage({
      instruments: [
        { id: 'inst-1', type: 'WRITTEN_TEST', items: [{ id: 'dup-id', prompt: 'First' }] } as any,
        { id: 'inst-2', type: 'WRITTEN_TEST', items: [{ id: 'dup-id', prompt: 'Second' }] } as any,
      ],
    });
    const res = await assessmentRegenerationService.regenerate(
      pkg,
      {
        packageId: 'pkg-1',
        expectedPackageRevision: 1,
        target: 'ITEM_PROMPT',
        targetId: 'dup-id',
      },
      { regenerate: async () => ({ target: 'ITEM_PROMPT', targetId: 'dup-id', proposedChanges: { prompt: 'New' } }) }
    );
    assert.strictEqual(res.status, 'FAILED');
    assert.ok(res.issues?.[0].includes('ambiguous (2 matches found)'));
  });

  await runTest('2.2: locateTarget with >1 match fails closed for PROPOSED_ANSWER', async () => {
    const pkg = createMockPackage({
      answerKeys: [
        { id: 'ak-1', instrumentItemId: 'item-1', value: 'A' } as any,
        { id: 'ak-2', instrumentItemId: 'item-1', value: 'B' } as any,
      ],
    });
    const res = await assessmentRegenerationService.regenerate(
      pkg,
      {
        packageId: 'pkg-1',
        expectedPackageRevision: 1,
        target: 'PROPOSED_ANSWER',
        targetId: 'item-1',
      },
      { regenerate: async () => ({ target: 'PROPOSED_ANSWER', targetId: 'item-1', proposedChanges: { value: 'C' } }) }
    );
    assert.strictEqual(res.status, 'FAILED');
    assert.ok(res.issues?.[0].includes('ambiguous'));
  });

  // --- Section 3: 1 MATCH = VALID ---
  await runTest('3.1: locateTarget with exactly 1 match succeeds for ITEM_PROMPT', async () => {
    const pkg = createMockPackage({
      instruments: [
        { id: 'inst-1', type: 'WRITTEN_TEST', items: [{ id: 'unique-item', prompt: 'Original Prompt' }] } as any,
      ],
    });
    const res = await assessmentRegenerationService.regenerate(
      pkg,
      {
        packageId: 'pkg-1',
        expectedPackageRevision: 1,
        target: 'ITEM_PROMPT',
        targetId: 'unique-item',
        locator: { kind: 'INSTRUMENT_ITEM', id: 'unique-item' },
      },
      {
        regenerate: async () => ({
          target: 'ITEM_PROMPT',
          targetId: 'unique-item',
          proposedChanges: { prompt: 'Regenerated Prompt' },
        }),
      }
    );
    assert.strictEqual(res.status, 'REGENERATED');
    const updatedItem = (res.regeneratedPackage?.instruments[0] as any).items[0];
    assert.strictEqual(updatedItem.prompt, 'Regenerated Prompt');
    assert.strictEqual(res.regeneratedPackage?.revision, 2);
  });

  // --- Section 4: LOCATOR KIND & IDENTITY INVARIANTS = FAIL CLOSED ---
  await runTest('4.1: locateTarget with wrong locator kind fails closed (INVALID_LOCATOR_KIND)', async () => {
    const pkg = createMockPackage({
      blueprintItems: [{ id: 'bp-1', assessmentIndicator: 'Ind 1' } as any],
    });
    const res = await assessmentRegenerationService.regenerate(
      pkg,
      {
        packageId: 'pkg-1',
        expectedPackageRevision: 1,
        target: 'INDICATOR',
        targetId: 'bp-1',
        locator: { kind: 'INSTRUMENT' as any, id: 'bp-1' }, // Wrong locator kind!
      },
      { regenerate: async () => ({}) }
    );
    assert.strictEqual(res.status, 'FAILED');
    assert.ok(res.issues?.[0].includes('Invalid locator kind'));
  });

  await runTest('4.2: targetId != locator.id strictly fails closed', async () => {
    const pkg = createMockPackage({
      instruments: [{ id: 'inst-1', type: 'WRITTEN_TEST', items: [{ id: 'item-1', prompt: 'Q1' }] } as any],
    });
    const res = await assessmentRegenerationService.regenerate(
      pkg,
      {
        packageId: 'pkg-1',
        expectedPackageRevision: 1,
        target: 'ITEM_PROMPT',
        targetId: 'item-1',
        locator: { kind: 'INSTRUMENT_ITEM', id: 'different-id' }, // targetId mismatch!
      },
      { regenerate: async () => ({}) }
    );
    assert.strictEqual(res.status, 'FAILED');
    assert.ok(res.issues?.[0].includes('TARGET_LOCATOR_ID_MISMATCH'));
  });

  await runTest('4.3: locateTarget with invalid locator kind for PROPOSED_ANSWER fails closed', async () => {
    const pkg = createMockPackage({
      answerKeys: [{ id: 'ak-1', instrumentItemId: 'item-1', value: 'A' } as any],
    });
    const res = await assessmentRegenerationService.regenerate(
      pkg,
      {
        packageId: 'pkg-1',
        expectedPackageRevision: 1,
        target: 'PROPOSED_ANSWER',
        targetId: 'ak-1',
        locator: { kind: 'BLUEPRINT_ITEM' as any, id: 'ak-1' }, // Invalid kind for answer key!
      },
      { regenerate: async () => ({}) }
    );
    assert.strictEqual(res.status, 'FAILED');
    assert.ok(res.issues?.[0].includes('Invalid locator kind'));
  });

  await runTest('4.4: Canonical validationFindings filtering strictly isolates findings by locator.kind', async () => {
    const pkg = createMockPackage({
      instruments: [{ id: 'inst-1', type: 'WRITTEN_TEST', items: [{ id: 'shared-id', prompt: 'Q1' }] } as any],
      blueprintItems: [{ id: 'shared-id', assessmentIndicator: 'Ind 1' } as any],
    });
    let capturedContract: any = null;
    const findings: AssessmentValidationFinding[] = [
      {
        id: 'f-item',
        source: 'DETERMINISTIC',
        status: 'FAIL',
        severity: 'BLOCKING',
        instrumentItemId: 'shared-id', // matches instrument item
        code: 'POOR_PROMPT',
        message: 'Prompt issue',
      },
      {
        id: 'f-bp',
        source: 'DETERMINISTIC',
        status: 'FAIL',
        severity: 'BLOCKING',
        blueprintItemId: 'shared-id', // same id string, but blueprint namespace!
        code: 'INDICATOR_QUALITY',
        message: 'Indicator issue',
      },
    ];
    const res = await assessmentRegenerationService.regenerate(
      pkg,
      {
        packageId: 'pkg-1',
        expectedPackageRevision: 1,
        target: 'ITEM_PROMPT',
        targetId: 'shared-id',
        locator: { kind: 'INSTRUMENT_ITEM', id: 'shared-id' },
      },
      {
        regenerate: async (contract) => {
          capturedContract = contract;
          return {
            target: 'ITEM_PROMPT',
            targetId: 'shared-id',
            proposedChanges: { prompt: 'Fixed' },
          };
        },
      },
      { validationFindings: findings }
    );
    assert.strictEqual(res.status, 'REGENERATED');
    assert.ok(capturedContract);
    // Should ONLY contain f-item, NOT f-bp!
    assert.strictEqual(capturedContract.validationFindings.length, 1);
    assert.strictEqual(capturedContract.validationFindings[0].id, 'f-item');
  });

  await runTest('4.5: AI output altering locator identity fails closed', async () => {
    const pkg = createMockPackage({
      instruments: [{ id: 'inst-1', type: 'WRITTEN_TEST', items: [{ id: 'item-1', prompt: 'Q1' }] } as any],
    });
    const res = await assessmentRegenerationService.regenerate(
      pkg,
      {
        packageId: 'pkg-1',
        expectedPackageRevision: 1,
        target: 'ITEM_PROMPT',
        targetId: 'item-1',
        locator: { kind: 'INSTRUMENT_ITEM', id: 'item-1' },
      },
      {
        regenerate: async () => ({
          target: 'ITEM_PROMPT',
          targetId: 'item-1',
          locator: { kind: 'INSTRUMENT_ITEM', id: 'item-hijacked' }, // AI tampered with locator id!
          proposedChanges: { prompt: 'Hijacked' },
        }),
      }
    );
    assert.strictEqual(res.status, 'FAILED');
    assert.ok(res.issues?.[0].includes('changed locator identity'));
  });

  await runTest('4.6: AI output proposing whole-package replacement fails closed', async () => {
    const pkg = createMockPackage({
      instruments: [{ id: 'inst-1', type: 'WRITTEN_TEST', items: [{ id: 'item-1', prompt: 'Q1' }] } as any],
    });
    const res = await assessmentRegenerationService.regenerate(
      pkg,
      {
        packageId: 'pkg-1',
        expectedPackageRevision: 1,
        target: 'ITEM_PROMPT',
        targetId: 'item-1',
        locator: { kind: 'INSTRUMENT_ITEM', id: 'item-1' },
      },
      {
        regenerate: async () => ({
          target: 'ITEM_PROMPT',
          targetId: 'item-1',
          package: { all: 'replaced' },
          proposedChanges: { prompt: 'Whole package' },
        }),
      }
    );
    assert.strictEqual(res.status, 'FAILED');
    assert.ok(res.issues?.[0].includes('whole-package replacement'));
  });

  // --- Section 5: NO DATA > FAKE IDENTITY (FAIL CLOSED) ---
  await runTest('5.1: Finding without exact identity fails closed with MISSING_EXACT_IDENTITY', () => {
    const finding: AssessmentValidationFinding = {
      id: 'finding-123',
      source: 'AI_QUALITY_REVIEWER',
      status: 'FAIL',
      severity: 'BLOCKING',
      dimension: 'ITEM_CONSTRUCTION',
      code: 'POOR_PROMPT',
      message: 'Soal tidak jelas',
      // Missing instrumentItemId!
    };
    const action = assessmentRegenerationEligibilityService.resolveActionForFinding(finding);
    assert.strictEqual(action.eligible, false);
    assert.strictEqual(action.reason, 'MISSING_EXACT_IDENTITY');
    assert.strictEqual(action.targetId, undefined);
  });

  await runTest('5.2: Finding with empty string identity fails closed with MISSING_EXACT_IDENTITY', () => {
    const finding: AssessmentValidationFinding = {
      id: 'finding-124',
      source: 'AI_QUALITY_REVIEWER',
      status: 'REVIEW',
      severity: 'REVIEW',
      code: 'POOR_DISTRACTOR',
      message: 'Pilihan pengecoh lemah',
      instrumentItemId: '   ', // whitespace only
    };
    const action = assessmentRegenerationEligibilityService.resolveActionForFinding(finding);
    assert.strictEqual(action.eligible, false);
    assert.strictEqual(action.reason, 'MISSING_EXACT_IDENTITY');
  });

  // --- Section 6: AMBIGUOUS > FIRST MATCH (FAIL CLOSED) ---
  await runTest('6.1: Ambiguous GRADE_LANGUAGE without targetField fails closed', () => {
    const finding: AssessmentValidationFinding = {
      id: 'finding-125',
      code: 'GRADE_LANGUAGE_COMPLEXITY',
      source: 'AI_QUALITY_REVIEWER',
      status: 'REVIEW',
      severity: 'REVIEW',
      dimension: 'GRADE_LANGUAGE',
      message: 'Bahasa belum sesuai usia anak',
      instrumentItemId: 'item-1',
    };
    const action = assessmentRegenerationEligibilityService.resolveActionForFinding(finding);
    assert.strictEqual(action.eligible, false);
    assert.strictEqual(action.reason, 'INELIGIBLE_OR_AMBIGUOUS');
  });

  await runTest('6.2: GRADE_LANGUAGE with explicit targetField=ITEM_PROMPT maps deterministically', () => {
    const finding: AssessmentValidationFinding = {
      id: 'finding-126',
      code: 'GRADE_LANGUAGE_COMPLEXITY',
      source: 'AI_QUALITY_REVIEWER',
      status: 'REVIEW',
      severity: 'REVIEW',
      dimension: 'GRADE_LANGUAGE',
      targetField: 'ITEM_PROMPT',
      message: 'Bahasa soal perlu disederhanakan',
      instrumentItemId: 'item-1',
    };
    const action = assessmentRegenerationEligibilityService.resolveActionForFinding(finding);
    assert.strictEqual(action.eligible, true);
    assert.strictEqual(action.target, 'ITEM_PROMPT');
    assert.strictEqual(action.targetId, 'item-1');
    assert.deepStrictEqual(action.locator, { kind: 'INSTRUMENT_ITEM', id: 'item-1' });
  });

  // --- Section 7: ID > TEXT MATCH & STRUCTURAL FINDINGS FAIL CLOSED ---
  await runTest('7.1: Explicit structural codes strictly fail closed', () => {
    const structuralFindings: AssessmentValidationFinding[] = [
      { id: 'f1', source: 'DETERMINISTIC', status: 'FAIL', severity: 'BLOCKING', code: 'DANGLING_BLUEPRINT_INSTRUMENT', message: 'Dangling' },
      { id: 'f2', source: 'DETERMINISTIC', status: 'FAIL', severity: 'BLOCKING', code: 'BLUEPRINT_INSTRUMENT_TYPE_MISMATCH', message: 'Mismatch' },
      { id: 'f3', source: 'DETERMINISTIC', status: 'FAIL', severity: 'BLOCKING', code: 'MISSING_PLANNED_COVERAGE', message: 'Missing' },
    ];
    for (const f of structuralFindings) {
      const action = assessmentRegenerationEligibilityService.resolveActionForFinding(f);
      assert.strictEqual(action.eligible, false);
      assert.strictEqual(action.reason, 'STRUCTURAL_FINDING');
    }
  });

  await runTest('7.2: Substring matching is removed (no accidental text matching)', () => {
    // A hypothetical finding with "RUBRIC" in message but dimension/code not in actionable set
    const f: AssessmentValidationFinding = {
      id: 'f-custom',
      source: 'AI_QUALITY_REVIEWER',
      status: 'REVIEW',
      severity: 'INFO',
      code: 'CUSTOM_RUBRIC_STATISTICS',
      message: 'Rubric distribution summary',
    };
    const action = assessmentRegenerationEligibilityService.resolveActionForFinding(f);
    assert.strictEqual(action.eligible, false);
  });

  // --- Section 8: TEACHER EDIT ALWAYS WINS ---
  await runTest('8.1: Teacher edited field is protected and wins against AI regeneration', async () => {
    const pkg = createMockPackage({
      instruments: [
        {
          id: 'inst-1',
          type: 'WRITTEN_TEST',
          items: [
            {
              id: 'item-1',
              prompt: 'Teacher crafted question',
              provenance: { fields: { prompt: 'TEACHER_EDITED' } },
            },
          ],
        } as any,
      ],
    });
    const res = await assessmentRegenerationService.regenerate(
      pkg,
      {
        packageId: 'pkg-1',
        expectedPackageRevision: 1,
        target: 'ITEM_PROMPT',
        targetId: 'item-1',
        explicitTeacherOverride: false, // No override!
      },
      { regenerate: async () => ({}) }
    );
    assert.strictEqual(res.status, 'TEACHER_EDIT_PROTECTED');
    assert.ok(res.issues?.[0].includes('edited by a teacher'));
  });

  await runTest('8.2: Explicit teacher override permits regeneration with field provenance tracking', async () => {
    const pkg = createMockPackage({
      instruments: [
        {
          id: 'inst-1',
          type: 'WRITTEN_TEST',
          items: [
            {
              id: 'item-1',
              prompt: 'Teacher crafted question',
              provenance: { fields: { prompt: 'TEACHER_EDITED' } },
            },
          ],
        } as any,
      ],
    });
    const res = await assessmentRegenerationService.regenerate(
      pkg,
      {
        packageId: 'pkg-1',
        expectedPackageRevision: 1,
        target: 'ITEM_PROMPT',
        targetId: 'item-1',
        explicitTeacherOverride: true, // Explicit override!
      },
      {
        regenerate: async () => ({
          target: 'ITEM_PROMPT',
          targetId: 'item-1',
          proposedChanges: { prompt: 'Overridden Prompt' },
        }),
      }
    );
    assert.strictEqual(res.status, 'REGENERATED');
    const updated = (res.regeneratedPackage?.instruments[0] as any).items[0];
    assert.strictEqual(updated.prompt, 'Overridden Prompt');
    assert.strictEqual(updated.provenance?.fields?.prompt, 'AI_REGENERATED');
  });

  // --- Section 9: NEVER AUTO-SIAP ---
  await runTest('9.1: Regenerated package always remains DRAFT with needsReview true', async () => {
    const pkg = createMockPackage({
      revision: 5,
      blueprintItems: [{ id: 'bp-1', assessmentIndicator: 'Old' } as any],
    });
    const res = await assessmentRegenerationService.regenerate(
      pkg,
      {
        packageId: 'pkg-1',
        expectedPackageRevision: 5,
        target: 'INDICATOR',
        targetId: 'bp-1',
      },
      {
        regenerate: async () => ({
          target: 'INDICATOR',
          targetId: 'bp-1',
          proposedChanges: { assessmentIndicator: 'New Ind' },
        }),
      }
    );
    assert.strictEqual(res.status, 'REGENERATED');
    assert.strictEqual(res.regeneratedPackage?.workflowStatus, 'DRAFT');
    assert.strictEqual(res.regeneratedPackage?.needsReview, true);
    assert.strictEqual(res.regeneratedPackage?.revision, 6);
  });

  console.log(`\nAll ${passedTests} Exact Identity Contract & Hardening tests passed successfully!`);
}

runAllTests().catch(err => {
  console.error(err);
  process.exit(1);
});
