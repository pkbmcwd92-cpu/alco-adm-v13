import React from 'react';
import { NormalizedAssessmentDocument } from '../../types/assessmentExport';

export interface AssessmentDocumentPreviewProps {
  model: NormalizedAssessmentDocument;
  workflowStatus: 'DRAFT' | 'PERLU_DILENGKAPI' | 'SIAP';
  needsReview?: boolean;
}

export const AssessmentDocumentPreview: React.FC<AssessmentDocumentPreviewProps> = ({
  model,
  workflowStatus,
  needsReview,
}) => {
  const meta = model.metadata;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* STATUS BANNER */}
      <div
        className={`p-4 rounded-lg border flex flex-col md:flex-row md:items-center md:justify-between gap-2 ${
          workflowStatus === 'SIAP'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : workflowStatus === 'PERLU_DILENGKAPI'
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : 'bg-blue-50 border-blue-300 text-blue-900'
        }`}
      >
        <div>
          <h3 className="font-bold text-sm uppercase tracking-wide">
            {workflowStatus === 'SIAP' && 'Pratinjau Dokumen SIAP'}
            {workflowStatus === 'PERLU_DILENGKAPI' && 'Pratinjau — Perlu Dilengkapi'}
            {workflowStatus === 'DRAFT' && 'Pratinjau Draf'}
          </h3>
          <p className="text-xs mt-0.5 opacity-90">
            {workflowStatus === 'SIAP' && 'Dokumen siap untuk verifikasi dan ekspor resmi.'}
            {workflowStatus === 'PERLU_DILENGKAPI' && 'Dokumen masih memiliki bagian yang perlu diperbaiki.'}
            {workflowStatus === 'DRAFT' && 'Dokumen ini belum dikonfirmasi SIAP.'}
          </p>
        </div>
        {needsReview && (
          <div className="inline-flex items-center px-2.5 py-1 rounded bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold self-start md:self-auto">
            Masih memerlukan review guru.
          </div>
        )}
      </div>

      {/* DOCUMENT SHEET */}
      <div className="bg-white border border-slate-300 shadow-sm rounded-lg p-6 md:p-10 space-y-8 text-slate-800 text-sm font-sans leading-relaxed">
        {/* HEADER / TITLES */}
        <div className="text-center space-y-1 pb-4 border-b border-slate-200">
          <h2 className="text-lg md:text-xl font-extrabold uppercase tracking-tight text-slate-900">
            {meta.title}
          </h2>
          {meta.subTitle && (
            <p className="text-sm font-semibold text-slate-600">{meta.subTitle}</p>
          )}
          <p className="text-xs text-slate-500 font-medium">{meta.schoolName}</p>
        </div>

        {/* IDENTITAS */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
            Informasi Dokumen & Satuan Pendidikan
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            <div className="flex justify-between py-0.5 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Satuan Pendidikan:</span>
              <span className="font-semibold text-slate-800">{meta.schoolName || '-'}</span>
            </div>
            {meta.npsn && (
              <div className="flex justify-between py-0.5 border-b border-slate-50">
                <span className="text-slate-500 font-medium">NPSN:</span>
                <span className="font-semibold text-slate-800">{meta.npsn}</span>
              </div>
            )}
            <div className="flex justify-between py-0.5 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Mata Pelajaran:</span>
              <span className="font-semibold text-slate-800">{meta.subject || '-'}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Fase / Kelas:</span>
              <span className="font-semibold text-slate-800">
                {meta.phase ? `Fase ${meta.phase}` : ''} {meta.grade ? `Kelas ${meta.grade}` : ''}
              </span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Tahun Ajaran:</span>
              <span className="font-semibold text-slate-800">{meta.academicYear || '-'}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Semester:</span>
              <span className="font-semibold text-slate-800">{meta.semester || '-'}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Guru Pengampu:</span>
              <span className="font-semibold text-slate-800">{meta.teacherName || '-'}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Tanggal Dokumen:</span>
              <span className="font-semibold text-slate-800">{meta.formattedDocumentDate || meta.documentDate || '-'}</span>
            </div>
            {meta.packageRevision !== undefined && (
              <div className="flex justify-between py-0.5 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Nomor Revisi:</span>
                <span className="font-semibold text-slate-800">Rev {meta.packageRevision}</span>
              </div>
            )}
          </div>
        </div>

        {/* SECTION I: KISI-KISI ASESMEN */}
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 border-l-4 border-blue-600 pl-2">
            I. Kisi-Kisi Asesmen
          </h3>
          {model.kisiKisi.rows.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Belum ada kisi-kisi asesmen.</p>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-2 w-10 text-center">No</th>
                    <th className="p-2">Tujuan Pembelajaran / KD</th>
                    <th className="p-2">Indikator</th>
                    <th className="p-2">Materi / Konteks</th>
                    <th className="p-2">Instrumen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {model.kisiKisi.rows.map((row) => (
                    <tr key={`kisikisi-${row.no}`} className="hover:bg-slate-50/50">
                      <td className="p-2 text-center font-semibold text-slate-600">{row.no}</td>
                      <td className="p-2">
                        <div className="text-slate-800">{row.tpCodeAndStatement}</div>
                      </td>
                      <td className="p-2 text-slate-700">{row.indicator}</td>
                      <td className="p-2 text-slate-700">{row.material || '-'}</td>
                      <td className="p-2 text-slate-700 font-medium">{row.instrumentType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION II: INSTRUMEN ASESMEN */}
        <div className="space-y-6 pt-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 border-l-4 border-blue-600 pl-2">
            II. Instrumen Asesmen
          </h3>
          {model.instruments.list.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Belum ada instrumen asesmen.</p>
          ) : (
            model.instruments.list.map((inst, instIdx) => (
              <div key={inst.id} className="p-4 rounded border border-slate-200 bg-slate-50/60 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                    Instrumen {instIdx + 1}: {inst.title || inst.typeLabel || inst.type}
                  </h4>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {inst.typeLabel || inst.type}
                  </span>
                </div>

                {/* WRITTEN TEST */}
                {inst.type === 'WRITTEN_TEST' && (
                  <div className="space-y-4">
                    {inst.writtenItems && inst.writtenItems.length > 0 ? (
                      inst.writtenItems.map((item) => (
                        <div key={`written-${inst.id}-${item.no}`} className="space-y-2 p-3 bg-white border border-slate-200 rounded">
                          {item.stimulus && (
                            <div className="p-2 bg-slate-50 border-l-2 border-slate-400 text-xs italic text-slate-700">
                              {item.stimulus}
                            </div>
                          )}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1">
                              <span className="font-bold text-xs text-slate-700">{item.no}.</span>
                              <div className="text-xs text-slate-800 flex-1">{item.prompt}</div>
                            </div>
                            {item.itemType && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 shrink-0">
                                {item.itemType}
                              </span>
                            )}
                          </div>
                          {item.options && item.options.length > 0 && (
                            <div className="pl-6 space-y-1">
                              {item.options.map((opt, optIdx) => (
                                <div key={`written-${inst.id}-${item.no}-${opt.label || optIdx}`} className="text-xs text-slate-700 flex items-start gap-2">
                                  <span className="font-semibold text-slate-600">{opt.label}.</span>
                                  <span>{opt.text}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">Belum ada butir soal tes tertulis.</p>
                    )}
                  </div>
                )}

                {/* ORAL TEST */}
                {inst.type === 'ORAL_TEST' && (
                  <div className="space-y-3">
                    {inst.instructions && (
                      <div className="text-xs text-slate-600">
                        <span className="font-semibold">Petunjuk:</span> {inst.instructions}
                      </div>
                    )}
                    {inst.oralItems && inst.oralItems.length > 0 ? (
                      inst.oralItems.map((item) => (
                        <div key={`oral-${inst.id}-${item.no}`} className="p-3 bg-white border border-slate-200 rounded space-y-1">
                          <div className="flex items-start gap-2 text-xs">
                            <span className="font-bold text-slate-700">#{item.no}</span>
                            <div className="flex-1">
                              <span className="font-semibold text-slate-800">Pertanyaan:</span> {item.prompt}
                            </div>
                          </div>
                          {item.expectedResponse && (
                            <div className="pl-6 text-xs text-slate-600">
                              <span className="font-medium text-slate-500">Respons yang Diharapkan:</span> {item.expectedResponse}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">Belum ada butir tes lisan.</p>
                    )}
                  </div>
                )}

                {/* PERFORMANCE */}
                {inst.type === 'PERFORMANCE' && (
                  <div className="space-y-3">
                    {inst.task && (
                      <div className="p-2.5 bg-white border border-slate-200 rounded text-xs space-y-1">
                        <span className="font-bold text-slate-700 block">Tugas Kinerja / Praktik:</span>
                        <p className="text-slate-800 whitespace-pre-wrap">{inst.task}</p>
                      </div>
                    )}
                    {inst.instructions && (
                      <div className="text-xs text-slate-600">
                        <span className="font-semibold">Petunjuk Pelaksanaan:</span> {inst.instructions}
                      </div>
                    )}
                    {inst.performanceAspects && inst.performanceAspects.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-xs font-bold text-slate-700 block">Aspek Penilaian:</span>
                        <div className="grid grid-cols-1 gap-2">
                          {inst.performanceAspects.map((asp, aIdx) => (
                            <div key={`perf-aspect-${inst.id}-${aIdx}`} className="p-2 bg-white border border-slate-200 rounded text-xs">
                              <div className="flex items-center justify-between font-semibold text-slate-800">
                                <span>{aIdx + 1}. {asp.label}</span>
                                {asp.weight !== undefined && (
                                  <span className="text-slate-500 font-normal">Bobot: {asp.weight}</span>
                                )}
                              </div>
                              {asp.description && (
                                <p className="text-slate-600 mt-0.5">{asp.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* OBSERVATION */}
                {inst.type === 'OBSERVATION' && (
                  <div className="space-y-3">
                    {inst.instructions && (
                      <div className="text-xs text-slate-600">
                        <span className="font-semibold">Petunjuk Observasi:</span> {inst.instructions}
                      </div>
                    )}
                    {inst.recordingScheme && (
                      <div className="text-xs text-slate-600">
                        <span className="font-semibold">Skema Pencatatan:</span> {inst.recordingScheme}
                      </div>
                    )}
                    {inst.observationAspects && inst.observationAspects.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-xs font-bold text-slate-700 block">Aspek Observasi:</span>
                        <div className="grid grid-cols-1 gap-2">
                          {inst.observationAspects.map((asp, oIdx) => (
                            <div key={`obs-aspect-${inst.id}-${oIdx}`} className="p-2 bg-white border border-slate-200 rounded text-xs">
                              <span className="font-semibold text-slate-800 block">{oIdx + 1}. {asp.label}</span>
                              {asp.indicator && (
                                <p className="text-slate-600 mt-0.5"><span className="font-medium text-slate-500">Indikator:</span> {asp.indicator}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ASSIGNMENT */}
                {inst.type === 'ASSIGNMENT' && (
                  <div className="space-y-2 p-3 bg-white border border-slate-200 rounded text-xs">
                    {inst.instructions && (
                      <div>
                        <span className="font-bold text-slate-700 block mb-0.5">Instruksi Penugasan:</span>
                        <p className="text-slate-800 whitespace-pre-wrap">{inst.instructions}</p>
                      </div>
                    )}
                    {inst.expectedOutput && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="font-semibold text-slate-600">Hasil / Luaran yang Diharapkan:</span>{' '}
                        <span className="text-slate-800">{inst.expectedOutput}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* PROJECT */}
                {inst.type === 'PROJECT' && (
                  <div className="space-y-2 p-3 bg-white border border-slate-200 rounded text-xs">
                    {inst.projectBrief && (
                      <div>
                        <span className="font-bold text-slate-700 block mb-0.5">Deskripsi / Brief Proyek:</span>
                        <p className="text-slate-800 whitespace-pre-wrap">{inst.projectBrief}</p>
                      </div>
                    )}
                    {inst.expectedDeliverable && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="font-semibold text-slate-600">Luaran Proyek yang Diharapkan:</span>{' '}
                        <span className="text-slate-800">{inst.expectedDeliverable}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* PRODUCT */}
                {inst.type === 'PRODUCT' && (
                  <div className="space-y-2 p-3 bg-white border border-slate-200 rounded text-xs">
                    {inst.productBrief && (
                      <div>
                        <span className="font-bold text-slate-700 block mb-0.5">Deskripsi / Spesifikasi Produk:</span>
                        <p className="text-slate-800 whitespace-pre-wrap">{inst.productBrief}</p>
                      </div>
                    )}
                    {inst.expectedProduct && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="font-semibold text-slate-600">Produk yang Diharapkan:</span>{' '}
                        <span className="text-slate-800">{inst.expectedProduct}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* PORTFOLIO */}
                {inst.type === 'PORTFOLIO' && (
                  <div className="space-y-2 p-3 bg-white border border-slate-200 rounded text-xs">
                    {inst.instructions && (
                      <div className="mb-2">
                        <span className="font-bold text-slate-700 block mb-0.5">Petunjuk Portofolio:</span>
                        <p className="text-slate-800 whitespace-pre-wrap">{inst.instructions}</p>
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-slate-700 block mb-1">Persyaratan Bukti Portofolio:</span>
                      {inst.evidenceRequirements && inst.evidenceRequirements.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-1 text-slate-700">
                          {inst.evidenceRequirements.map((req, rIdx) => (
                            <li key={`portfolio-req-${inst.id}-${rIdx}`}>{req}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-slate-400 italic">Belum ada persyaratan bukti.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* SELF & PEER ASSESSMENT */}
                {(inst.type === 'SELF_ASSESSMENT' || inst.type === 'PEER_ASSESSMENT') && (
                  <div className="space-y-3">
                    {inst.instructions && (
                      <div className="text-xs text-slate-600">
                        <span className="font-semibold">Petunjuk:</span> {inst.instructions}
                      </div>
                    )}
                    {inst.responseScheme && (
                      <div className="text-xs text-slate-600">
                        <span className="font-semibold">Skema Respon:</span> {inst.responseScheme}
                      </div>
                    )}
                    {inst.selfPeerItems && inst.selfPeerItems.length > 0 ? (
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-slate-700 block">Daftar Pernyataan Refleksi / Penilaian:</span>
                        {inst.selfPeerItems.map((item) => (
                          <div key={`self-peer-${inst.id}-${item.no}`} className="p-2.5 bg-white border border-slate-200 rounded text-xs flex items-start gap-2">
                            <span className="font-bold text-slate-600">{item.no}.</span>
                            <div className="flex-1">
                              <p className="text-slate-800">{item.statement}</p>
                              {item.category && (
                                <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
                                  Kategori: {item.category}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Belum ada butir pernyataan.</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* SECTION III: KUNCI JAWABAN */}
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 border-l-4 border-blue-600 pl-2">
            III. Kunci Jawaban
          </h3>
          {model.answerKeys.list.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Tidak ada kunci jawaban terpisah.</p>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-2 w-16 text-center">No. Butir</th>
                    <th className="p-2 w-32">Instrumen</th>
                    <th className="p-2 w-32">Tipe Kunci</th>
                    <th className="p-2">Kunci Jawaban</th>
                    <th className="p-2">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {model.answerKeys.list.map((ak, akIdx) => (
                    <tr key={`answer-key-${akIdx}`} className="hover:bg-slate-50/50">
                      <td className="p-2 text-center font-semibold text-slate-600">
                        {ak.itemNumber ?? '-'}
                      </td>
                      <td className="p-2 text-slate-700 font-medium">{ak.instrumentType}</td>
                      <td className="p-2 text-slate-700">{ak.answerType}</td>
                      <td className="p-2 font-semibold text-blue-700">{ak.value || '-'}</td>
                      <td className="p-2 text-slate-600">{ak.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION IV: PEDOMAN PENSKORAN */}
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 border-l-4 border-blue-600 pl-2">
            IV. Pedoman Penskoran
          </h3>
          {model.scoringGuides.list.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Belum ada pedoman penskoran.</p>
          ) : (
            <div className="space-y-3">
              {model.scoringGuides.list.map((guide, guideIdx) => (
                <div key={`scoring-guide-${guideIdx}-${guide.title}`} className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{guide.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
                      {guide.guideType}
                    </span>
                  </div>
                  {guide.instructions && (
                    <p className="text-slate-700"><span className="font-semibold">Instruksi:</span> {guide.instructions}</p>
                  )}
                  {guide.maxScore !== undefined && (
                    <p className="text-slate-700"><span className="font-semibold">Skor Maksimal:</span> {guide.maxScore}</p>
                  )}
                  {guide.notes && (
                    <p className="text-slate-500 italic"><span className="font-semibold not-italic">Catatan:</span> {guide.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION V: RUBRIK PENILAIAN */}
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 border-l-4 border-blue-600 pl-2">
            V. Rubrik Penilaian
          </h3>
          {model.rubrics.list.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Belum ada rubrik penilaian.</p>
          ) : (
            <div className="space-y-4">
              {model.rubrics.list.map((rub, rubIdx) => (
                <div key={`rubric-${rubIdx}-${rub.title}`} className="p-4 bg-slate-50 border border-slate-200 rounded space-y-3 text-xs">
                  <div className="font-bold text-slate-800 text-sm">{rub.title}</div>
                  {rub.scale && rub.scale.length > 0 && rub.criteria && rub.criteria.length > 0 ? (
                    <div className="overflow-x-auto border border-slate-200 rounded">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                            <th className="p-2 w-1/3">Kriteria</th>
                            {rub.scale.map((sc, scIdx) => (
                              <th key={`scale-head-${rubIdx}-${scIdx}`} className="p-2 text-center">
                                <div>{sc.label}</div>
                                {sc.score !== undefined && (
                                  <div className="text-[10px] font-normal text-slate-500">({sc.score})</div>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {rub.criteria.map((crit, critIdx) => (
                            <tr key={`criterion-${rubIdx}-${critIdx}`} className="hover:bg-slate-50/50">
                              <td className="p-2 font-semibold text-slate-800 align-top">
                                <div>{critIdx + 1}. {crit.label}</div>
                                {crit.weight !== undefined && (
                                  <span className="text-[10px] text-slate-500 font-normal">Bobot: {crit.weight}</span>
                                )}
                              </td>
                              {rub.scale.map((_, sIdx) => (
                                <td key={`desc-${rubIdx}-${critIdx}-${sIdx}`} className="p-2 text-slate-600 align-top text-[11px]">
                                  {crit.descriptors && crit.descriptors[sIdx] ? crit.descriptors[sIdx] : '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <>
                      {rub.criteria && rub.criteria.length > 0 && (
                        <div className="space-y-2">
                          <span className="font-semibold text-slate-700 block">Kriteria Penilaian:</span>
                          <div className="space-y-1.5">
                            {rub.criteria.map((crit, critIdx) => (
                              <div key={`criterion-${rubIdx}-${critIdx}`} className="p-2 bg-white border border-slate-200 rounded">
                                <div className="flex justify-between font-semibold text-slate-800">
                                  <span>{critIdx + 1}. {crit.label}</span>
                                  {crit.weight !== undefined && (
                                    <span className="text-slate-500 font-normal">Bobot: {crit.weight}</span>
                                  )}
                                </div>
                                {crit.descriptors && crit.descriptors.length > 0 && (
                                  <p className="text-slate-600 mt-0.5 text-[11px]">{crit.descriptors.join('; ')}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {rub.scale && rub.scale.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-slate-200">
                          <span className="font-semibold text-slate-700 block">Skala Penilaian:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                            {rub.scale.map((sc, scIdx) => (
                              <div key={`scale-${rubIdx}-${scIdx}`} className="p-2 bg-white border border-slate-200 rounded">
                                <div className="font-semibold text-slate-800 flex justify-between">
                                  <span>{sc.label}</span>
                                  {sc.score !== undefined && <span className="text-blue-600">({sc.score})</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SIGNOFF */}
        <div className="pt-8 border-t border-slate-200 text-xs">
          <div className="text-right text-slate-700 font-medium mb-6">
            {model.signoff.locationAndDate}
          </div>
          <div className="grid grid-cols-2 gap-8 text-center">
            <div className="space-y-16">
              <div className="font-medium text-slate-700">{model.signoff.principalTitle}</div>
              <div>
                <div className="font-bold underline text-slate-800">{model.signoff.principalName}</div>
                {model.signoff.principalNip && (
                  <div className="text-slate-600">{model.signoff.principalNip}</div>
                )}
              </div>
            </div>
            <div className="space-y-16">
              <div className="font-medium text-slate-700">{model.signoff.teacherTitle}</div>
              <div>
                <div className="font-bold underline text-slate-800">{model.signoff.teacherName}</div>
                {model.signoff.teacherNip && (
                  <div className="text-slate-600">{model.signoff.teacherNip}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
