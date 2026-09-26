import React, { useState, useMemo } from 'react';
import {
  X,
  BookOpen,
  UserCheck,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ShieldCheck,
  HelpCircle,
  Clock,
  Layers,
  Award,
} from 'lucide-react';
import {
  TeachingAssignment,
  AdditionalDuty,
  AcademicSetting,
  TeacherProfile,
} from '../types';
import {
  validateTeacherTeachingLoad,
  PREDEFINED_ADDITIONAL_DUTIES,
  getSubjectJP,
  MASTER_CURRICULUM_STRUCTURE,
} from '../services/jpEngine';

interface TeacherTeachingLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSetting: AcademicSetting;
  teacherProfile?: TeacherProfile;
}

export const TeacherTeachingLoadModal: React.FC<TeacherTeachingLoadModalProps> = ({
  isOpen,
  onClose,
  currentSetting,
  teacherProfile,
}) => {
  // Initial state derived from current academic setting
  const initialWeeklyJP = useMemo(() => {
    return getSubjectJP({
      curriculum: currentSetting.curriculum,
      level: currentSetting.level,
      grade: currentSetting.grade,
      subject: currentSetting.subject,
    }).weeklyJP;
  }, [currentSetting]);

  const [assignments, setAssignments] = useState<TeachingAssignment[]>([
    {
      id: 'assign-1',
      subject: currentSetting.subject || 'Mata Pelajaran',
      level: currentSetting.level || 'SD',
      grade: currentSetting.grade || 'Kelas 1',
      weeklyJP: currentSetting.subjectWeeklyJP || currentSetting.totalHoursPerWeek || initialWeeklyJP || 4,
      classCount: 1,
      isCertifiedSubject: true,
    },
  ]);

  const [additionalDuties, setAdditionalDuties] = useState<AdditionalDuty[]>([]);

  // Form input state for adding new assignment
  const [newSubject, setNewSubject] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [newLevel, setNewLevel] = useState<'SD' | 'SMP' | 'SMA' | 'SMK'>((currentSetting.level as any) || 'SD');
  const [newWeeklyJP, setNewWeeklyJP] = useState<number>(4);
  const [newClassCount, setNewClassCount] = useState<number>(1);

  // Form input state for adding additional duty
  const [selectedDutyRole, setSelectedDutyRole] = useState(PREDEFINED_ADDITIONAL_DUTIES[0].role);
  const [dutyDecreeNumber, setDutyDecreeNumber] = useState('');

  // Selected preset JP lookup for new assignment
  const handleNewSubjectSelect = (sub: string, lvl: string, grd: string) => {
    setNewSubject(sub);
    const lookup = getSubjectJP({
      curriculum: currentSetting.curriculum,
      level: lvl,
      grade: grd,
      subject: sub,
    });
    setNewWeeklyJP(lookup.weeklyJP ?? 0);
  };

  const handleAddAssignment = () => {
    if (!newSubject.trim()) return;
    const newAss: TeachingAssignment = {
      id: `assign-${Date.now()}`,
      subject: newSubject.trim(),
      level: newLevel,
      grade: newGrade.trim() || 'Kelas 1',
      weeklyJP: Math.max(1, Number(newWeeklyJP) || 1),
      classCount: Math.max(1, Number(newClassCount) || 1),
      isCertifiedSubject: true,
    };
    setAssignments((prev) => [...prev, newAss]);
    setNewSubject('');
    setNewGrade('');
    setNewWeeklyJP(4);
    setNewClassCount(1);
  };

  const handleRemoveAssignment = (id?: string) => {
    if (!id) return;
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAddDuty = () => {
    const dutyRef = PREDEFINED_ADDITIONAL_DUTIES.find((d) => d.role === selectedDutyRole);
    if (!dutyRef) return;
    const newDuty: AdditionalDuty = {
      id: `duty-${Date.now()}`,
      role: dutyRef.role,
      equivalentWeeklyJP: dutyRef.defaultJP,
      decreeNumber: dutyDecreeNumber.trim() || undefined,
    };
    setAdditionalDuties((prev) => [...prev, newDuty]);
    setDutyDecreeNumber('');
  };

  const handleRemoveDuty = (id?: string) => {
    if (!id) return;
    setAdditionalDuties((prev) => prev.filter((d) => d.id !== id));
  };

  // Validation calculation
  const validation = useMemo(() => {
    return validateTeacherTeachingLoad(assignments, additionalDuties, teacherProfile?.name);
  }, [assignments, additionalDuties, teacherProfile]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 rounded-lg text-blue-400 border border-blue-500/30">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Validasi Beban Mengajar Guru & JP Engine
              </h2>
              <p className="text-xs text-slate-400">
                Pemisahan JP Struktur Kurikulum, JP Tatap Muka Guru, dan Pemenuhan Beban Kerja (24 - 40 JP/minggu)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-800">
          {/* Concept Clarity Banner */}
          <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-blue-950">
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Prinsip Perhitungan & Pemisahan Entitas JP:</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-slate-700">
              <div className="p-2.5 bg-white rounded-lg border border-blue-100 shadow-2xs">
                <p className="font-semibold text-blue-900 mb-1">1. JP Mata Pelajaran</p>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Berasal dari <strong>Struktur Kurikulum Resmi</strong> (misal: Bahasa Indonesia = 6 JP/minggu).
                </p>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-blue-100 shadow-2xs">
                <p className="font-semibold text-blue-900 mb-1">2. JP Tatap Muka Guru</p>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Akumulasi tatap muka riil: <strong>Jumlah Rombel Kelas × JP Mapel</strong> (misal: 4 rombel × 6 JP = 24 JP).
                </p>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-blue-100 shadow-2xs">
                <p className="font-semibold text-blue-900 mb-1">3. Beban Kerja Guru</p>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Total Tatap Muka + Tugas Tambahan = <strong>24 s.d. 40 JP/minggu</strong> (Permendikbud No. 15/2018).
                </p>
              </div>
            </div>
          </div>

          {/* Validation Status Card */}
          <div
            className={`p-4.5 rounded-xl border ${
              validation.status === 'MEMENUHI'
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : validation.status === 'BELUM_MEMENUHI'
                ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                : 'bg-rose-50/80 border-rose-200 text-rose-950'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                {validation.status === 'MEMENUHI' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{validation.statusLabel}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        validation.status === 'MEMENUHI'
                          ? 'bg-emerald-200 text-emerald-800'
                          : 'bg-amber-200 text-amber-800'
                      }`}
                    >
                      {validation.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 mt-1">{validation.statusDescription}</p>
                </div>
              </div>

              {/* Stat counters */}
              <div className="flex items-center gap-2 text-center shrink-0 self-end sm:self-center">
                <div className="px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
                  <span className="block text-[10px] text-slate-500 uppercase font-semibold">Tatap Muka</span>
                  <span className="text-sm font-bold text-slate-800">{validation.totalDirectTeachingJP} JP</span>
                </div>
                <div className="text-slate-400 font-bold">+</div>
                <div className="px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
                  <span className="block text-[10px] text-slate-500 uppercase font-semibold">Tugas Tambahan</span>
                  <span className="text-sm font-bold text-slate-800">{validation.totalAdditionalDutiesJP} JP</span>
                </div>
                <div className="text-slate-400 font-bold">=</div>
                <div
                  className={`px-3 py-2 rounded-lg border shadow-2xs ${
                    validation.status === 'MEMENUHI'
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-amber-600 text-white border-amber-700'
                  }`}
                >
                  <span className="block text-[10px] text-emerald-100 uppercase font-semibold">Total Beban</span>
                  <span className="text-sm font-extrabold">{validation.totalWorkloadJP} JP</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Rombel & Teaching Assignments */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>1. Penugasan Tatap Muka Guru (Rombel / Kelas yang Diampu)</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                Total Tatap Muka: <strong>{validation.totalDirectTeachingJP} JP</strong>
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-semibold">
                    <th className="py-2.5 px-3">Mata Pelajaran</th>
                    <th className="py-2.5 px-3">Jenjang & Tingkat</th>
                    <th className="py-2.5 px-3 text-center">JP Mapel / Pekan</th>
                    <th className="py-2.5 px-3 text-center">Jumlah Rombel</th>
                    <th className="py-2.5 px-3 text-right">Subtotal JP</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {assignments.map((ass) => (
                    <tr key={ass.id} className="hover:bg-slate-100/60 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-900">{ass.subject}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {ass.level} - {ass.grade}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-700 font-semibold">
                        {ass.weeklyJP} JP
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-700 font-semibold">
                        {ass.classCount} Rombel
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-blue-700">
                        {ass.weeklyJP * ass.classCount} JP
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveAssignment(ass.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Hapus Penugasan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {assignments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400">
                        Belum ada penugasan tatap muka yang ditambahkan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Add Assignment Sub-form */}
              <div className="p-3 bg-slate-100/70 border-t border-slate-200 flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Nama Mapel (misal: Matematika)"
                  value={newSubject}
                  onChange={(e) => handleNewSubjectSelect(e.target.value, newLevel, newGrade)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs w-44"
                />
                <select
                  value={newLevel}
                  onChange={(e) => {
                    const lvl = e.target.value as any;
                    setNewLevel(lvl);
                    handleNewSubjectSelect(newSubject, lvl, newGrade);
                  }}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="SD">SD</option>
                  <option value="SMP">SMP</option>
                  <option value="SMA">SMA</option>
                  <option value="SMK">SMK</option>
                </select>
                <input
                  type="text"
                  placeholder="Tingkat (misal: Kelas 4)"
                  value={newGrade}
                  onChange={(e) => setNewGrade(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs w-28"
                />
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 font-medium">JP:</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newWeeklyJP}
                    onChange={(e) => setNewWeeklyJP(parseInt(e.target.value, 10) || 1)}
                    className="w-14 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-center"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 font-medium">Rombel:</span>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={newClassCount}
                    onChange={(e) => setNewClassCount(parseInt(e.target.value, 10) || 1)}
                    className="w-14 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-center"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddAssignment}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1 transition-colors ml-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Rombel</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Additional Duties */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-600" />
                <span>2. Ekuivalensi Tugas Tambahan (Permendikbud No. 15 Tahun 2018)</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                Total Ekuivalensi: <strong>{validation.totalAdditionalDutiesJP} JP</strong>
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-semibold">
                    <th className="py-2.5 px-3">Nama Tugas Tambahan</th>
                    <th className="py-2.5 px-3">Nomor SK Penugasan</th>
                    <th className="py-2.5 px-3 text-right">Ekuivalensi Beban</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {additionalDuties.map((duty) => (
                    <tr key={duty.id} className="hover:bg-slate-100/60 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-900">{duty.role}</td>
                      <td className="py-2.5 px-3 text-slate-500">{duty.decreeNumber || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-purple-700">
                        {duty.equivalentWeeklyJP} JP / pekan
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveDuty(duty.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Hapus Tugas Tambahan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {additionalDuties.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400">
                        Tidak ada tugas tambahan yang dicantumkan (hanya mengajar tatap muka).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Add Duty Sub-form */}
              <div className="p-3 bg-slate-100/70 border-t border-slate-200 flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={selectedDutyRole}
                  onChange={(e) => setSelectedDutyRole(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs flex-1 min-w-[200px]"
                >
                  {PREDEFINED_ADDITIONAL_DUTIES.map((d) => (
                    <option key={d.role} value={d.role}>
                      {d.role} (+{d.defaultJP} JP)
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Nomor SK Penugasan (Opsional)"
                  value={dutyDecreeNumber}
                  onChange={(e) => setDutyDecreeNumber(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs w-52"
                />
                <button
                  type="button"
                  onClick={handleAddDuty}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Tugas</span>
                </button>
              </div>
            </div>
          </div>

          {/* Legal Reference & Verification Footer */}
          <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Landasan Hukum: <strong>{validation.regulatoryBasis}</strong>
              </span>
            </div>
            <span className="text-slate-400">Standar Beban Kerja: Min 24 JP - Max 40 JP / Pekan</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
          >
            Tutup & Terapkan
          </button>
        </div>
      </div>
    </div>
  );
};
