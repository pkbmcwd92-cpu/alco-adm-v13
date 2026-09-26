import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  FileCheck,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Sliders,
  Check,
  Landmark,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  CalendarWorkflowStatus,
  CalendarProvenance,
  CalendarResolutionStatus,
} from '../../types';

interface CalendarWorkflowHeaderProps {
  workflowStatus: CalendarWorkflowStatus;
  resolutionStatus?: CalendarResolutionStatus;
  reviewStatus?: 'UNREVIEWED' | 'REVIEWED' | 'CONFIRMED';
  provenance?: CalendarProvenance;
  nationalProvenance?: CalendarProvenance;
  nationalProvenances?: CalendarProvenance[];
  sourceName?: string;
  sourceAuthority?: string;
  sourceDocumentNumber?: string;
  sourceUrl?: string;
  sourceRegion?: string;
  isOverridden?: boolean;
  overrideReason?: string;
  confirmedAt?: string;
  nationalHolidayCount?: number;
  regionalEventCount?: number;
  schoolEventCount?: number;
  actionableMessage?: string;
  diagnostic?: string;
  isManualMode: boolean;
  schoolProvince?: string;
  academicYear?: string;
  onTriggerAutoResolve: () => void;
  onConfirmWorkflow: () => void;
  onResetToOfficial: () => void;
  onToggleManualMode: () => void;
}

export const CalendarWorkflowHeader: React.FC<CalendarWorkflowHeaderProps> = ({
  workflowStatus,
  resolutionStatus,
  reviewStatus = 'UNREVIEWED',
  provenance,
  nationalProvenance,
  nationalProvenances,
  sourceName,
  sourceAuthority,
  sourceDocumentNumber,
  sourceUrl,
  sourceRegion,
  isOverridden,
  overrideReason,
  confirmedAt,
  nationalHolidayCount = 0,
  regionalEventCount = 0,
  schoolEventCount = 0,
  actionableMessage,
  diagnostic,
  isManualMode,
  schoolProvince,
  academicYear,
  onTriggerAutoResolve,
  onConfirmWorkflow,
  onResetToOfficial,
  onToggleManualMode,
}) => {
  const isResolved =
    workflowStatus === 'AUTO_RESOLVED' ||
    workflowStatus === 'REVIEWED' ||
    workflowStatus === 'MANUAL_OVERRIDE' ||
    workflowStatus === 'CONFIRMED';

  const isConfirmed = workflowStatus === 'CONFIRMED' || reviewStatus === 'CONFIRMED';

  // Step definition for UI workflow indicator
  const steps = [
    {
      id: 'AUTO_RESOLVE',
      num: 1,
      title: 'Auto Resolve',
      desc: 'Kaldik Daerah & Libur Nasional',
      status: isResolved ? 'completed' : 'active',
    },
    {
      id: 'REVIEW',
      num: 2,
      title: 'Review',
      desc: 'Verifikasi Tanggal & Beban Waktu',
      status: isConfirmed
        ? 'completed'
        : isResolved && !isManualMode
        ? 'active'
        : isResolved
        ? 'completed'
        : 'pending',
    },
    {
      id: 'MANUAL_OVERRIDE',
      num: 3,
      title: 'Manual Override',
      desc: 'Penyesuaian Satuan Pendidikan',
      status: isOverridden ? 'completed' : isManualMode ? 'active' : 'optional',
    },
    {
      id: 'CONFIRM',
      num: 4,
      title: 'Confirm',
      desc: 'Kunci & Finalisasi Waktu',
      status: isConfirmed ? 'completed' : isResolved ? 'pending' : 'disabled',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden mb-6" id="calendar-workflow-container">
      {/* Workflow Step Bar */}
      <div className="bg-slate-50/80 border-b border-slate-200 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 block">
              Alur Perencanaan Kalender Pendidikan
            </span>
            <h3 className="text-sm font-bold text-slate-800">
              Standar Alur: Auto Resolve → Review → Manual Override → Confirm
            </h3>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isResolved && !isConfirmed && (
              <button
                id="btn-confirm-calendar-workflow"
                type="button"
                onClick={onConfirmWorkflow}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                title="Kunci dan konfirmasi kalender pendidikan ini"
              >
                <Check className="w-4 h-4" />
                <span>Konfirmasi Kalender</span>
              </button>
            )}

            {isConfirmed && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Terkonfirmasi</span>
              </span>
            )}

            <button
              id="btn-sync-auto-resolve"
              type="button"
              onClick={onTriggerAutoResolve}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
              title="Sinkronisasi ulang dari kalender resmi dinas pendidikan & SKB 3 Menteri"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Sinkronkan Resmi</span>
            </button>

            {isOverridden && (
              <button
                id="btn-reset-to-official"
                type="button"
                onClick={onResetToOfficial}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium transition-colors"
                title="Hapus penyesuaian manual dan kembalikan ke standar resmi daerah"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset ke Resmi</span>
              </button>
            )}
          </div>
        </div>

        {/* Visual Stepper */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
          {steps.map((step) => {
            let bgStyle = 'bg-white border-slate-200 text-slate-500';
            let badgeStyle = 'bg-slate-200 text-slate-700';

            if (step.status === 'completed') {
              bgStyle = 'bg-emerald-50/70 border-emerald-200 text-emerald-950';
              badgeStyle = 'bg-emerald-600 text-white';
            } else if (step.status === 'active') {
              bgStyle = 'bg-indigo-50/80 border-indigo-300 text-indigo-950 ring-1 ring-indigo-200';
              badgeStyle = 'bg-indigo-600 text-white';
            } else if (step.status === 'optional') {
              bgStyle = 'bg-slate-50 border-dashed border-slate-300 text-slate-600';
              badgeStyle = 'bg-slate-200 text-slate-600';
            }

            return (
              <div
                key={step.id}
                className={`p-2.5 rounded-lg border flex items-start gap-2.5 transition-all ${bgStyle}`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${badgeStyle}`}
                >
                  {step.status === 'completed' ? <Check className="w-3 h-3" /> : step.num}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{step.title}</div>
                  <div className="text-[10px] opacity-80 leading-tight mt-0.5 truncate">{step.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Provenance & Status Content */}
      <div className="p-5 space-y-4">
        {/* Case 1: RESOLVED with Full Official Provenance */}
        {isResolved ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              {/* Regional Source Box */}
              <div className="lg:col-span-6 p-3.5 bg-indigo-50/40 rounded-xl border border-indigo-100 flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                    <Landmark className="w-4 h-4 text-indigo-600" />
                    <span>Sumber Utama: Kalender Pendidikan Daerah</span>
                  </div>
                  <div className="text-xs text-slate-800 font-semibold mt-1">
                    {sourceDocumentNumber || provenance?.documentNumber || 'SK Pedoman Kaldik Dinas Pendidikan'}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Otoritas: <strong>{sourceAuthority || provenance?.authority || sourceRegion || schoolProvince || 'Dinas Pendidikan Provinsi'}</strong>
                  </div>
                  {provenance?.documentTitle && (
                    <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">
                      {provenance.documentTitle}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-indigo-100/80 text-indigo-900">
                  <span>{regionalEventCount} agenda resmi terintegrasi</span>
                  {sourceUrl && (
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-700 hover:text-indigo-900 font-semibold hover:underline"
                    >
                      <span>Lihat Rujukan JDIH</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* National Overlay Box */}
              <div className="lg:col-span-6 p-3.5 bg-emerald-50/40 rounded-xl border border-emerald-100 flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Overlay Nasional: Hari Libur &amp; Cuti Bersama</span>
                  </div>
                  {nationalProvenances && nationalProvenances.length > 1 ? (
                    <div className="mt-1 space-y-1">
                      {nationalProvenances.map((np, idx) => (
                        <div key={idx} className="text-xs text-slate-800 font-semibold flex items-center justify-between gap-1">
                          <span>{np.documentNumber || np.sourceName}</span>
                          {np.sourceUrl && (
                            <a
                              href={np.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-emerald-700 hover:text-emerald-900 font-normal hover:underline inline-flex items-center gap-0.5"
                            >
                              JDIH <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-800 font-semibold mt-1">
                      {nationalProvenance?.documentNumber || 'SKB 3 Menteri (Menag, Menaker, MenPANRB)'}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Otoritas: <strong>Pemerintah Republik Indonesia (SKB 3 Menteri)</strong>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {nationalHolidayCount} Hari Libur Nasional &amp; Cuti Bersama ter-overlay otomatis
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-emerald-100/80 text-emerald-950">
                  <span className="font-medium text-emerald-800">Tahun Ajaran {academicYear || '-'}</span>
                  {(!nationalProvenances || nationalProvenances.length <= 1) && nationalProvenance?.sourceUrl && (
                    <a
                      href={nationalProvenance.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-semibold hover:underline"
                    >
                      <span>Portal Resmi SKB</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Overrides Status Ribbon if any */}
            {isOverridden && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
                <Sliders className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold text-amber-950">Penyesuaian Satuan Pendidikan Aktif: </span>
                  {overrideReason || 'Terdapat penyesuaian jadwal / agenda khusus oleh sekolah.'}
                  {schoolEventCount > 0 && ` (${schoolEventCount} agenda khusus)`}
                </div>
              </div>
            )}

            {/* Confirmed Ribbon */}
            {isConfirmed && confirmedAt && (
              <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-lg flex items-center justify-between gap-2 text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Kalender telah <strong>dikonfirmasi</strong> oleh guru / satuan pendidikan pada{' '}
                    {new Date(confirmedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onToggleManualMode}
                  className="text-indigo-700 hover:text-indigo-900 font-semibold underline text-xs shrink-0"
                >
                  {isManualMode ? 'Tutup Penyesuaian' : 'Ubah Penyesuaian'}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Case 2: UNRESOLVED / REGION_REQUIRED / ACADEMIC_YEAR_REQUIRED */
          <div className="space-y-3">
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-950">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <div className="font-bold text-amber-950 text-sm">
                  {resolutionStatus === 'REGION_REQUIRED'
                    ? 'Wilayah Sekolah Belum Terisi'
                    : resolutionStatus === 'ACADEMIC_YEAR_REQUIRED'
                    ? 'Tahun Ajaran Belum Ditentukan'
                    : 'Kalender Pendidikan Belum Ter-resolve Otomatis'}
                </div>
                <p className="text-amber-900">
                  {actionableMessage || diagnostic || 'Sistem belum dapat mencocokkan dokumen kalender resmi.'}
                </p>
                <div className="p-2.5 bg-white/80 rounded border border-amber-200/80 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-800">Prinsip Ketat Sistem: </span>
                  <em>NO DATA &gt; FAKE DATA</em>. Sistem tidak akan mengarang tanggal mulai/akhir semester jika dokumen resmi belum terverifikasi.
                  Anda dapat mengisi formulir kalender secara manual atau memilih wilayah sekolah yang sesuai.
                </div>
              </div>
            </div>

            {/* Non-blocking pedagogical draft reassurance */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2.5 text-[11px] text-slate-600">
              <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <strong>Informasi Modul: </strong>
                Kalender yang belum berstatus <em>Resolved</em> atau <em>Confirmed</em> <strong>TIDAK MEMBLOKIR</strong> pembuatan Modul Ajar (LearningPlan) atau Kisi-Kisi Asesmen (AssessmentPlan) dalam status <em>DRAFT</em>.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
