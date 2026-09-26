import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { CPData, CPAnalysisData } from '../src/types';
import {
  getInitialCPAnalysisItems,
  deriveAnalysisItemsFromCP,
} from '../src/components/CPAnalysisManager';

console.log('=== RUNNING AUDIT: MERDEKA CP ANALYSIS INTEGRITY (NO DATA > FAKE DATA) ===\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${totalTests}. ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`[FAIL] ${totalTests}. ${name}:`, err.message);
    throw err;
  }
}

const sampleCP: CPData = {
  id: 'cp-yp-test-01',
  academicSettingId: 'yp-test-01',
  generalDescription: 'Peserta didik menguasai keterampilan gerak dasar dan pola hidup sehat.',
  elements: [
    {
      id: 'elem-1',
      name: 'Terampil Bergerak',
      content: 'Peserta didik mempraktikkan keterampilan gerak fundamental secara efektif.',
    },
    {
      id: 'elem-2',
      name: 'Belajar Melalui Gerak',
      content: 'Peserta didik menerapkan perilaku hidup sehat dalam aktivitas jasmani.',
    },
  ],
  updatedAt: '2026-07-20T10:30:00.000Z',
};

runTest('1. No saved analysis -> initial analysis items are not fabricated', () => {
  // When cpAnalysis is undefined, null, or has empty items
  const itemsUndefined = getInitialCPAnalysisItems(undefined);
  assert.strictEqual(itemsUndefined.length, 0, 'Items must be empty when cpAnalysis is undefined');

  const itemsNull = getInitialCPAnalysisItems(null);
  assert.strictEqual(itemsNull.length, 0, 'Items must be empty when cpAnalysis is null');

  const emptyAnalysis: CPAnalysisData = {
    id: 'cpa-1',
    academicSettingId: 'as-1',
    generalSummary: '',
    items: [],
    updatedAt: '2026-07-20T10:00:00.000Z',
  };
  const itemsEmpty = getInitialCPAnalysisItems(emptyAnalysis);
  assert.strictEqual(itemsEmpty.length, 0, 'Items must be empty when cpAnalysis.items is empty');

  // When real saved analysis items exist, they are preserved
  const realAnalysis: CPAnalysisData = {
    ...emptyAnalysis,
    items: [
      {
        id: 'real-item-1',
        elementName: 'Terampil Bergerak',
        cpText: 'Konten asli',
        cpCompetence: 'Mempraktikkan',
        materialScope: 'Gerak dasar',
        order: 1,
      },
    ],
  };
  const itemsReal = getInitialCPAnalysisItems(realAnalysis);
  assert.strictEqual(itemsReal.length, 1);
  assert.strictEqual(itemsReal[0].id, 'real-item-1');
  assert.strictEqual(itemsReal[0].cpCompetence, 'Mempraktikkan');
});

runTest('2. No automatic "Elemen Utama" synthetic analysis', () => {
  const compPath = path.resolve(process.cwd(), 'src/components/CPAnalysisManager.tsx');
  const compSource = fs.readFileSync(compPath, 'utf-8');

  // Ensure "Elemen Utama" is never synthetically created
  assert.strictEqual(
    compSource.includes('Elemen Utama'),
    false,
    'CPAnalysisManager must not include synthetic "Elemen Utama" default item'
  );

  // Ensure fake pedagogical filler phrases are removed
  assert.strictEqual(
    compSource.includes('Mempraktikkan, memahami, menerapkan, mengevaluasi'),
    false,
    'CPAnalysisManager must not have hardcoded synthetic competence values'
  );
  assert.strictEqual(
    compSource.includes('Peserta didik mampu menerapkan esensi'),
    false,
    'CPAnalysisManager must not have hardcoded synthetic meaningful understanding'
  );
  assert.strictEqual(
    compSource.includes('Peserta didik dapat menguasai keterampilan dasar pada elemen'),
    false,
    'CPAnalysisManager must not have hardcoded synthetic suggested TP'
  );
});

runTest('3. Explicit local derive from CP copies: element identity/name, CP text, order', () => {
  const derived = deriveAnalysisItemsFromCP(sampleCP);
  assert.strictEqual(derived.length, 2, 'Must produce 2 items corresponding to 2 CP elements');

  // Element 1 checks
  assert.strictEqual(derived[0].elementId, 'elem-1');
  assert.strictEqual(derived[0].elementName, 'Terampil Bergerak');
  assert.strictEqual(
    derived[0].cpText,
    'Peserta didik mempraktikkan keterampilan gerak fundamental secara efektif.'
  );
  assert.strictEqual(derived[0].order, 1);

  // Element 2 checks
  assert.strictEqual(derived[1].elementId, 'elem-2');
  assert.strictEqual(derived[1].elementName, 'Belajar Melalui Gerak');
  assert.strictEqual(
    derived[1].cpText,
    'Peserta didik menerapkan perilaku hidup sehat dalam aktivitas jasmani.'
  );
  assert.strictEqual(derived[1].order, 2);
});

runTest('4. Local derive leaves empty: cpCompetence, materialScope (unless direct element name copy), meaningfulUnderstanding, suggestedTp', () => {
  const derived = deriveAnalysisItemsFromCP(sampleCP);

  for (let i = 0; i < derived.length; i++) {
    const item = derived[i];
    assert.strictEqual(
      item.cpCompetence,
      '',
      `Item ${i + 1} cpCompetence must be empty for teacher completion`
    );
    assert.ok(
      item.materialScope === '' || item.materialScope === item.elementName,
      `Item ${i + 1} materialScope must be empty or direct factual copy of elementName`
    );
    assert.strictEqual(
      item.meaningfulUnderstanding || '',
      '',
      `Item ${i + 1} meaningfulUnderstanding must be empty`
    );
    assert.strictEqual(
      item.suggestedTp || '',
      '',
      `Item ${i + 1} suggestedTp must be empty`
    );
  }
});

runTest('5. Local derive does not use: generatedBy: "AI"', () => {
  const compPath = path.resolve(process.cwd(), 'src/components/CPAnalysisManager.tsx');
  const compSource = fs.readFileSync(compPath, 'utf-8');

  // Find handleGenerateFromCP function body
  const match = compSource.match(/const handleGenerateFromCP = \(\) => \{([\s\S]*?)\n  \};/);
  assert.ok(match, 'handleGenerateFromCP must be present in CPAnalysisManager');
  const body = match[1];

  assert.strictEqual(
    body.includes("generatedBy: 'AI'"),
    false,
    'handleGenerateFromCP must NOT set generatedBy: "AI"'
  );
  assert.ok(
    body.includes("generatedBy: 'TEACHER'"),
    'handleGenerateFromCP must set generatedBy: "TEACHER"'
  );
});

runTest('6. Local/manual save uses generatedBy: "TEACHER" or preserves valid previous non-false provenance', () => {
  const compPath = path.resolve(process.cwd(), 'src/components/CPAnalysisManager.tsx');
  const compSource = fs.readFileSync(compPath, 'utf-8');

  // Verify handleSave provenance handling
  const match = compSource.match(/const handleSave = \(\) => \{([\s\S]*?)\n  \};/);
  assert.ok(match, 'handleSave must be present in CPAnalysisManager');
  const body = match[1];

  assert.ok(
    body.includes("nextGeneratedBy") || body.includes("generatedBy"),
    'handleSave must compute generatedBy'
  );
  assert.ok(
    body.includes("'TEACHER'"),
    'handleSave must fallback to TEACHER provenance'
  );
});

runTest('7. basedOnCpUpdatedAt remains tied to current CP timestamp', () => {
  const compPath = path.resolve(process.cwd(), 'src/components/CPAnalysisManager.tsx');
  const compSource = fs.readFileSync(compPath, 'utf-8');

  // Both handleSave and handleGenerateFromCP must tie basedOnCpUpdatedAt to cp.updatedAt
  const matches = compSource.match(/basedOnCpUpdatedAt:\s*cp\.updatedAt/g);
  assert.ok(
    matches && matches.length >= 2,
    'basedOnCpUpdatedAt must reference cp.updatedAt across save and derive handlers'
  );
});

runTest('8. No V5 persistence is introduced in this task', () => {
  const appPath = path.resolve(process.cwd(), 'src/App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');

  // Verify handleSaveCPAnalysis is still no-op in App.tsx
  const match = appSource.match(/const handleSaveCPAnalysis = \(analysis: CPAnalysisData\) => \{([\s\S]*?)\};/);
  assert.ok(match, 'handleSaveCPAnalysis must exist in App.tsx');
  const body = match[1];

  assert.strictEqual(
    body.includes('saveCPAnalysisV5'),
    false,
    'App.tsx must not wire saveCPAnalysisV5 in this task'
  );
  assert.strictEqual(
    /import\s*\{[^}]*saveCPAnalysisV5[^}]*\}\s*from/.test(appSource),
    false,
    'App.tsx must not import saveCPAnalysisV5 in this task'
  );
});

console.log(`\n========================================`);
console.log(`MERDEKA CP ANALYSIS INTEGRITY: ALL ${passedTests}/${totalTests} TESTS PASSED`);
console.log(`========================================\n`);
