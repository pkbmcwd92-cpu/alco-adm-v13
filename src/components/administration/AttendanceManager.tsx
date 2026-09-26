import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  CheckCircle2,
  UserPlus,
  Trash2,
  FileDown,
  Save,
  CheckCheck,
  Award,
} from 'lucide-react';
import {
  Student,
  AttendanceSession,
  AttendanceRecord,
  AcademicSetting,
  TeacherProfile,
  SchoolData,
  TPData,
} from '../../types';
import { generateDaftarHadir } from '../../services/documentEngine';

interface AttendanceManagerProps {
  school: SchoolData;
  profile: TeacherProfile;
  academicSetting: AcademicSetting;
  tp?: TPData;
  students: Student[];
  attendanceSessions: AttendanceSession[];
  attendanceRecords: AttendanceRecord[];
  onSaveStudents: (students: Student[]) => void;
  onSaveSessions: (sessions: AttendanceSession[], records: AttendanceRecord[]) => void;
}

export const AttendanceManager: React.FC<AttendanceManagerProps> = ({
  school,
  profile,
  academicSetting,
  tp,
  students = [],
  attendanceSessions = [],
  attendanceRecords = [],
  onSaveStudents,
  onSaveSessions,
}) => {
  const [studentList, setStudentList] = useState<Student[]>(students || []);
  const [sessionList, setSessionList] = useState<AttendanceSession[]>(attendanceSessions || []);
  const [recordList, setRecordList] = useState<AttendanceRecord[]>(attendanceRecords || []);

  useEffect(() => {
    setStudentList(students || []);
  }, [students]);

  useEffect(() => {
    setSessionList(attendanceSessions || []);
  }, [attendanceSessions]);

  useEffect(() => {
    setRecordList(attendanceRecords || []);
  }, [attendanceRecords]);

  // New Student modal / inline state
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentNISN, setNewStudentNISN] = useState('');
  const [newStudentGender, setNewStudentGender] = useState<'L' | 'P'>('L');

  // New Session state
  const [activeTab, setActiveTab] = useState<'roster' | 'sessions' | 'recap'>('sessions');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessionMeetingNo, setSessionMeetingNo] = useState((sessionList?.length || 0) + 1);
  const [sessionTopic, setSessionTopic] = useState('');
  const [selectedTpId, setSelectedTpId] = useState(tp?.items?.[0]?.id || '');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(sessionList?.[0]?.id || null);

  const [notification, setNotification] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleAddStudent = () => {
    if (!newStudentName.trim()) return;
    const newStudent: Student = {
      id: `std-${Date.now()}`,
      academicSettingId: academicSetting.id,
      nisn: newStudentNISN.trim() || undefined,
      name: newStudentName.trim(),
      gender: newStudentGender,
    };
    const updated = [...studentList, newStudent];
    setStudentList(updated);
    onSaveStudents(updated);
    setNewStudentName('');
    setNewStudentNISN('');
    setNotification('Siswa berhasil ditambahkan ke daftar kelas!');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteStudent = (id: string) => {
    if (!confirm('Hapus siswa ini dari daftar kelas?')) return;
    const updated = studentList.filter((s) => s.id !== id);
    setStudentList(updated);
    onSaveStudents(updated);
  };

  const handleCreateSession = () => {
    const newSessionId = `ses-${Date.now()}`;
    const newSession: AttendanceSession = {
      id: newSessionId,
      academicSettingId: academicSetting.id,
      date: sessionDate,
      meetingNumber: Number(sessionMeetingNo),
      topic: sessionTopic || `Pertemuan Tatap Muka Ke-${sessionMeetingNo}`,
      createdAt: new Date().toISOString(),
    };

    // Initialize all students as Hadir ('H')
    const initialRecords: AttendanceRecord[] = studentList.map((std) => ({
      id: `att-${Date.now()}-${std.id}`,
      sessionId: newSessionId,
      studentId: std.id,
      status: 'H',
    }));

    const updatedSessions = [...sessionList, newSession];
    const updatedRecords = [...recordList, ...initialRecords];

    setSessionList(updatedSessions);
    setRecordList(updatedRecords);
    setSelectedSessionId(newSessionId);
    setSessionMeetingNo(updatedSessions.length + 1);
    setSessionTopic('');
    onSaveSessions(updatedSessions, updatedRecords);
    setNotification('Sesi presensi baru berhasil dibuka!');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleStatusChange = (studentId: string, status: AttendanceRecord['status']) => {
    if (!selectedSessionId) return;
    setRecordList((prev) => {
      const idx = prev.findIndex((r) => r.sessionId === selectedSessionId && r.studentId === studentId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], status };
        return updated;
      } else {
        return [
          ...prev,
          {
            id: `att-${Date.now()}-${studentId}`,
            sessionId: selectedSessionId,
            studentId,
            status,
          },
        ];
      }
    });
  };

  const handleMarkAllPresent = () => {
    if (!selectedSessionId) return;
    setRecordList((prev) => {
      const filtered = prev.filter((r) => r.sessionId !== selectedSessionId);
      const allPresent: AttendanceRecord[] = studentList.map((std) => ({
        id: `att-${Date.now()}-${std.id}`,
        sessionId: selectedSessionId,
        studentId: std.id,
        status: 'H',
      }));
      return [...filtered, ...allPresent];
    });
    setNotification('Semua siswa ditandai Hadir!');
    setTimeout(() => setNotification(null), 2000);
  };

  const handleSaveAttendance = () => {
    onSaveSessions(sessionList, recordList);
    setNotification('Presensi pertemuan berhasil disimpan!');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await generateDaftarHadir({
        school,
        profile,
        academicSetting,
        students: studentList,
        attendanceSessions: sessionList,
        attendanceRecords: recordList,
      });
    } catch (e: any) {
      alert(`Gagal mengekspor daftar hadir: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6" id="attendance-manager-container">
      {notification && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-medium">{notification}</p>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2 text-indigo-700 font-semibold text-xs tracking-wider uppercase">
              <Users className="w-4 h-4" />
              <span>Modul Presensi & Peserta Didik</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">Daftar Hadir Siswa & Rekap Presensi</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Pencatatan kehadiran tatap muka kelas {academicSetting.grade} ({academicSetting.subject})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-export-daftar-hadir"
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors"
            >
              <FileDown className="w-4 h-4 text-indigo-600" />
              <span>{isExporting ? 'Mengekspor...' : 'Ekspor Daftar Hadir (.docx)'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mt-5 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'sessions'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Pencatatan Presensi Pertemuan ({sessionList.length} Sesi)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('recap')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'recap'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Rekapitulasi Kehadiran Kelas
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'roster'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Kelola Daftar Siswa ({studentList.length} Orang)
          </button>
        </div>
      </div>

      {/* Tab 1: Sessions & Recording */}
      {activeTab === 'sessions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Create Session & Session List */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>Buka Pertemuan Baru</span>
              </h3>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Pertemuan Ke-</label>
                    <input
                      type="number"
                      value={sessionMeetingNo}
                      onChange={(e) => setSessionMeetingNo(Number(e.target.value))}
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Tanggal</label>
                    <input
                      type="date"
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Tujuan Pembelajaran (TP)</label>
                  <select
                    value={selectedTpId}
                    onChange={(e) => setSelectedTpId(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-700"
                  >
                    {(tp?.items || []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code || 'TP'}: {item.statement?.slice(0, 45)}...
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Topik / Materi Pokok</label>
                  <input
                    type="text"
                    value={sessionTopic}
                    onChange={(e) => setSessionTopic(e.target.value)}
                    placeholder="Contoh: Diskusi Kelompok dan Eksplorasi"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCreateSession}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Buat Sesi Pertemuan</span>
                </button>
              </div>
            </div>

            {/* List of Sessions */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Daftar Pertemuan</h4>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {sessionList.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">Belum ada sesi pertemuan dibuat.</p>
                ) : (
                  sessionList.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSessionId(s.id)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedSessionId === s.id
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold">Pertemuan {s.meetingNumber}</span>
                        <span className="text-[10px] text-slate-400">{s.date}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{s.topic || 'Aktivitas Belajar'}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Roll Call Table */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            {selectedSessionId ? (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">
                      Presensi Pertemuan {sessionList.find((s) => s.id === selectedSessionId)?.meetingNumber || ''}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tanggal: {sessionList.find((s) => s.id === selectedSessionId)?.date} • Topik:{' '}
                      {sessionList.find((s) => s.id === selectedSessionId)?.topic || '-'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleMarkAllPresent}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-300"
                    >
                      <CheckCheck className="w-4 h-4" />
                      <span>Semua Hadir</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAttendance}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm"
                    >
                      <Save className="w-4 h-4" />
                      <span>Simpan Presensi</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">No</th>
                        <th className="py-2.5 px-3">Nama Siswa</th>
                        <th className="py-2.5 px-3 w-16 text-center">L/P</th>
                        <th className="py-2.5 px-3 text-center">Status Kehadiran</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentList.map((std, idx) => {
                        const rec = recordList.find(
                          (r) => r.sessionId === selectedSessionId && r.studentId === std.id
                        );
                        const status = rec?.status || 'H';

                        return (
                          <tr key={std.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-center text-slate-500">{idx + 1}</td>
                            <td className="py-2 px-3 font-medium text-slate-800">{std.name}</td>
                            <td className="py-2 px-3 text-center text-slate-500">{std.gender || 'L'}</td>
                            <td className="py-2 px-3 text-center">
                              <div className="inline-flex items-center gap-1">
                                {(
                                  [
                                    { code: 'H', label: 'Hadir', bg: 'bg-emerald-600 text-white' },
                                    { code: 'S', label: 'Sakit', bg: 'bg-amber-500 text-white' },
                                    { code: 'I', label: 'Izin', bg: 'bg-sky-500 text-white' },
                                    { code: 'A', label: 'Alpa', bg: 'bg-rose-600 text-white' },
                                    { code: 'D', label: 'Dispensasi', bg: 'bg-purple-600 text-white' },
                                  ] as const
                                ).map((opt) => (
                                  <button
                                    key={opt.code}
                                    type="button"
                                    onClick={() => handleStatusChange(std.id, opt.code)}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all ${
                                      status === opt.code
                                        ? `${opt.bg} shadow-sm scale-105`
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    {opt.code}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400">
                Pilih atau buat sesi pertemuan di sebelah kiri untuk mengisi presensi.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Class Attendance Recap */}
      {activeTab === 'recap' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Rekapitulasi Persentase Kehadiran Siswa</h3>
              <p className="text-xs text-slate-500">Berdasarkan {sessionList.length} pertemuan yang telah dicatat</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
                <Award className="w-3.5 h-3.5" />
                Target Minimal: 85%
              </span>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3 w-28">NISN</th>
                  <th className="py-2.5 px-3">Nama Siswa</th>
                  <th className="py-2.5 px-3 w-12 text-center">L/P</th>
                  <th className="py-2.5 px-3 w-12 text-center text-emerald-700">H</th>
                  <th className="py-2.5 px-3 w-12 text-center text-amber-600">S</th>
                  <th className="py-2.5 px-3 w-12 text-center text-sky-600">I</th>
                  <th className="py-2.5 px-3 w-12 text-center text-rose-600">A</th>
                  <th className="py-2.5 px-3 w-24 text-center">% Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentList.map((std, idx) => {
                  const studentRecords = recordList.filter((r) => r.studentId === std.id);
                  const h = studentRecords.filter((r) => r.status === 'H' || r.status === 'D').length;
                  const s = studentRecords.filter((r) => r.status === 'S').length;
                  const i = studentRecords.filter((r) => r.status === 'I').length;
                  const a = studentRecords.filter((r) => r.status === 'A').length;
                  const total = studentRecords.length;
                  const pct = total > 0 ? Math.round((h / total) * 100) : 100;

                  return (
                    <tr key={std.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-center text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-3 text-slate-600 font-mono">{std.nisn || '-'}</td>
                      <td className="py-2 px-3 font-medium text-slate-800">{std.name}</td>
                      <td className="py-2 px-3 text-center text-slate-500">{std.gender || 'L'}</td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-700">{h}</td>
                      <td className="py-2 px-3 text-center font-medium text-amber-600">{s}</td>
                      <td className="py-2 px-3 text-center font-medium text-sky-600">{i}</td>
                      <td className="py-2 px-3 text-center font-medium text-rose-600">{a}</td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            pct >= 85
                              ? 'bg-emerald-100 text-emerald-800'
                              : pct >= 75
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Student Roster Management */}
      {activeTab === 'roster' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3 mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Kelola Peserta Didik ({studentList.length} Siswa)</h3>
              <p className="text-xs text-slate-500">Tambah atau sesuaikan daftar nama siswa di rombongan belajar ini</p>
            </div>
          </div>

          {/* Inline Add Student Form */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5">
            <span className="text-xs font-bold text-slate-700 block mb-2">Tambah Siswa Baru:</span>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <input
                type="text"
                value={newStudentNISN}
                onChange={(e) => setNewStudentNISN(e.target.value)}
                placeholder="NISN (Opsional)"
                className="sm:col-span-3 text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
              <input
                type="text"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                placeholder="Nama Lengkap Siswa"
                className="sm:col-span-6 text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
              <select
                value={newStudentGender}
                onChange={(e) => setNewStudentGender(e.target.value as 'L' | 'P')}
                className="sm:col-span-2 text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="L">Laki-Laki (L)</option>
                <option value="P">Perempuan (P)</option>
              </select>
              <button
                type="button"
                onClick={handleAddStudent}
                className="sm:col-span-1 inline-flex items-center justify-center p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                title="Tambah Siswa"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3 w-32">NISN</th>
                  <th className="py-2.5 px-3">Nama Siswa</th>
                  <th className="py-2.5 px-3 w-20 text-center">L/P</th>
                  <th className="py-2.5 px-3 w-16 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentList.map((std, idx) => (
                  <tr key={std.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-center text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-3 text-slate-600 font-mono">{std.nisn || '-'}</td>
                    <td className="py-2 px-3 font-medium text-slate-800">{std.name}</td>
                    <td className="py-2 px-3 text-center text-slate-500">{std.gender === 'P' ? 'Perempuan' : 'Laki-Laki'}</td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteStudent(std.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
