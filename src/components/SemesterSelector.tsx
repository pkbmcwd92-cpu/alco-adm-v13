import React from 'react';
import { Calendar, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { SemesterPlan } from '../types';

export interface SemesterSelectorProps {
  semesterPlans: SemesterPlan[];
  activeSemesterPlan?: SemesterPlan;
  onSelectSemester: (semesterPlanId: string) => void;
  onNextStep: () => void;
  onBackToATP: () => void;
}

export const SemesterSelector: React.FC<SemesterSelectorProps> = ({
  semesterPlans,
  activeSemesterPlan,
  onSelectSemester,
  onNextStep,
  onBackToATP,
}) => {
  const isSelectedValid =
    !!activeSemesterPlan &&
    semesterPlans.some((sp) => sp.id === activeSemesterPlan.id);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-700" />
                <span>Pilih Semester Pembelajaran</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                Tahap 07
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Pilih semester aktif untuk mengelola alokasi waktu mingguan, kalender akademik, modul ajar, dan administrasi nilai.
            </p>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {semesterPlans.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-xs text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h4 className="text-sm font-bold text-slate-900">
            SemesterPlan belum tersedia untuk administrasi tahunan ini.
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Struktur semester belum terbentuk pada Tahun Ajaran (YearPlan) aktif. Silakan periksa kembali konfigurasi data pembelajaran.
          </p>
        </div>
      ) : (
        /* Semester Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {semesterPlans.map((sp) => {
            const isSelected = activeSemesterPlan?.id === sp.id;
            const semesterNumber = sp.semester;
            const termLabel = semesterNumber === 1 ? 'Ganjil' : 'Genap';
            const termDescription =
              semesterNumber === 1
                ? 'Semester Ganjil (Bulan Juli s.d. Desember)'
                : 'Semester Genap (Bulan Januari s.d. Juni)';

            return (
              <button
                key={sp.id}
                id={`btn-select-semester-${semesterNumber}`}
                type="button"
                onClick={() => onSelectSemester(sp.id)}
                className={`relative p-6 rounded-2xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-blue-50/60 border-blue-600 ring-2 ring-blue-600/30 shadow-md'
                    : 'bg-white hover:bg-slate-50 border-slate-200 shadow-xs'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg ${
                          isSelected
                            ? 'bg-blue-700 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        Semester {semesterNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {termLabel}
                      </span>
                    </div>

                    <div>
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-100/80 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-4 h-4 text-blue-700" />
                          <span>Aktif</span>
                        </span>
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-extrabold text-slate-900">
                      Semester {semesterNumber} ({termLabel})
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {termDescription}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 text-[11px] text-slate-400 font-mono flex items-center justify-between">
                  <span>ID: {sp.id}</span>
                  {isSelected && (
                    <span className="text-blue-700 font-sans font-semibold">
                      Terpilih untuk Administrasi
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Navigation Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <button
          id="btn-back-to-atp"
          type="button"
          onClick={onBackToATP}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 shadow-xs transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke ATP</span>
        </button>

        <button
          id="btn-next-to-admin-from-semester"
          type="button"
          onClick={onNextStep}
          disabled={!isSelectedValid}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-950 text-white py-2.5 px-6 rounded-xl text-sm font-semibold shadow-sm transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>Lanjut ke Administrasi Semester</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
