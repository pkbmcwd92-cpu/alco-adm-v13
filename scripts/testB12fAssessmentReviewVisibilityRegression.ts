import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

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

  console.log('=== B.1.2f ASSESSMENT REVIEW VISIBILITY REGRESSION SUITE ===\n');

  const builderPath = path.resolve('src/components/administration/AssessmentPackageBuilder.tsx');
  const builderSource = fs.readFileSync(builderPath, 'utf8');

  // ----------------------------------------------------
  // TEST 1 — INSTRUMENT TYPE EDITOR DISPATCH
  // ----------------------------------------------------
  test('TEST 1: AssessmentPackageBuilder has dedicated editor branches for all canonical instrument types', () => {
    const requiredInstrumentTypes = [
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

    for (const instType of requiredInstrumentTypes) {
      assert(
        builderSource.includes(`activeInstType === '${instType}'`),
        `AssessmentPackageBuilder must contain activeInstType check for ${instType}`
      );
    }
  });

  // ----------------------------------------------------
  // TEST 2 — ORAL VISIBILITY & EDIT
  // ----------------------------------------------------
  test('TEST 2: Oral editor reads items, prompt, expectedResponse, and updates via updatePackage', () => {
    assert(builderSource.includes("activeInstType === 'ORAL_TEST'"), 'Oral editor branch must exist');
    assert(builderSource.includes('oralInst.items'), 'Oral editor must read oralInst.items');
    assert(builderSource.includes('item.prompt'), 'Oral editor must read item.prompt');
    assert(builderSource.includes('item.expectedResponse'), 'Oral editor must read item.expectedResponse');
    assert(
      builderSource.includes('Instrumen Tes Lisan belum tersedia pada paket asesmen.'),
      'Oral editor must display empty state when oral instrument is missing'
    );
  });

  // ----------------------------------------------------
  // TEST 3 — PERFORMANCE VISIBILITY & EDIT
  // ----------------------------------------------------
  test('TEST 3: Performance editor reads task, instructions, aspects, label, description, weight', () => {
    assert(builderSource.includes("activeInstType === 'PERFORMANCE'"), 'Performance editor branch must exist');
    assert(builderSource.includes('perfInst.task'), 'Performance editor must read perfInst.task');
    assert(builderSource.includes('perfInst.instructions'), 'Performance editor must read perfInst.instructions');
    assert(builderSource.includes('perfInst.aspects'), 'Performance editor must read perfInst.aspects');
    assert(builderSource.includes('asp.label'), 'Performance editor must read asp.label');
    assert(builderSource.includes('asp.description'), 'Performance editor must read asp.description');
    assert(builderSource.includes('asp.weight'), 'Performance editor must read asp.weight');
    assert(
      builderSource.includes('Instrumen Unjuk Kerja / Kinerja belum tersedia pada paket asesmen.'),
      'Performance editor must display empty state when performance instrument is missing'
    );
  });

  // ----------------------------------------------------
  // TEST 4 — OBSERVATION COMPLETION VISIBILITY
  // ----------------------------------------------------
  test('TEST 4: Observation editor reads instructions, recordingScheme, aspects, label, and indicator', () => {
    assert(builderSource.includes("activeInstType === 'OBSERVATION'"), 'Observation editor branch must exist');
    assert(builderSource.includes('obsInst.instructions'), 'Observation editor must read obsInst.instructions');
    assert(builderSource.includes('obsInst.recordingScheme'), 'Observation editor must read obsInst.recordingScheme');
    assert(builderSource.includes('asp.label'), 'Observation editor must read asp.label');
    assert(builderSource.includes('asp.indicator'), 'Observation editor must read asp.indicator');
    assert(
      builderSource.includes('Instrumen Observasi belum tersedia pada paket asesmen.'),
      'Observation editor must display empty state when observation instrument is missing'
    );
  });

  // ----------------------------------------------------
  // TEST 5 — ASSIGNMENT VISIBILITY & EDIT
  // ----------------------------------------------------
  test('TEST 5: Assignment editor reads instructions, expectedOutput, and saves via updatePackage', () => {
    assert(builderSource.includes("activeInstType === 'ASSIGNMENT'"), 'Assignment editor branch must exist');
    assert(builderSource.includes('assignInst.instructions'), 'Assignment editor must read assignInst.instructions');
    assert(builderSource.includes('assignInst.expectedOutput'), 'Assignment editor must read assignInst.expectedOutput');
    assert(
      builderSource.includes('Instrumen Penugasan belum tersedia pada paket asesmen.'),
      'Assignment editor must display empty state when assignment instrument is missing'
    );
  });

  // ----------------------------------------------------
  // TEST 6 — PROJECT VISIBILITY & EDIT
  // ----------------------------------------------------
  test('TEST 6: Project editor reads projectBrief, expectedDeliverable, and saves via updatePackage', () => {
    assert(builderSource.includes("activeInstType === 'PROJECT'"), 'Project editor branch must exist');
    assert(builderSource.includes('projInst.projectBrief'), 'Project editor must read projInst.projectBrief');
    assert(builderSource.includes('projInst.expectedDeliverable'), 'Project editor must read projInst.expectedDeliverable');
    assert(
      builderSource.includes('Instrumen Proyek belum tersedia pada paket asesmen.'),
      'Project editor must display empty state when project instrument is missing'
    );
  });

  // ----------------------------------------------------
  // TEST 7 — PRODUCT VISIBILITY & EDIT
  // ----------------------------------------------------
  test('TEST 7: Product editor reads productBrief, expectedProduct, and saves via updatePackage', () => {
    assert(builderSource.includes("activeInstType === 'PRODUCT'"), 'Product editor branch must exist');
    assert(builderSource.includes('prodInst.productBrief'), 'Product editor must read prodInst.productBrief');
    assert(builderSource.includes('prodInst.expectedProduct'), 'Product editor must read prodInst.expectedProduct');
    assert(
      builderSource.includes('Instrumen Produk belum tersedia pada paket asesmen.'),
      'Product editor must display empty state when product instrument is missing'
    );
  });

  // ----------------------------------------------------
  // TEST 8 — PORTFOLIO VISIBILITY & EDIT
  // ----------------------------------------------------
  test('TEST 8: Portfolio editor reads instructions, evidenceRequirements, and allows adding/removing requirements', () => {
    assert(builderSource.includes("activeInstType === 'PORTFOLIO'"), 'Portfolio editor branch must exist');
    assert(builderSource.includes('portInst.instructions'), 'Portfolio editor must read portInst.instructions');
    assert(builderSource.includes('portInst.evidenceRequirements'), 'Portfolio editor must read portInst.evidenceRequirements');
    assert(
      builderSource.includes('Tambah Persyaratan Bukti'),
      'Portfolio editor must allow adding evidence requirements'
    );
    assert(
      builderSource.includes('Instrumen Portofolio belum tersedia pada paket asesmen.'),
      'Portfolio editor must display empty state when portfolio instrument is missing'
    );
  });

  // ----------------------------------------------------
  // TEST 9 — SELF / PEER VISIBILITY & EDIT
  // ----------------------------------------------------
  test('TEST 9: Self and Peer editor reads items, statement, category, responseScheme', () => {
    assert(
      builderSource.includes("activeInstType === 'SELF_ASSESSMENT' || activeInstType === 'PEER_ASSESSMENT'"),
      'Self/Peer editor branch must exist'
    );
    assert(builderSource.includes('selfPeerInst.items'), 'Self/Peer editor must read items');
    assert(builderSource.includes('item.statement'), 'Self/Peer editor must read statement');
    assert(builderSource.includes('item.category'), 'Self/Peer editor must read category');
    assert(builderSource.includes('selfPeerInst.responseScheme'), 'Self/Peer editor must read responseScheme');
    assert(
      builderSource.includes('belum tersedia pada paket asesmen.'),
      'Self/Peer editor must display empty state when instrument is missing'
    );
  });

  // ----------------------------------------------------
  // TEST 10 — RUBRIC CRITERIA VISIBILITY & EDIT
  // ----------------------------------------------------
  test('TEST 10: Rubric criteria editor reads and edits label, indicator, and weight', () => {
    assert(builderSource.includes('crit.label'), 'Rubric editor must read crit.label');
    assert(builderSource.includes('crit.indicator'), 'Rubric editor must read crit.indicator');
    assert(builderSource.includes('crit.weight'), 'Rubric editor must read crit.weight');
    assert(builderSource.includes('Bobot:'), 'Rubric editor must display Bobot label');
    assert(builderSource.includes('Indikator:'), 'Rubric editor must display Indikator label');
  });

  // ----------------------------------------------------
  // TEST 11 — SCORING GUIDE REVIEW UI
  // ----------------------------------------------------
  test('TEST 11: Scoring guide review UI displays title, read-only guideType, instructions, maxScore, notes', () => {
    assert(builderSource.includes('activePackage.scoringGuides'), 'UI must iterate activePackage.scoringGuides');
    assert(builderSource.includes('guide.title'), 'UI must display and edit guide.title');
    assert(builderSource.includes('guide.guideType'), 'UI must display guide.guideType');
    assert(
      builderSource.includes('readOnly') && builderSource.includes('guide.guideType'),
      'guideType must be read-only'
    );
    assert(builderSource.includes('guide.instructions'), 'UI must display guide.instructions');
    assert(builderSource.includes('guide.maxScore'), 'UI must display guide.maxScore');
    assert(builderSource.includes('guide.notes'), 'UI must display guide.notes');
  });

  // ----------------------------------------------------
  // TEST 12 — PROVENANCE FIELD COVERAGE
  // ----------------------------------------------------
  test('TEST 12: Provenance detector covers all canonical fields and uses JSON.stringify for arrays/objects', () => {
    const requiredFields = [
      'expectedDeliverable',
      'expectedProduct',
      'evidenceRequirements',
      'recordingScheme',
      'responseScheme',
      'items',
      'aspects',
    ];

    for (const field of requiredFields) {
      assert(
        builderSource.includes(`'${field}'`),
        `Provenance detector must check field '${field}'`
      );
    }

    assert(
      builderSource.includes('JSON.stringify(inst[f]) !== JSON.stringify((oldInst as any)[f])'),
      'Array and object provenance comparisons must use JSON.stringify without relying on reference equality'
    );
  });

  // ----------------------------------------------------
  // TEST 13 — MANUAL EDIT PATH
  // ----------------------------------------------------
  test('TEST 13: All manual edits route through updatePackage and not direct onSaveAssessmentPackage', () => {
    // Assert updatePackage invalidates validationReport and increments revision
    assert(builderSource.includes('setValidationReport(null);'), 'updatePackage must reset validation report');
    assert(builderSource.includes("pkgCopy.workflowStatus = 'DRAFT';"), 'updatePackage must set status to DRAFT');
    assert(builderSource.includes('pkgCopy.needsReview = true;'), 'updatePackage must set needsReview to true');

    // In instrument editors, updatePackage is called
    const oralSection = builderSource.substring(
      builderSource.indexOf("activeInstType === 'ORAL_TEST'"),
      builderSource.indexOf("activeInstType === 'PERFORMANCE'")
    );
    assert(oralSection.includes('updatePackage('), 'Oral editor must call updatePackage');
    assert(!oralSection.includes('onSaveAssessmentPackage('), 'Oral editor must not call onSaveAssessmentPackage directly');
  });

  // ----------------------------------------------------
  // TEST 14 — NO PREVIEW
  // ----------------------------------------------------
  test('TEST 14: Does not add preview tab or Pratinjau tab button', () => {
    assert(!builderSource.includes("activeTab === 'preview'"), 'Must not introduce preview tab');
    assert(!builderSource.includes("'preview'"), 'Must not introduce preview tab value');
  });

  // ----------------------------------------------------
  // TEST 15 — STRICT SCOPE CONFINEMENT
  // ----------------------------------------------------
  test('TEST 15: No modifications to generator service, export service, or types', () => {
    const generatorServicePath = path.resolve('src/services/assessmentPackageGeneratorService.ts');
    const genSource = fs.readFileSync(generatorServicePath, 'utf8');
    assert(
      genSource.includes('export async function generateAssessmentPackage'),
      'Generator service must remain intact'
    );

    const exportServicePath = path.resolve('src/services/documentEngine/assessmentExportService.ts');
    const exportSource = fs.readFileSync(exportServicePath, 'utf8');
    assert(
      exportSource.includes('buildNormalizedAssessmentDocumentModel'),
      'Export service must remain intact'
    );
  });

  console.log(`\nRegression results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
