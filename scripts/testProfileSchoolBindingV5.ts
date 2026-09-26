import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  createInitialStorageV5,
  loadStorageV5,
  saveStorageV5,
  resetStorageV5,
  createProfileV5,
  updateProfileV5,
  createSchoolV5,
  setActiveProfileV5,
} from '../src/services/storageV5';
import { getRuntimeContextV5 } from '../src/services/runtimeV5';

// Mock localStorage in Node environment
class MockLocalStorage {
  private store: Map<string, string> = new Map();
  public readCount = 0;
  public writeCount = 0;

  getItem(key: string): string | null {
    this.readCount++;
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.writeCount++;
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.readCount = 0;
    this.writeCount = 0;
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] || null;
  }
}

const mockStorage = new MockLocalStorage();
(globalThis as any).localStorage = mockStorage;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(error);
    process.exit(1);
  }
}

console.log('--- RUNNING PROFILE ↔ SEKOLAH UTAMA BINDING V5 REGRESSION ---\n');

// 1. Multi-school master allows multiple schools without auto-reassignment
runTest('1. Multi-school master: multiple schools can exist simultaneously in schools[]', () => {
  resetStorageV5();
  const schoolA = createSchoolV5({
    name: 'SD Negeri 1 Jakarta',
    npsn: '10101001',
    address: 'Jl. Merdeka No. 1',
    village: 'Gambir',
    district: 'Gambir',
    regency: 'Jakarta Pusat',
    province: 'DKI Jakarta',
    principalName: 'Budi Santoso, M.Pd.',
    principalNip: '197501012000031001',
  });
  const schoolB = createSchoolV5({
    name: 'SMP Negeri 2 Bandung',
    npsn: '10101002',
    address: 'Jl. Asia Afrika No. 2',
    village: 'Braga',
    district: 'Sumur Bandung',
    regency: 'Kota Bandung',
    province: 'Jawa Barat',
    principalName: 'Dewi Lestari, S.Pd.',
    principalNip: '198002022005012002',
  });
  const schoolC = createSchoolV5({
    name: 'SMA Negeri 3 Surabaya',
    npsn: '10101003',
    address: 'Jl. Pemuda No. 3',
    village: 'Embong Kaliasin',
    district: 'Genteng',
    regency: 'Kota Surabaya',
    province: 'Jawa Timur',
    principalName: 'Ahmad Fauzi, M.Si.',
    principalNip: '197803032002121003',
  });

  const state = loadStorageV5();
  assert.strictEqual(state.schools.length, 3, 'Master schools array must contain 3 schools');
  assert.ok(state.schools.some((s) => s.id === schoolA.id));
  assert.ok(state.schools.some((s) => s.id === schoolB.id));
  assert.ok(state.schools.some((s) => s.id === schoolC.id));
});

// 2. Profile owns primary school: each profile binds to exactly one schoolId
runTest('2. Profile owns primary school: Guru A -> School A, Guru B -> School B, Guru C -> School A', () => {
  const state = loadStorageV5();
  const [schA, schB] = state.schools;

  const profA = createProfileV5({
    name: 'Guru A (SD 1)',
    nip: '198501012010011001',
    status: 'PNS',
    defaultLevel: 'SD',
    defaultSubject: 'Matematika',
    schoolId: schA.id,
  });

  const profB = createProfileV5({
    name: 'Guru B (SMP 2)',
    nip: '199002022015022002',
    status: 'PPPK',
    defaultLevel: 'SMP',
    defaultSubject: 'IPA',
    schoolId: schB.id,
  });

  const profC = createProfileV5({
    name: 'Guru C (SD 1)',
    nip: '199203032018031003',
    status: 'Guru Tetap Yayasan (GTY)',
    defaultLevel: 'SD',
    defaultSubject: 'Bahasa Indonesia',
    schoolId: schA.id,
  });

  assert.strictEqual(profA.schoolId, schA.id);
  assert.strictEqual(profB.schoolId, schB.id);
  assert.strictEqual(profC.schoolId, schA.id);
});

// 3. Switching active profile switches resolved active school to activeProfile.schoolId
runTest('3. Active school strictly follows activeProfile.schoolId upon profile selection', () => {
  const state = loadStorageV5();
  const profA = state.profiles.find((p) => p.name.includes('Guru A'))!;
  const profB = state.profiles.find((p) => p.name.includes('Guru B'))!;
  const schA = state.schools.find((s) => s.id === profA.schoolId)!;
  const schB = state.schools.find((s) => s.id === profB.schoolId)!;

  // Select Guru A
  setActiveProfileV5(profA.id);
  let ctx = getRuntimeContextV5();
  assert.strictEqual(ctx.activeProfile?.id, profA.id);
  assert.strictEqual(ctx.activeSchool?.id, schA.id);
  assert.strictEqual(ctx.activeSchool?.name, schA.name);

  // Switch to Guru B
  setActiveProfileV5(profB.id);
  ctx = getRuntimeContextV5();
  assert.strictEqual(ctx.activeProfile?.id, profB.id);
  assert.strictEqual(ctx.activeSchool?.id, schB.id);
  assert.strictEqual(ctx.activeSchool?.name, schB.name);
});

// 4. Adding a new school does NOT automatically overwrite active profile's schoolId
runTest('4. Adding a new school does NOT automatically change activeProfile.schoolId', () => {
  const stateBefore = loadStorageV5();
  const activeProfileBefore = stateBefore.profiles.find((p) => p.id === stateBefore.activeProfileId)!;
  const originalSchoolId = activeProfileBefore.schoolId;

  const schoolNew = createSchoolV5({
    name: 'SD Negeri Baru 99',
    npsn: '10101099',
    address: 'Jl. Baru No. 99',
    village: 'Baru',
    district: 'Kecamatan Baru',
    regency: 'Kabupaten Baru',
    province: 'Provinsi Baru',
    principalName: 'Kepsek Baru, M.Pd.',
    principalNip: '198101012005011005',
  });

  const stateAfter = loadStorageV5();
  const activeProfileAfter = stateAfter.profiles.find((p) => p.id === stateAfter.activeProfileId)!;

  assert.strictEqual(activeProfileAfter.schoolId, originalSchoolId, 'Profile schoolId must remain unchanged');
  assert.notStrictEqual(activeProfileAfter.schoolId, schoolNew.id, 'Profile must NOT auto-switch to new school');
});

// 5. App.tsx enforces activeProfile.schoolId for workspace creation authority
runTest('5. App.tsx source contract: Administration / Workspace creation strictly requires activeProfile.schoolId', () => {
  const appPath = path.resolve(process.cwd(), 'src/App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf-8');

  // Verify openNewWorkspaceModal check
  assert.ok(
    !appSource.includes('!activeProfile.schoolId && !activeSchool?.id'),
    'openNewWorkspaceModal must not use fallback to activeSchool?.id'
  );
  assert.ok(
    appSource.includes('if (!activeProfile.schoolId)'),
    'openNewWorkspaceModal must check activeProfile.schoolId directly'
  );

  // Verify handleCreateNewWorkspace check
  assert.ok(
    !appSource.includes('const targetSchoolId = activeProfile.schoolId || activeSchool?.id;'),
    'handleCreateNewWorkspace must not use fallback to activeSchool?.id'
  );
  assert.ok(
    appSource.includes('const targetSchoolId = activeProfile.schoolId;'),
    'handleCreateNewWorkspace must assign targetSchoolId strictly from activeProfile.schoolId'
  );
});

// 6. ProfileManager.tsx source contract: No false fallbacks, placeholder present, and school validation enforced
runTest('6. ProfileManager.tsx source contract: No false fallbacks and explicit placeholders', () => {
  const pmPath = path.resolve(process.cwd(), 'src/components/ProfileManager.tsx');
  const pmSource = fs.readFileSync(pmPath, 'utf-8');

  // Verify no false fallback on activeProfile.schoolId || activeSchool.id
  assert.ok(
    !pmSource.includes('value={activeProfile.schoolId || activeSchool.id}'),
    'select-profile-primary-school must not fallback to activeSchool.id'
  );
  assert.ok(
    pmSource.includes('value={activeProfile.schoolId || \'\'}'),
    'select-profile-primary-school must bind directly to activeProfile.schoolId || \'\''
  );

  // Verify no false fallback on profileForm.schoolId || activeSchool.id
  assert.ok(
    !pmSource.includes('value={profileForm.schoolId || activeSchool.id}'),
    'select-teacher-school-modal must not fallback to activeSchool.id'
  );
  assert.ok(
    pmSource.includes('value={profileForm.schoolId || \'\'}'),
    'select-teacher-school-modal must bind directly to profileForm.schoolId || \'\''
  );

  // Verify explicit placeholders
  const placeholderMatches = pmSource.match(/<option value="">Pilih Sekolah Utama\.\.\.<\/option>/g);
  assert.ok(
    placeholderMatches && placeholderMatches.length >= 2,
    'Both primary school and modal school dropdowns must include placeholder option'
  );

  // Verify empty schools warning
  assert.ok(
    pmSource.includes('Belum ada sekolah. Tambahkan sekolah terlebih dahulu sebelum menyimpan profil.'),
    'Modal must inform user when no schools exist'
  );

  // Verify validation: schoolId required when saving profile
  assert.ok(
    pmSource.includes('!profileForm.schoolId') || pmSource.includes('!profileForm.schoolId.trim()'),
    'handleSaveProfileSubmit must validate that schoolId is chosen'
  );
});

// 7. Profile without schoolId: does not resolve a fake school in runtime model
runTest('7. Runtime read model: profile without schoolId resolves activeSchool as undefined (no fake school)', () => {
  const state = loadStorageV5();
  const unboundProf = createProfileV5({
    name: 'Guru Tanpa Sekolah',
    nip: '199505052020051005',
    status: 'PNS',
    defaultLevel: 'SMA',
    defaultSubject: 'Fisika',
  });

  setActiveProfileV5(unboundProf.id);
  const ctx = getRuntimeContextV5();
  assert.strictEqual(ctx.activeProfile?.id, unboundProf.id);
  assert.strictEqual(ctx.activeProfile?.schoolId, undefined);
  assert.strictEqual(ctx.activeSchool, undefined, 'activeSchool must be undefined for unbound profile');
});

// 8. ProfileManager UI contract: Explicit empty state and guards for unbound school
runTest('8. ProfileManager.tsx source contract: Explicit empty state message and UI guards for unbound school', () => {
  const pmPath = path.resolve(process.cwd(), 'src/components/ProfileManager.tsx');
  const pmSource = fs.readFileSync(pmPath, 'utf-8');

  // Verify explicit empty state text
  assert.ok(
    pmSource.includes('Profil ini belum memiliki Sekolah Utama.'),
    'ProfileManager must render exact message: "Profil ini belum memiliki Sekolah Utama."'
  );
  assert.ok(
    pmSource.includes('Pilih sekolah dari daftar master di bawah, atau tambahkan sekolah baru terlebih dahulu.'),
    'ProfileManager must render instruction: "Pilih sekolah dari daftar master di bawah, atau tambahkan sekolah baru terlebih dahulu."'
  );

  // Verify edit school button is guarded by actual profileSchool
  assert.ok(
    pmSource.includes('{profileSchool && (\n                  <button\n                    id="btn-edit-school"') ||
    pmSource.includes('profileSchool &&') && pmSource.includes('btn-edit-school'),
    'Ubah Data Sekolah button must be conditionally rendered only when profileSchool exists'
  );

  // Verify principal history is guarded by actual profileSchool
  assert.ok(
    pmSource.includes('Pilih Sekolah Utama terlebih dahulu untuk mengelola data Kepala Sekolah.'),
    'Principal History card must show placeholder message when no profileSchool is bound'
  );
});

console.log('\nAll Profile ↔ Sekolah Utama Binding contract tests PASSED successfully!\n');
