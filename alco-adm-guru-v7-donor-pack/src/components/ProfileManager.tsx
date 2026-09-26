import React, { useState, useEffect } from 'react';
import {
  User,
  Plus,
  Edit2,
  Trash2,
  School,
  Check,
  Building2,
  MapPin,
  ShieldCheck,
  Search,
  ArrowRight,
  Info,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Globe,
  History,
  AlertTriangle,
} from 'lucide-react';
import { TeacherProfile, SchoolData, PrincipalHistory } from '../types';
import { EDUCATION_LEVELS } from '../data/curriculumDefaults';
import { SchoolIdentityProvider, SchoolSearchService, SchoolCandidate } from '../services/schoolProvider';

interface ProfileManagerProps {
  profiles: TeacherProfile[];
  activeProfileId: string;
  schools: SchoolData[];
  activeSchool?: SchoolData;
  principalHistories?: PrincipalHistory[];
  onSelectProfile: (id: string) => void;
  onSaveProfile: (profile: TeacherProfile) => void;
  onDeleteProfile: (id: string) => void;
  onCreateSchool: (school: Omit<SchoolData, 'id' | 'createdAt' | 'updatedAt'> | SchoolData) => void;
  onUpdateSchool: (id: string, updates: Partial<SchoolData>) => void;
  onSavePrincipalHistory?: (history: PrincipalHistory) => void;
  onSetActivePrincipal?: (schoolId: string, historyId: string) => void;
  onNextStep: () => void;
}

export const ProfileManager: React.FC<ProfileManagerProps> = ({
  profiles,
  activeProfileId,
  schools,
  activeSchool: propsActiveSchool,
  principalHistories = [],
  onSelectProfile,
  onSaveProfile,
  onDeleteProfile,
  onCreateSchool,
  onUpdateSchool,
  onSavePrincipalHistory,
  onSetActivePrincipal,
  onNextStep,
}) => {
  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];
  const activeSchool =
    propsActiveSchool ||
    schools.find((s) => s.id === activeProfile?.schoolId) ||
    schools[0] || {
      id: 'sch-1',
      name: '',
      npsn: '',
      address: '',
      village: '',
      district: '',
      regency: '',
      province: '',
      principalName: '',
      principalNip: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

  // Profile Modal State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<TeacherProfile>({ ...activeProfile });

  // School Modal State (Explicit Create vs Edit Mode)
  const [isEditingSchool, setIsEditingSchool] = useState(false);
  const [schoolModalMode, setSchoolModalMode] = useState<'create' | 'edit'>('edit');
  const [schoolForm, setSchoolForm] = useState<SchoolData>({ ...activeSchool });

  // Duplicate NPSN Warning State
  const [duplicateNpsnModal, setDuplicateNpsnModal] = useState<{
    existingSchool: SchoolData;
    candidateForm: SchoolData;
  } | null>(null);

  useEffect(() => {
    if (!isEditingProfile) {
      setProfileForm({ ...activeProfile });
    }
  }, [activeProfile?.id, isEditingProfile]);

  useEffect(() => {
    if (!isEditingSchool) {
      setSchoolForm({ ...activeSchool });
    }
  }, [activeSchool?.id, isEditingSchool]);

  // School Search / Candidate Lookup State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SchoolCandidate[]>([]);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const [isSearchingSchool, setIsSearchingSchool] = useState(false);
  const [searchHasError, setSearchHasError] = useState(false);
  const [searchCompleted, setSearchCompleted] = useState(false);
  const [isResolvingPrincipal, setIsResolvingPrincipal] = useState(false);
  const [principalNotice, setPrincipalNotice] = useState<string | null>(null);

  // Principal History Form State
  const [isAddingPrincipalHistory, setIsAddingPrincipalHistory] = useState(false);
  const [historyForm, setHistoryForm] = useState({
    name: '',
    nip: '',
    startDate: new Date().toISOString().slice(0, 10),
    isActive: true,
  });

  const handleOpenAddSchool = () => {
    setSchoolModalMode('create');
    setSchoolForm({
      id: `sch-${Date.now()}`,
      name: '',
      npsn: '',
      address: '',
      village: '',
      district: '',
      regency: '',
      province: '',
      principalName: '',
      principalNip: '',
      verificationStatus: 'unverified',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setSearchQuery('');
    setSearchResults([]);
    setSearchNotice(null);
    setSearchHasError(false);
    setSearchCompleted(false);
    setPrincipalNotice(null);
    setIsEditingSchool(true);
  };

  const handleOpenEditSchool = () => {
    setSchoolModalMode('edit');
    setSchoolForm({ ...activeSchool });
    setSearchQuery('');
    setSearchResults([]);
    setSearchNotice(null);
    setSearchHasError(false);
    setSearchCompleted(false);
    setPrincipalNotice(null);
    setIsEditingSchool(true);
  };

  const handleAutoResolvePrincipal = async (targetSchool?: Partial<SchoolData>) => {
    const s = targetSchool || schoolForm;
    const name = (s.name || '').trim();
    const npsn = (s.npsn || '').trim();

    if (!name && !npsn) {
      setPrincipalNotice('Masukkan nama sekolah atau NPSN terlebih dahulu untuk mencari Kepala Sekolah.');
      return;
    }

    setIsResolvingPrincipal(true);
    setPrincipalNotice(null);

    try {
      const res = await SchoolSearchService.resolvePrincipal({
        name,
        npsn,
        district: s.district || '',
        regency: s.regency || '',
        province: s.province || '',
      });

      if (res.found && res.principalName) {
        setSchoolForm((prev) => ({
          ...prev,
          principalName: res.principalName || prev.principalName,
          principalNip: res.principalNip || prev.principalNip,
          principalSource: res.principalSource || prev.principalSource || 'Data Referensi Kemendikdasmen & Dapodik',
          principalSourceUrl: res.principalSourceUrl || prev.principalSourceUrl,
          verificationStatus: res.verificationStatus || 'verified',
          lastVerifiedAt: res.lastVerifiedAt || new Date().toISOString(),
        }));
        setPrincipalNotice(`Kepala Sekolah terverifikasi: ${res.principalName} ${res.principalNip ? `(NIP: ${res.principalNip})` : ''} - Sumber: ${res.principalSource || 'Kemendikdasmen'}`);
      } else {
        setPrincipalNotice(res.message || 'Nama kepala sekolah belum tercantum pada direktori publik terbuka. Anda dapat mengisinya secara manual.');
      }
    } catch {
      setPrincipalNotice('Tidak dapat menghubungi layanan verifikasi kepala sekolah saat ini.');
    } finally {
      setIsResolvingPrincipal(false);
    }
  };

  const handleAddPrincipalHistorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!historyForm.name.trim()) {
      alert('Nama Kepala Sekolah wajib diisi');
      return;
    }
    if (onSavePrincipalHistory) {
      onSavePrincipalHistory({
        id: `ph-${Date.now()}`,
        schoolId: activeSchool.id,
        name: historyForm.name.trim(),
        nip: historyForm.nip.trim(),
        startDate: historyForm.startDate || new Date().toISOString().slice(0, 10),
        isActive: historyForm.isActive,
        source: 'Diisi Manual / Riwayat',
        createdAt: new Date().toISOString(),
      });
    }
    setIsAddingPrincipalHistory(false);
    setHistoryForm({
      name: '',
      nip: '',
      startDate: new Date().toISOString().slice(0, 10),
      isActive: true,
    });
  };

  const handleOpenAddProfile = () => {
    const newProfile: TeacherProfile = {
      id: `prof-${Date.now()}`,
      name: '',
      nip: '',
      nuptk: '',
      status: 'PNS',
      defaultSubject: 'Bahasa Indonesia',
      defaultLevel: 'SD',
      schoolId: activeSchool.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProfileForm(newProfile);
    setIsEditingProfile(true);
  };

  const handleOpenEditProfile = (profile: TeacherProfile) => {
    setProfileForm({ ...profile });
    setIsEditingProfile(true);
  };

  const handleSaveProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.name.trim()) {
      alert('Nama guru wajib diisi.');
      return;
    }
    onSaveProfile({
      ...profileForm,
      updatedAt: new Date().toISOString(),
    });
    setIsEditingProfile(false);
  };

  const handleSearchSchool = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchNotice('Ketik nama sekolah atau NPSN terlebih dahulu.');
      return;
    }

    setIsSearchingSchool(true);
    setSearchHasError(false);
    setSearchNotice(null);
    setSearchCompleted(false);

    try {
      const result = await SchoolSearchService.searchSchool(searchQuery);
      setSearchResults(result.candidates || []);
      setSearchNotice(result.message);
      setSearchHasError(!!result.error);
      setSearchCompleted(true);
    } catch {
      setSearchHasError(true);
      setSearchNotice('Tidak dapat menghubungi sumber data sekolah saat ini.');
      setSearchResults([]);
      setSearchCompleted(true);
    } finally {
      setIsSearchingSchool(false);
    }
  };

  const handleSelectCandidate = async (cand: SchoolCandidate) => {
    const hasPrincipal = Boolean(cand.principalName && cand.principalName.trim().length > 1);

    setSchoolForm((prev) => ({
      ...prev,
      name: cand.name || prev.name,
      npsn: cand.npsn || prev.npsn,
      address: cand.address || prev.address,
      village: cand.village || prev.village,
      district: cand.district || prev.district,
      regency: cand.regency || prev.regency,
      province: cand.province || prev.province,
      principalName: cand.principalName || prev.principalName || '',
      principalNip: cand.principalNip || prev.principalNip || '',
      principalSource: cand.principalSource || (hasPrincipal ? cand.source : prev.principalSource),
      principalSourceUrl: cand.principalSourceUrl || cand.sourceUrl || prev.principalSourceUrl,
      verificationStatus: cand.verificationStatus || (hasPrincipal ? 'verified' : 'unverified'),
      lastVerifiedAt: cand.lastVerifiedAt || (hasPrincipal ? new Date().toISOString() : prev.lastVerifiedAt),
    }));

    if (hasPrincipal) {
      setSearchNotice(`Data sekolah dan Kepala Sekolah (${cand.principalName}) berhasil dimuat dari: ${cand.source || 'Data Referensi Kemendikdasmen'}.`);
    } else {
      setSearchNotice(`Data identitas sekolah dimuat dari: ${cand.source || 'Data Referensi Kemendikdasmen'}. Mencari verifikasi Kepala Sekolah...`);
      handleAutoResolvePrincipal({
        name: cand.name,
        npsn: cand.npsn,
        district: cand.district,
        regency: cand.regency,
        province: cand.province,
      });
    }
  };

  const handleFocusManualInput = () => {
    const input = document.getElementById('input-school-name');
    if (input) {
      input.focus();
    }
  };

  const handleSaveSchoolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolForm.name.trim()) {
      alert('Nama sekolah wajib diisi.');
      return;
    }

    const trimmedNpsn = (schoolForm.npsn || '').trim();

    // In CREATE mode, check if NPSN already exists in master schools
    if (schoolModalMode === 'create' && trimmedNpsn) {
      const existing = schools.find((s) => s.npsn && s.npsn.trim() === trimmedNpsn);
      if (existing) {
        setDuplicateNpsnModal({
          existingSchool: existing,
          candidateForm: { ...schoolForm },
        });
        return;
      }
    }

    const savedSchool: SchoolData = {
      ...schoolForm,
      updatedAt: new Date().toISOString(),
    };

    if (schoolModalMode === 'create') {
      onCreateSchool(savedSchool);
    } else {
      onUpdateSchool(savedSchool.id, savedSchool);
    }

    setIsEditingSchool(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchNotice(null);
    setPrincipalNotice(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Instruction */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center">
                01
              </span>
              <h3 className="text-lg font-bold text-slate-900">Manajemen Profil Guru & Sekolah Utama</h3>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Setiap profil guru memiliki 1 sekolah utama sebagai acuan penyusunan administrasi pembelajaran, kop surat, dan lembar pengesahan.
            </p>
          </div>

          <button
            id="btn-add-new-profile"
            onClick={handleOpenAddProfile}
            className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Profil Guru</span>
          </button>
        </div>
      </div>

      {/* Grid: Profiles List & Active Primary School Data */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Profiles List (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              <span>Daftar Profil Guru ({profiles.length})</span>
            </h4>
            <span className="text-xs text-slate-400">Pilih guru untuk mengelola</span>
          </div>

          <div className="space-y-3">
            {profiles.map((p) => {
              const isSelected = p.id === activeProfileId;
              return (
                <div
                  key={p.id}
                  id={`profile-card-${p.id}`}
                  onClick={() => onSelectProfile(p.id)}
                  className={`p-4 rounded-2xl border transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-600/80 ring-2 ring-blue-600/20 shadow-xs'
                      : 'bg-white hover:bg-slate-50 border-slate-200/80 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shrink-0 ${
                          isSelected
                            ? 'bg-blue-700 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {p.name.charAt(0).toUpperCase() || 'G'}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-bold text-slate-900 text-sm">{p.name}</h5>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                            {p.status}
                          </span>
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <Check className="w-3 h-3 text-emerald-600" /> Aktif
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 space-y-0.5">
                          <div>NIP: {p.nip || 'Belum diisi'}</div>
                          {p.nuptk && <div>NUPTK: {p.nuptk}</div>}
                          <div className="text-slate-600 font-medium pt-0.5">
                            Jenjang: {p.defaultLevel}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        id={`btn-edit-profile-${p.id}`}
                        onClick={() => handleOpenEditProfile(p)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        title="Edit Profil Guru"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {profiles.length > 1 && (
                        <button
                          id={`btn-delete-profile-${p.id}`}
                          onClick={() => {
                            if (confirm(`Apakah Anda yakin ingin menghapus profil "${p.name}"? Seluruh administrasi profil ini akan terhapus.`)) {
                              onDeleteProfile(p.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Hapus Profil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Primary School & Principal History (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card: Sekolah Utama */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Sekolah Utama</h4>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">1 Profil Guru = 1 Sekolah Utama</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  id="btn-edit-school"
                  type="button"
                  onClick={handleOpenEditSchool}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                  title="Ubah Data Sekolah yang Sedang Digunakan"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Ubah Data Sekolah</span>
                </button>
                <button
                  id="btn-add-new-school-master"
                  type="button"
                  onClick={handleOpenAddSchool}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                  title="Tambah Satuan Pendidikan Baru"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Sekolah</span>
                </button>
              </div>
            </div>

            {/* School Details */}
            <div className="space-y-3">
              <div>
                <h5 className="font-bold text-slate-900 text-base">{activeSchool.name || 'Nama Sekolah Belum Diisi'}</h5>
                <p className="text-xs text-slate-500 mt-0.5">NPSN: <span className="font-semibold text-slate-700">{activeSchool.npsn || '-'}</span></p>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{SchoolIdentityProvider.formatFullAddress(activeSchool)}</span>
                </div>

                <div className="flex items-start gap-2 pt-2 border-t border-slate-100">
                  <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">Kepala Sekolah Aktif:</span>
                      {activeSchool.verificationStatus === 'verified' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Terverifikasi Resmi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          Diisi Guru
                        </span>
                      )}
                    </div>
                    <div className="text-slate-900 font-bold text-xs">{activeSchool.principalName || 'Belum diisi'}</div>
                    <div className="text-slate-500 text-[11px]">NIP: {activeSchool.principalNip || 'Belum diisi'}</div>
                    {activeSchool.principalSource && (
                      <div className="text-[10px] text-slate-400 pt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>Sumber: <strong className="text-slate-600">{activeSchool.principalSource}</strong></span>
                        {activeSchool.principalSourceUrl && (
                          <a
                            href={activeSchool.principalSourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-0.5"
                          >
                            <span>Tautan</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Primary School Selection for Active Profile */}
              <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                <label htmlFor="select-profile-primary-school" className="block text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  Sekolah Utama Profil:
                </label>
                <select
                  id="select-profile-primary-school"
                  value={activeProfile.schoolId || activeSchool.id}
                  onChange={(e) => {
                    if (e.target.value && e.target.value !== activeProfile.schoolId) {
                      onSaveProfile({
                        ...activeProfile,
                        schoolId: e.target.value,
                      });
                    }
                  }}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-white focus:bg-white text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-600 transition cursor-pointer"
                  title="Pilih Sekolah Utama untuk Profil Guru Aktif"
                >
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.npsn ? `(NPSN: ${s.npsn})` : ''} {s.id === (activeProfile.schoolId || activeSchool.id) ? '✓ Sekolah Utama' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  1 Profil Guru = 1 Sekolah Utama. Mengubah pilihan ini otomatis menyinkronkan seluruh lembar administrasi guru.
                </p>
              </div>
            </div>
          </div>

          {/* Card: Principal History */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Riwayat Kepala Sekolah ({principalHistories.filter((h) => h.schoolId === activeSchool.id).length})
                </h5>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingPrincipalHistory(!isAddingPrincipalHistory)}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Riwayat</span>
              </button>
            </div>

            {/* Form inline if active */}
            {isAddingPrincipalHistory && (
              <form onSubmit={handleAddPrincipalHistorySubmit} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3 text-xs">
                <h6 className="font-bold text-slate-800">Tambah Catatan Kepala Sekolah Baru</h6>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Nama & Gelar</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Dra. Hj. Siti Rahmawati, M.Pd."
                    value={historyForm.name}
                    onChange={(e) => setHistoryForm({ ...historyForm, name: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">NIP</label>
                  <input
                    type="text"
                    placeholder="19680512 199303 2 004"
                    value={historyForm.nip}
                    onChange={(e) => setHistoryForm({ ...historyForm, nip: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Mulai Menjabat</label>
                  <input
                    type="date"
                    value={historyForm.startDate}
                    onChange={(e) => setHistoryForm({ ...historyForm, startDate: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chk-is-active"
                    checked={historyForm.isActive}
                    onChange={(e) => setHistoryForm({ ...historyForm, isActive: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="chk-is-active" className="text-[11px] font-medium text-slate-700 cursor-pointer">
                    Jadikan Kepala Sekolah Aktif Sekarang
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingPrincipalHistory(false)}
                    className="px-2.5 py-1 rounded-lg text-slate-600 bg-slate-200 hover:bg-slate-300 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-lg text-white bg-blue-700 hover:bg-blue-800 font-semibold cursor-pointer"
                  >
                    Simpan Riwayat
                  </button>
                </div>
              </form>
            )}

            {/* History List */}
            <div className="space-y-2">
              {principalHistories.filter((h) => h.schoolId === activeSchool.id).length === 0 ? (
                <p className="text-xs text-slate-400 italic py-1">
                  Belum ada riwayat perubahannya. Data kepala sekolah aktif diambil dari profile utama sekolah.
                </p>
              ) : (
                principalHistories
                  .filter((h) => h.schoolId === activeSchool.id)
                  .map((h) => (
                    <div
                      key={h.id}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                        h.isActive
                          ? 'bg-emerald-50/70 border-emerald-300 text-slate-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{h.name}</span>
                          {h.isActive ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ★ Kepala Sekolah Aktif
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-600">
                              Sebelumnya
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">NIP: {h.nip || '-'}</div>
                        {h.startDate && <div className="text-[10px] text-slate-400">Menjabat sejak: {h.startDate}</div>}
                      </div>

                      {!h.isActive && onSetActivePrincipal && (
                        <button
                          type="button"
                          onClick={() => onSetActivePrincipal(activeSchool.id, h.id)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-700 shadow-xs cursor-pointer transition shrink-0"
                        >
                          Pilih Aktif
                        </button>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Next step CTA */}
          <button
            id="btn-next-to-academic"
            onClick={onNextStep}
            className="w-full flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-950 text-white py-3 px-4 rounded-xl text-sm font-semibold shadow-sm transition cursor-pointer"
          >
            <span>Lanjut ke 02 Data Pembelajaran</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MODAL: Edit/Add Profile */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {profileForm.name ? 'Edit Profil Guru' : 'Tambah Profil Guru Baru'}
              </h3>
              <button
                onClick={() => setIsEditingProfile(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Lengkap & Gelar Guru <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-teacher-name"
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso, S.Pd."
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    NIP (Nomor Induk Pegawai)
                  </label>
                  <input
                    id="input-teacher-nip"
                    type="text"
                    placeholder="19850720 201001 1 015"
                    value={profileForm.nip}
                    onChange={(e) => setProfileForm({ ...profileForm, nip: e.target.value })}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    NUPTK (Opsional)
                  </label>
                  <input
                    id="input-teacher-nuptk"
                    type="text"
                    placeholder="4538761234900021"
                    value={profileForm.nuptk || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, nuptk: e.target.value })}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Status Guru
                  </label>
                  <select
                    id="select-teacher-status"
                    value={profileForm.status}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        status: e.target.value as TeacherProfile['status'],
                      })
                    }
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    <option value="PNS">PNS (Pegawai Negeri Sipil)</option>
                    <option value="PPPK">PPPK</option>
                    <option value="Guru Tetap Yayasan (GTY)">Guru Tetap Yayasan (GTY)</option>
                    <option value="Guru Tidak Tetap (GTT) / Honorer">Guru Tidak Tetap / Honorer</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Jenjang Utama
                  </label>
                  <select
                    id="select-teacher-level"
                    value={profileForm.defaultLevel}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        defaultLevel: e.target.value as 'SD' | 'SMP' | 'SMA' | 'SMK',
                      })
                    }
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    {EDUCATION_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mata Pelajaran Utama (Default)
                </label>
                <input
                  id="input-teacher-subject"
                  type="text"
                  placeholder="Contoh: Bahasa Indonesia / Guru Kelas"
                  value={profileForm.defaultSubject}
                  onChange={(e) => setProfileForm({ ...profileForm, defaultSubject: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Sekolah Utama <span className="text-rose-500">*</span>
                </label>
                <select
                  id="select-teacher-school-modal"
                  value={profileForm.schoolId || activeSchool.id}
                  onChange={(e) => setProfileForm({ ...profileForm, schoolId: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-white font-medium"
                >
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.npsn ? `(NPSN: ${s.npsn})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  1 Profil Guru = 1 Sekolah Utama. Lembar pengesahan dan kop dokumen akan mengambil data sekolah ini.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  id="btn-save-profile"
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 shadow-sm transition cursor-pointer"
                >
                  Simpan Profil
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: School Data Form (Create vs Edit Mode) */}
      {isEditingSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {schoolModalMode === 'create' ? 'Tambah Satuan Pendidikan Baru' : 'Ubah Data Satuan Pendidikan'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {schoolModalMode === 'create'
                    ? 'Buat data master sekolah baru untuk dikaitkan dengan profil guru.'
                    : 'Perbarui data identitas dan kepala sekolah aktif.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsEditingSchool(false);
                  setSearchResults([]);
                  setSearchNotice(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* School Lookup Section */}
            <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-blue-950 uppercase flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-blue-600" />
                  <span>Cari Data Sekolah di Internet (Kemendikdasmen / Dapodik / Web Resmi)</span>
                </label>
                <span className="text-[10px] font-medium text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Sumber Online
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  id="input-search-school-query"
                  type="text"
                  placeholder="Ketik Nama Sekolah atau 8-Digit NPSN (misal: sdn karang tengah 1 / 20607151)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchSchool();
                    }
                  }}
                  className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 shadow-xs"
                />
                <button
                  id="btn-do-search-school"
                  type="button"
                  disabled={isSearchingSchool}
                  onClick={() => handleSearchSchool()}
                  className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white rounded-xl text-xs font-semibold shrink-0 cursor-pointer shadow-xs transition flex items-center gap-1.5"
                >
                  {isSearchingSchool ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Mencari di Web...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>Cari di Internet</span>
                    </>
                  )}
                </button>
              </div>

              {/* Status & Feedback Messages */}
              {isSearchingSchool && (
                <div className="flex items-center gap-2 text-xs text-blue-700 py-1 font-medium animate-pulse">
                  <div className="w-3 h-3 border-2 border-blue-600/40 border-t-blue-600 rounded-full animate-spin" />
                  <span>Mencari data sekolah di internet dari sumber resmi Kemendikdasmen & direktori nasional...</span>
                </div>
              )}

              {searchNotice && !isSearchingSchool && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                    searchHasError
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : searchResults.length === 0 && searchCompleted
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  }`}
                >
                  {searchHasError ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  ) : searchResults.length === 0 && searchCompleted ? (
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-1.5">
                    <p className="font-medium">{searchNotice}</p>

                    {/* Actions if error or not found */}
                    {searchHasError && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSearchSchool()}
                          className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-semibold rounded-md transition cursor-pointer"
                        >
                          Coba Lagi
                        </button>
                        <button
                          type="button"
                          onClick={handleFocusManualInput}
                          className="px-2.5 py-1 bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 text-[11px] font-semibold rounded-md transition cursor-pointer"
                        >
                          Isi Manual
                        </button>
                      </div>
                    )}

                    {searchResults.length === 0 && searchCompleted && !searchHasError && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={handleFocusManualInput}
                          className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-semibold rounded-md transition cursor-pointer"
                        >
                          Masukkan Data Manual
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Candidates List */}
              {searchResults.length > 0 && !isSearchingSchool && (
                <div className="space-y-2 pt-1 max-h-56 overflow-y-auto pr-1">
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                    <span>Hasil Pencarian ({searchResults.length} Sekolah Ditemukan):</span>
                    <span className="text-[10px] text-slate-400 font-normal">Klik Pilih untuk mengisi form</span>
                  </div>
                  {searchResults.map((cand, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectCandidate(cand)}
                      className="p-3.5 rounded-xl bg-white border border-blue-200/90 hover:border-blue-600 hover:bg-blue-50/60 cursor-pointer transition shadow-2xs group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                              {cand.name}
                            </span>
                            {cand.level && (
                              <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                                {cand.level}
                              </span>
                            )}
                            {cand.status && (
                              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 text-[10px] font-medium rounded">
                                {cand.status}
                              </span>
                            )}
                            {cand.sourceType === 'official_government' ? (
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold rounded flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                Resmi Pemerintah
                              </span>
                            ) : cand.sourceType === 'official_school_web' ? (
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-semibold rounded flex items-center gap-1">
                                <Globe className="w-2.5 h-2.5 text-blue-600" />
                                Web Resmi Sekolah
                              </span>
                            ) : cand.sourceType === 'third_party_api' ? (
                              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-medium rounded">
                                Direktori Pihak Ketiga
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-medium rounded">
                                Sumber Online
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-600">
                            NPSN: <span className="font-semibold text-slate-800">{cand.npsn || 'Belum tersedia'}</span>
                            {cand.district ? ` • ${cand.district}` : ''}
                            {cand.regency ? `, ${cand.regency}` : ''}
                            {cand.province ? `, Prov. ${cand.province}` : ''}
                          </div>

                          {cand.address && (
                            <div className="text-[10px] text-slate-500 line-clamp-1">
                              {cand.address} {cand.village ? `, ${cand.village}` : ''}
                            </div>
                          )}

                          {/* Kepala Sekolah & Status Verifikasi Box */}
                          <div className="mt-1.5 p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-500 font-medium">Kepala Sekolah:</span>
                              <span className="font-semibold text-slate-900 text-right">
                                {cand.principalName && cand.principalName.trim() ? cand.principalName : (
                                  <span className="text-slate-400 italic font-normal">Belum ditemukan</span>
                                )}
                              </span>
                            </div>

                            {cand.principalName && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500 font-medium">NIP:</span>
                                <span className="font-mono text-slate-700 text-[10px] text-right">
                                  {cand.principalNip && cand.principalNip.trim() ? cand.principalNip : (
                                    <span className="text-slate-400 italic font-sans">Belum tersedia</span>
                                  )}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-slate-200/60 text-[10px]">
                              <div className="flex items-center gap-1.5 text-slate-500 truncate">
                                <span>Sumber:</span>
                                <span className="font-medium text-slate-700 truncate">
                                  {cand.principalSource || cand.source || 'Data Referensi Kemendikdasmen'}
                                </span>
                                {cand.sourceUrl && (
                                  <a
                                    href={cand.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center text-blue-600 hover:text-blue-800"
                                    title="Lihat Sumber Resmi"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>

                              <div className="shrink-0">
                                {cand.principalName || cand.verificationStatus === 'verified' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                    Terverifikasi
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    Belum terverifikasi
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectCandidate(cand);
                          }}
                          className="text-[11px] font-bold text-white bg-blue-700 hover:bg-blue-800 border border-blue-700 px-3.5 py-1.5 rounded-lg shrink-0 transition cursor-pointer shadow-xs"
                        >
                          Pilih
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-amber-50/80 border border-amber-200/90 p-3 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Catatan:</strong> Hasil pencarian hanya mengisi kolom formulir di bawah. Data baru akan resmi tersimpan ke sistem setelah Anda menekan tombol <strong>{schoolModalMode === 'create' ? 'Simpan Sekolah' : 'Simpan Perubahan'}</strong>.
              </span>
            </div>

            <form onSubmit={handleSaveSchoolSubmit} className="space-y-3.5 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nama Satuan Pendidikan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-school-name"
                    type="text"
                    required
                    placeholder="SD Negeri 01 Nusantara"
                    value={schoolForm.name}
                    onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    NPSN
                  </label>
                  <input
                    id="input-school-npsn"
                    type="text"
                    placeholder="20234567"
                    value={schoolForm.npsn}
                    onChange={(e) => setSchoolForm({ ...schoolForm, npsn: e.target.value })}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Alamat Jalan / Gedung
                </label>
                <input
                  id="input-school-address"
                  type="text"
                  placeholder="Jl. Merdeka Pendidikan No. 45"
                  value={schoolForm.address}
                  onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Desa / Kelurahan
                  </label>
                  <input
                    type="text"
                    placeholder="Sukamaju"
                    value={schoolForm.village}
                    onChange={(e) => setSchoolForm({ ...schoolForm, village: e.target.value })}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Kecamatan
                  </label>
                  <input
                    type="text"
                    placeholder="Kecamatan Cerdas"
                    value={schoolForm.district}
                    onChange={(e) => setSchoolForm({ ...schoolForm, district: e.target.value })}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Kabupaten / Kota
                  </label>
                  <input
                    type="text"
                    placeholder="Kabupaten Gemilang"
                    value={schoolForm.regency}
                    onChange={(e) => setSchoolForm({ ...schoolForm, regency: e.target.value })}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Provinsi
                  </label>
                  <input
                    type="text"
                    placeholder="Jawa Barat"
                    value={schoolForm.province}
                    onChange={(e) => setSchoolForm({ ...schoolForm, province: e.target.value })}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h6 className="text-xs font-bold text-slate-800 uppercase">Data Kepala Sekolah (Untuk Lembar Pengesahan)</h6>
                  </div>
                  <button
                    type="button"
                    id="btn-auto-resolve-principal"
                    disabled={isResolvingPrincipal || (!schoolForm.name?.trim() && !schoolForm.npsn?.trim())}
                    onClick={() => handleAutoResolvePrincipal()}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 px-2.5 py-1 rounded-lg transition cursor-pointer"
                    title="Cari dan verifikasi nama kepala sekolah serta NIP dari direktori resmi"
                  >
                    {isResolvingPrincipal ? (
                      <>
                        <div className="w-3 h-3 border-2 border-blue-600/40 border-t-blue-600 rounded-full animate-spin" />
                        <span>Memverifikasi...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3 h-3 text-blue-600" />
                        <span>Cari / Verifikasi Otomatis</span>
                      </>
                    )}
                  </button>
                </div>

                {principalNotice && (
                  <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                    <span className="flex-1">{principalNotice}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nama & Gelar Kepala Sekolah
                    </label>
                    <input
                      id="input-principal-name"
                      type="text"
                      placeholder="Dra. Hj. Siti Rahmawati, M.Pd."
                      value={schoolForm.principalName}
                      onChange={(e) => setSchoolForm({ ...schoolForm, principalName: e.target.value })}
                      className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      NIP Kepala Sekolah
                    </label>
                    <input
                      id="input-principal-nip"
                      type="text"
                      placeholder="19680512 199303 2 004"
                      value={schoolForm.principalNip}
                      onChange={(e) => setSchoolForm({ ...schoolForm, principalNip: e.target.value })}
                      className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                {schoolForm.principalSource && (
                  <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 flex items-center justify-between gap-2 flex-wrap">
                    <span>
                      Sumber Data: <strong>{schoolForm.principalSource}</strong>
                      {schoolForm.verificationStatus === 'verified' && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded">
                          <Check className="w-2.5 h-2.5" /> Terverifikasi
                        </span>
                      )}
                    </span>
                    {schoolForm.principalSourceUrl && (
                      <a
                        href={schoolForm.principalSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-[10px] underline inline-flex items-center gap-0.5"
                      >
                        <span>Lihat Referensi</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingSchool(false);
                    setSearchResults([]);
                    setSearchNotice(null);
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  id="btn-save-school"
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 shadow-sm transition cursor-pointer"
                >
                  {schoolModalMode === 'create' ? 'Simpan Sekolah' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Duplicate NPSN Warning */}
      {duplicateNpsnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">Sekolah dengan NPSN Ini Sudah Ada</h4>
                <p className="text-xs text-slate-600">
                  NPSN <strong className="text-slate-900 font-mono">{duplicateNpsnModal.existingSchool.npsn}</strong> sudah terdaftar di master data sebagai:
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-900 text-sm">{duplicateNpsnModal.existingSchool.name}</div>
              <div className="text-slate-500">
                {duplicateNpsnModal.existingSchool.district ? `${duplicateNpsnModal.existingSchool.district}, ` : ''}
                {duplicateNpsnModal.existingSchool.regency || ''}
                {duplicateNpsnModal.existingSchool.province ? ` (${duplicateNpsnModal.existingSchool.province})` : ''}
              </div>
              <div className="text-slate-600 pt-1">
                Kepala Sekolah: <strong>{duplicateNpsnModal.existingSchool.principalName || '-'}</strong>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Apakah Anda ingin menghubungkan profil guru ini ke sekolah yang sudah ada tersebut, atau kembali untuk mengubah NPSN?
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDuplicateNpsnModal(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                Ubah NPSN / Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const existingId = duplicateNpsnModal.existingSchool.id;
                  onSaveProfile({
                    ...activeProfile,
                    schoolId: existingId,
                  });
                  setDuplicateNpsnModal(null);
                  setIsEditingSchool(false);
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 transition cursor-pointer shadow-xs"
              >
                Gunakan Sekolah yang Sudah Ada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
