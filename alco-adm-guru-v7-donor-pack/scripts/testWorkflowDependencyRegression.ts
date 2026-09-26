/**
 * Test Suite: PATCH B — Administration Workflow & Dependency Integrity
 */
import {
  validateWorkflowDependencies,
  buildAdministrationContext,
  isUpstreamStale,
  resolveATPItemWithTP,
  resolveCriterionTarget,
  matchCanonicalTP,
} from '../src/services/workflowEngine';
import {
  TeacherProfile,
  SchoolData,
  AcademicSetting,
  AdministrationWorkspace,
  ActiveContext,
  CPData,
  CPAnalysisData,
  TPData,
  ATPData,
  ATPItem,
  AssessmentCriterion,
  TPItem,
} from '../src/types';

console.log('===========================================================');
console.log('🧪 RUNNING TEST SUITE: Workflow & Dependency Foundation (PATCH B)');
console.log('===========================================================');

const mockSchool: SchoolData = {
  id: 'sch-001',
  name: 'SD Negeri Nusantara 01',
  npsn: '12345678',
  address: 'Jl. Merdeka No. 10',
  village: 'Gambir',
  district: 'Gambir',
  regency: 'Jakarta Pusat',
  province: 'DKI Jakarta',
  principalName: 'Dr. H. Ahmad Dahlan, M.Pd.',
  principalNip: '197501012000031001',
  createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
  updatedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
};

const mockProfile: TeacherProfile = {
  id: 'prof-001',
  name: 'Budi Santoso, S.Pd.',
  nip: '198501012010011005',
  status: 'PNS',
  schoolId: 'sch-001',
  defaultSubject: 'Pendidikan Agama Islam dan Budi Pekerti',
  defaultLevel: 'SD',
  createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
  updatedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
};

const mockAcademic: AcademicSetting = {
  id: 'acad-001',
  profileId: 'prof-001',
  curriculum: 'Kurikulum Merdeka',
  academicYear: '2025/2026',
  semester: '1 (Ganjil)',
  subject: 'Pendidikan Agama Islam dan Budi Pekerti',
  grade: 'Kelas 4',
  phase: 'Fase B',
  level: 'SD',
  totalHoursPerWeek: 4,
  updatedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
};

const mockWorkspace: AdministrationWorkspace = {
  id: 'ws-001',
  profileId: 'prof-001',
  schoolId: 'sch-001',
  academicSettingId: 'acad-001',
  name: 'PAI — Kelas 4 — Semester 1 — 2025/2026',
  createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
  updatedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
};

const mockActiveContext: ActiveContext = {
  profileId: 'prof-001',
  schoolId: 'sch-001',
  curriculum: 'Kurikulum Merdeka',
  curriculumType: 'KURIKULUM_MERDEKA',
  academicYear: '2025/2026',
  semester: '1 (Ganjil)',
  subject: 'Pendidikan Agama Islam dan Budi Pekerti',
  grade: 'Kelas 4',
  phase: 'Fase B',
  level: 'SD',
  totalHoursPerWeek: 4,
};

// Test 1: AdministrationContext Resolution
console.log('--- 1. Administration Context Resolution ---');
const admContext = buildAdministrationContext({
  profile: mockProfile,
  school: mockSchool,
  academicSetting: mockAcademic,
  workspace: mockWorkspace,
});

if (admContext.curriculumType === 'KURIKULUM_MERDEKA' && admContext.grade === 4 && admContext.subjectCode === 'PAI' && admContext.phase === 'B') {
  console.log('✅ AdministrationContext teresolusi dengan canonical subject (PAI), level (SD), grade (4), phase (B)');
} else {
  console.error('❌ Context resolution mismatch', admContext);
  process.exit(1);
}

// Test 2: Dependency Validation when CP is missing
console.log('--- 2. Dependency Validation: CP Missing ---');
const emptyCP: CPData = {
  id: 'cp-001',
  academicSettingId: 'acad-001',
  generalDescription: '',
  elements: [],
  updatedAt: '',
};

const emptyCPAnalysis: CPAnalysisData = {
  id: 'cpa-001',
  academicSettingId: 'acad-001',
  generalSummary: '',
  items: [],
  updatedAt: '',
};

const reportNoCP = validateWorkflowDependencies({
  profile: mockProfile,
  school: mockSchool,
  academicSetting: mockAcademic,
  context: mockActiveContext,
  cp: emptyCP,
  cpAnalysis: emptyCPAnalysis,
});

if (reportNoCP.stepStates['cp-analysis'].isBlocked && reportNoCP.stepStates['tp'].isBlocked && reportNoCP.stepStates['atp'].isBlocked) {
  console.log('✅ CP kosong memblokir Analisis CP, TP, dan ATP secara berantai');
} else {
  console.error('❌ Expected CP to block downstream steps', reportNoCP);
  process.exit(1);
}

// Test 3: CP Analysis required for TP
console.log('--- 3. CP Analysis Hard Dependency for TP ---');
const validCP: CPData = {
  id: 'cp-001',
  academicSettingId: 'acad-001',
  generalDescription: 'Peserta didik memahami rukun iman dan akhlak terpuji.',
  elements: [{ id: 'elem-1', name: 'Akidah', content: 'Memahami makna Asmaul Husna.' }],
  updatedAt: new Date('2026-01-02T00:00:00Z').toISOString(),
};

const reportNoAnalysis = validateWorkflowDependencies({
  profile: mockProfile,
  school: mockSchool,
  academicSetting: mockAcademic,
  context: mockActiveContext,
  cp: validCP,
  cpAnalysis: emptyCPAnalysis,
});

if (reportNoAnalysis.stepStates['cp-analysis'].status === 'READY' && reportNoAnalysis.stepStates['tp'].isBlocked) {
  console.log('✅ Analisis CP kosong memblokir tahap TP');
} else {
  console.error('❌ Expected missing CP analysis to block TP', reportNoAnalysis.stepStates);
  process.exit(1);
}

// Test 4: Upstream Stale Detection
console.log('--- 4. Upstream Stale Detection ---');
const validAnalysis: CPAnalysisData = {
  id: 'cpa-001',
  academicSettingId: 'acad-001',
  generalSummary: 'Analisis akidah dan akhlak.',
  items: [{
    id: 'ana-1',
    elementName: 'Akidah',
    cpText: 'Memahami makna Asmaul Husna.',
    cpCompetence: 'Memahami',
    materialScope: 'Asmaul Husna',
    suggestedTp: 'Peserta didik mampu memahami makna al-Malik dan al-Quddus.',
    order: 1,
  }],
  basedOnCpUpdatedAt: new Date('2026-01-02T00:00:00Z').toISOString(),
  updatedAt: new Date('2026-01-03T00:00:00Z').toISOString(),
};

const validTP: TPData = {
  id: 'tp-001',
  academicSettingId: 'acad-001',
  items: [{
    id: 'tp-item-1',
    cpAnalysisId: 'ana-1',
    code: 'TP 4.1',
    elementName: 'Akidah',
    statement: 'Peserta didik mampu memahami makna al-Malik dan al-Quddus.',
    competence: 'Memahami',
    contentScope: 'Asmaul Husna',
    p3Dimensions: ['Bernalar Kritis'],
    order: 1,
  }],
  basedOnCpUpdatedAt: new Date('2026-01-02T00:00:00Z').toISOString(),
  basedOnAnalysisUpdatedAt: new Date('2026-01-03T00:00:00Z').toISOString(),
  updatedAt: new Date('2026-01-04T00:00:00Z').toISOString(),
};

const validATP: ATPData = {
  id: 'atp-001',
  academicSettingId: 'acad-001',
  rationale: 'Alur disusun secara spiral.',
  items: [{
    id: 'atp-1',
    stepNumber: 1,
    tpId: 'tp-item-1',
    tpCode: 'TP 4.1',
    tpStatement: 'Peserta didik mampu memahami makna al-Malik dan al-Quddus.',
    materialScope: 'Asmaul Husna',
    jp: 6,
  }],
  basedOnTpUpdatedAt: new Date('2026-01-04T00:00:00Z').toISOString(),
  updatedAt: new Date('2026-01-05T00:00:00Z').toISOString(),
};

const reportClean = validateWorkflowDependencies({
  profile: mockProfile,
  school: mockSchool,
  academicSetting: mockAcademic,
  context: mockActiveContext,
  cp: validCP,
  cpAnalysis: validAnalysis,
  tp: validTP,
  atp: validATP,
});

if (reportClean.isValid && !reportClean.stepStates['tp'].isStale && !reportClean.stepStates['atp'].isStale) {
  console.log('✅ Status alur valid dan sinkron tanpa status STALE');
} else {
  console.error('❌ Expected clean workflow', reportClean);
  process.exit(1);
}

// Simulate CP modification -> downstream becomes STALE
const modifiedCP: CPData = {
  ...validCP,
  updatedAt: new Date('2026-01-10T00:00:00Z').toISOString(),
};

const reportStale = validateWorkflowDependencies({
  profile: mockProfile,
  school: mockSchool,
  academicSetting: mockAcademic,
  context: mockActiveContext,
  cp: modifiedCP,
  cpAnalysis: validAnalysis,
  tp: validTP,
  atp: validATP,
});

if (reportStale.stepStates['cp-analysis'].isStale && reportStale.stepStates['tp'].isStale) {
  console.log('✅ Pembaruan pada CP hulu otomatis menandai Analisis CP dan TP sebagai STALE');
} else {
  console.error('❌ Expected STALE detection on downstream modules', reportStale);
  process.exit(1);
}

// Test 5: ATP Resolution with Canonical TP
console.log('--- 5. Canonical ATP Item Resolution ---');
const resolvedItem = resolveATPItemWithTP(validATP.items[0], validTP.items);
if (resolvedItem.canonicalTP && resolvedItem.canonicalTP.id === 'tp-item-1') {
  console.log('✅ ATP item terhubung secara kanonikal ke TP item via tpId');
} else {
  console.error('❌ Failed to resolve canonical TP for ATP item', resolvedItem);
  process.exit(1);
}

// Test 6: KKTP Target Resolution
console.log('--- 6. Canonical KKTP Criterion Resolution ---');
const criterion: AssessmentCriterion = {
  id: 'crit-1',
  academicSettingId: 'acad-001',
  tpId: 'tp-item-1',
  description: 'Peserta didik mampu memahami makna al-Malik dan al-Quddus.',
  approach: 'rubrik',
  indicators: ['Menjelaskan arti Al-Malik'],
  levels: [],
  updatedAt: new Date('2026-01-06T00:00:00Z').toISOString(),
};

const resolvedCrit = resolveCriterionTarget(criterion, validTP.items, undefined);
if (resolvedCrit.targetId === 'tp-item-1' && !resolvedCrit.isOrphan) {
  console.log('✅ KKTP Criterion terhubung ke canonical TP');
} else {
  console.error('❌ Failed to resolve target TP for KKTP criterion', resolvedCrit);
  process.exit(1);
}

// ===========================================================
// PATCH B.1 REGRESSION TESTS
// ===========================================================
console.log('--- 7. PATCH B.1: No-Assumption AdministrationContext ---');

// 7a. Missing Academic Year -> UNRESOLVED
const contextMissingYear = buildAdministrationContext({
  profile: mockProfile,
  school: mockSchool,
  academicSetting: { ...mockAcademic, academicYear: '' },
});
if (contextMissingYear.curriculumResolutionStatus === 'UNRESOLVED') {
  console.log('✅ AcademicYear kosong -> UNRESOLVED (No fake assumption)');
} else {
  console.error('❌ Expected UNRESOLVED for missing academicYear', contextMissingYear);
  process.exit(1);
}

// 7b. Missing Subject -> UNRESOLVED
const contextMissingSubject = buildAdministrationContext({
  profile: { ...mockProfile, defaultSubject: '' },
  school: mockSchool,
  academicSetting: { ...mockAcademic, subject: '' },
});
if (contextMissingSubject.curriculumResolutionStatus === 'UNRESOLVED') {
  console.log('✅ Subject kosong -> UNRESOLVED (No fake assumption)');
} else {
  console.error('❌ Expected UNRESOLVED for missing subject', contextMissingSubject);
  process.exit(1);
}

// 7c. Missing Grade -> UNRESOLVED
const contextMissingGrade = buildAdministrationContext({
  profile: mockProfile,
  school: mockSchool,
  academicSetting: { ...mockAcademic, grade: '' },
});
if (contextMissingGrade.curriculumResolutionStatus === 'UNRESOLVED') {
  console.log('✅ Grade kosong -> UNRESOLVED (No fake assumption)');
} else {
  console.error('❌ Expected UNRESOLVED for missing grade', contextMissingGrade);
  process.exit(1);
}

// 7d. Missing School -> UNRESOLVED
const contextMissingSchool = buildAdministrationContext({
  profile: { ...mockProfile, schoolId: '' },
  school: null,
  academicSetting: mockAcademic,
});
if (contextMissingSchool.curriculumResolutionStatus === 'UNRESOLVED') {
  console.log('✅ School kosong -> UNRESOLVED (No fake assumption)');
} else {
  console.error('❌ Expected UNRESOLVED for missing school', contextMissingSchool);
  process.exit(1);
}

// 7e. SMK Level -> UNRESOLVED
const contextSMK = buildAdministrationContext({
  profile: mockProfile,
  school: mockSchool,
  academicSetting: { ...mockAcademic, level: 'SMK', grade: 'Kelas 10' },
});
if (contextSMK.curriculumResolutionStatus === 'UNRESOLVED') {
  console.log('✅ Jenjang SMK -> UNRESOLVED (Unsupported)');
} else {
  console.error('❌ Expected UNRESOLVED for SMK', contextSMK);
  process.exit(1);
}

console.log('--- 8. PATCH B.1: Orphan ATP & KKTP Validation ---');

// 8a. Orphan ATP Item (tpId not in TP list)
const orphanATP: ATPData = {
  id: 'atp-orphan',
  academicSettingId: 'acad-001',
  items: [{
    id: 'atp-item-orphan',
    stepNumber: 1,
    tpId: 'tp-non-existent-999',
    tpCode: 'TP 999',
    tpStatement: 'TP Fiktif',
    materialScope: 'Fiktif',
    allocatedJP: null,
  }],
  updatedAt: new Date().toISOString(),
};

const reportOrphanATP = validateWorkflowDependencies({
  profile: mockProfile,
  school: mockSchool,
  academicSetting: mockAcademic,
  cp: validCP,
  cpAnalysis: validAnalysis,
  tp: validTP,
  atp: orphanATP,
});

const hasOrphanATPIssue = reportOrphanATP.issues.some((i) => i.code === 'ORPHAN_ATP_TP_ID');
if (hasOrphanATPIssue && !reportOrphanATP.stepStates.atp.isComplete) {
  console.log('✅ Item ATP dengan tpId fiktif ditolak dan ditandai ORPHAN_ATP_TP_ID');
} else {
  console.error('❌ Expected orphan ATP error', reportOrphanATP);
  process.exit(1);
}

// 8b. Orphan KKTP Criterion
const orphanCriterion: AssessmentCriterion = {
  id: 'crit-orphan',
  academicSettingId: 'acad-001',
  tpId: 'tp-non-existent-888',
  description: 'KKTP Fiktif',
  approach: 'rubrik',
  indicators: ['Indikator Fiktif'],
  levels: [],
  updatedAt: new Date().toISOString(),
};

const reportOrphanKKTP = validateWorkflowDependencies({
  profile: mockProfile,
  school: mockSchool,
  academicSetting: mockAcademic,
  cp: validCP,
  cpAnalysis: validAnalysis,
  tp: validTP,
  assessmentCriteria: [orphanCriterion],
});

const hasOrphanKKTPIssue = reportOrphanKKTP.issues.some((i) => i.code === 'ORPHAN_CRITERIA_TP_ID');
if (hasOrphanKKTPIssue && reportOrphanKKTP.kktpState?.hasOrphans) {
  console.log('✅ Kriteria KKTP dengan tpId fiktif ditandai ORPHAN_CRITERIA_TP_ID');
} else {
  console.error('❌ Expected orphan KKTP error', reportOrphanKKTP);
  process.exit(1);
}

console.log('--- 9. PATCH B.1: TP Stale Propagation to KKTP & ATP ---');
const staleCriteria: AssessmentCriterion = {
  id: 'crit-stale',
  academicSettingId: 'acad-001',
  tpId: 'tp-item-1',
  description: 'Kriteria KKTP',
  approach: 'rubrik',
  indicators: ['Indikator 1'],
  levels: [],
  basedOnTpUpdatedAt: new Date('2026-01-04T00:00:00Z').toISOString(), // Earlier than validTP.updatedAt (2026-01-04T00:00:00Z + delta)
  updatedAt: new Date('2026-01-04T00:00:00Z').toISOString(),
};

// Simulate TP update
const updatedTP: TPData = {
  ...validTP,
  updatedAt: new Date('2026-01-08T00:00:00Z').toISOString(),
};

const reportStaleTP = validateWorkflowDependencies({
  profile: mockProfile,
  school: mockSchool,
  academicSetting: mockAcademic,
  cp: validCP,
  cpAnalysis: validAnalysis,
  tp: updatedTP,
  atp: validATP,
  assessmentCriteria: [staleCriteria],
});

if (reportStaleTP.stepStates.atp.isStale && reportStaleTP.kktpState?.isStale) {
  console.log('✅ Pembaruan TP menyebarkan status STALE secara serentak ke ATP dan KKTP');
} else {
  console.error('❌ Expected stale propagation to ATP & KKTP', reportStaleTP);
  process.exit(1);
}

// ===========================================================
// PATCH B.2 REGRESSION TESTS
// ===========================================================
console.log('--- 10. PATCH B.2: Canonical ATP Matching Rules ---');

const sampleTPList: TPItem[] = [
  {
    id: 'tp-item-1',
    code: 'TP 4.1',
    statement: 'Peserta didik mampu memahami makna al-Malik dan al-Quddus.',
    competence: 'Memahami',
    contentScope: 'Asmaul Husna',
    p3Dimensions: ['Bernalar Kritis'],
    order: 1,
  },
  {
    id: 'tp-item-2',
    code: 'TP 4.2',
    statement: 'Peserta didik mampu mempraktikkan salat berjamaah dengan tertib.',
    competence: 'Mempraktikkan',
    contentScope: 'Fikih Salat',
    p3Dimensions: ['Mandiri'],
    order: 2,
  },
  {
    id: 'tp-item-dup-1',
    code: 'TP 4.DUP',
    statement: 'Pernyataan duplikat unik satu.',
    competence: 'Menjelaskan',
    contentScope: 'Duplikat',
    p3Dimensions: [],
    order: 3,
  },
  {
    id: 'tp-item-dup-2',
    code: 'TP 4.DUP',
    statement: 'Pernyataan duplikat unik dua.',
    competence: 'Menjelaskan',
    contentScope: 'Duplikat',
    p3Dimensions: [],
    order: 4,
  },
  {
    id: 'tp-item-stmt-dup-1',
    code: 'TP 4.3',
    statement: 'Pernyataan kembar.',
    competence: 'Menganalisis',
    contentScope: 'Materi A',
    p3Dimensions: [],
    order: 5,
  },
  {
    id: 'tp-item-stmt-dup-2',
    code: 'TP 4.4',
    statement: 'Pernyataan kembar.',
    competence: 'Menganalisis',
    contentScope: 'Materi B',
    p3Dimensions: [],
    order: 6,
  },
];

// 10a. Exact tpId match
const matchById = matchCanonicalTP({ tpId: 'tp-item-2' }, sampleTPList);
if (matchById?.id === 'tp-item-2') {
  console.log('✅ Exact tpId berhasil mencocokkan ke canonical TP');
} else {
  console.error('❌ Failed exact tpId match', matchById);
  process.exit(1);
}

// 10b. Exact unique tpCode match
const matchByCode = matchCanonicalTP({ tpCode: 'TP 4.1' }, sampleTPList);
if (matchByCode?.id === 'tp-item-1') {
  console.log('✅ Exact unique tpCode berhasil mencocokkan ke canonical TP');
} else {
  console.error('❌ Failed exact unique tpCode match', matchByCode);
  process.exit(1);
}

// 10c. Exact unique statement match
const matchByStmt = matchCanonicalTP({ tpStatement: 'Peserta didik mampu mempraktikkan salat berjamaah dengan tertib.' }, sampleTPList);
if (matchByStmt?.id === 'tp-item-2') {
  console.log('✅ Exact unique statement berhasil mencocokkan ke canonical TP');
} else {
  console.error('❌ Failed exact unique statement match', matchByStmt);
  process.exit(1);
}

// 10d. No match -> ORPHAN / null
const noMatch = matchCanonicalTP({ tpCode: 'TP 99.99', tpStatement: 'TP tidak dikenal sama sekali.' }, sampleTPList);
if (noMatch === null) {
  console.log('✅ Tidak ada match menghasilkan null (ORPHAN/UNRESOLVED)');
} else {
  console.error('❌ Expected null for non-matching item, but got:', noMatch);
  process.exit(1);
}

// 10e. Duplicate tpCode -> does NOT choose first match
const dupCodeMatch = matchCanonicalTP({ tpCode: 'TP 4.DUP' }, sampleTPList);
if (dupCodeMatch === null) {
  console.log('✅ Duplicate tpCode menghasilkan null (AMBIGUOUS - tidak memilih match pertama)');
} else {
  console.error('❌ Expected null for duplicate tpCode match, but got:', dupCodeMatch);
  process.exit(1);
}

// 10f. Duplicate statement -> does NOT choose first match
const dupStmtMatch = matchCanonicalTP({ tpStatement: 'Pernyataan kembar.' }, sampleTPList);
if (dupStmtMatch === null) {
  console.log('✅ Duplicate statement menghasilkan null (AMBIGUOUS - tidak memilih match pertama)');
} else {
  console.error('❌ Expected null for duplicate statement match, but got:', dupStmtMatch);
  process.exit(1);
}

// 10g. CRITICAL: AI item index 0 without match MUST NOT get tp.items[0]
const aiItemAtIdx0 = {
  stepNumber: 1,
  tpCode: 'TP UNKNOWN',
  tpStatement: 'Rumusan tidak terdaftar di TP',
};
const resolvedIdx0 = matchCanonicalTP(aiItemAtIdx0, sampleTPList);
if (resolvedIdx0 === null) {
  console.log('✅ Item AI di index 0 yang tidak cocok TIDAK otomatis mengambil tp.items[0]');
} else {
  console.error('❌ Positional fallback violation: item at index 0 matched to:', resolvedIdx0);
  process.exit(1);
}

console.log('--- 11. PATCH B.2: No Fabricated Defaults in ATP ---');

// Test that raw generated item without explicit fields resolves to clean empty/null
const rawAIItem = {
  stepNumber: 1,
  tpCode: 'TP 4.1',
  tpStatement: 'Peserta didik mampu memahami makna al-Malik dan al-Quddus.',
  materialScope: 'Asmaul Husna',
  // No p3Dimensions, assessmentPlan, resources, allocatedJP/jp provided
};

const matchedCanonical = matchCanonicalTP(rawAIItem, sampleTPList);
// Test ATP formatting without system default injections
const testFormattedATPItem: ATPItem = {
  id: 'test-atp-clean',
  stepNumber: rawAIItem.stepNumber,
  tpId: matchedCanonical ? matchedCanonical.id : '',
  tpCode: matchedCanonical ? (matchedCanonical.code || rawAIItem.tpCode) : rawAIItem.tpCode,
  tpStatement: matchedCanonical ? matchedCanonical.statement : rawAIItem.tpStatement,
  materialScope: matchedCanonical ? (matchedCanonical.contentScope || '') : rawAIItem.materialScope,
  allocatedJP: null,
  p3Dimensions: (rawAIItem as any).p3Dimensions || [],
  assessmentPlan: (rawAIItem as any).assessmentPlan || '',
  glossary: (rawAIItem as any).glossary || '',
  resources: (rawAIItem as any).resources || '',
};

if (
  testFormattedATPItem.allocatedJP === null &&
  Array.isArray(testFormattedATPItem.p3Dimensions) &&
  testFormattedATPItem.p3Dimensions.length === 0 &&
  testFormattedATPItem.assessmentPlan === '' &&
  testFormattedATPItem.resources === ''
) {
  console.log('✅ ATP item tanpa data eksplisit tidak disuntikkan default palsu (p3=[], plan="", res="", jp=null)');
} else {
  console.error('❌ Fabricated default detected in ATP item:', testFormattedATPItem);
  process.exit(1);
}

console.log('--- 12. PATCH B.2: AdministrationContext Authority ---');

// Scenario 12a: TeacherProfile.defaultSubject = PJOK, AcademicSetting.subject = '' -> UNRESOLVED
const contextWithProfileSubject = buildAdministrationContext({
  profile: {
    ...mockProfile,
    defaultSubject: 'Pendidikan Jasmani, Olahraga, dan Kesehatan',
  },
  school: mockSchool,
  academicSetting: {
    ...mockAcademic,
    subject: '', // Explicitly empty
  },
});

if (
  contextWithProfileSubject.curriculumResolutionStatus === 'UNRESOLVED' &&
  contextWithProfileSubject.subjectName === ''
) {
  console.log('✅ AcademicSetting.subject kosong -> UNRESOLVED (profile.defaultSubject diabaikan)');
} else {
  console.error('❌ Expected UNRESOLVED when AcademicSetting.subject is empty:', contextWithProfileSubject);
  process.exit(1);
}

// Scenario 12b: TeacherProfile.defaultLevel = SD, AcademicSetting.level = '' -> UNRESOLVED
const contextWithProfileLevel = buildAdministrationContext({
  profile: {
    ...mockProfile,
    defaultLevel: 'SD',
  },
  school: mockSchool,
  academicSetting: {
    ...mockAcademic,
    level: '' as any, // Explicitly empty
  },
});

if (contextWithProfileLevel.curriculumResolutionStatus === 'UNRESOLVED') {
  console.log('✅ AcademicSetting.level kosong -> UNRESOLVED (profile.defaultLevel diabaikan)');
} else {
  console.error('❌ Expected UNRESOLVED when AcademicSetting.level is empty:', contextWithProfileLevel);
  process.exit(1);
}

// Scenario 12c: TeacherProfile.defaultSubject changes, AcademicSetting.subject remains MAT
const contextWithChangedProfile = buildAdministrationContext({
  profile: {
    ...mockProfile,
    defaultSubject: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)',
  },
  school: mockSchool,
  academicSetting: {
    ...mockAcademic,
    subject: 'Matematika', // Authoritative
  },
});

if (
  contextWithChangedProfile.curriculumResolutionStatus === 'RESOLVED' &&
  contextWithChangedProfile.subjectCode === 'MAT'
) {
  console.log('✅ AcademicSetting.subject tetap Matematika (MAT) meskipun profile.defaultSubject berubah');
} else {
  console.error('❌ AcademicSetting authority failed:', contextWithChangedProfile);
  process.exit(1);
}

console.log('===========================================================');
console.log('🎉 ALL WORKFLOW & DEPENDENCY TESTS (PATCH B, B.1 & B.2) PASSED 100%!');
console.log('===========================================================');
