import React from 'react';
import { BookOpen, Database, UserCheck, Wifi, WifiOff, FolderPlus, Layers, Plus, Building2 } from 'lucide-react';
import { TeacherProfile, SchoolData, AdministrationWorkspace } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { useOnlineStatus } from '../hooks/usePWAInstall';

interface HeaderProps {
  activeProfile: TeacherProfile;
  school: SchoolData;
  profiles: TeacherProfile[];
  workspaces: AdministrationWorkspace[];
  activeWorkspaceId: string;
  onSelectProfile: (id: string) => void;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspaceClick: () => void;
  onOpenBackupModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeProfile,
  school,
  profiles = [],
  workspaces = [],
  activeWorkspaceId,
  onSelectProfile,
  onSelectWorkspace,
  onCreateWorkspaceClick,
  onOpenBackupModal,
}) => {
  const isOnline = useOnlineStatus();
  const safeProfiles = profiles || [];
  const safeWorkspaces = workspaces || [];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-900 to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-900/10">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                  Administrasi Guru <span className="text-blue-600">AI</span>
                </h1>
                <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                  Kurikulum Merdeka
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block truncate max-w-[200px] md:max-w-none">
                {school.name || 'Satuan Pendidikan'}
              </p>
            </div>
          </div>

          {/* Actions & Workspace/Profile Selector */}
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto py-1">
            {/* Online/Offline status */}
            <div
              className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
              title={isOnline ? 'Terhubung dengan internet' : 'Mode Offline'}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[11px]">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-[11px]">Offline</span>
                </>
              )}
            </div>

            {/* Profile Quick Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <UserCheck className="w-3.5 h-3.5 text-blue-700 ml-1.5 hidden md:block" />
              <select
                id="select-header-profile"
                value={activeProfile?.id || ''}
                onChange={(e) => onSelectProfile(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden py-1 px-1.5 cursor-pointer max-w-[120px] sm:max-w-[150px] truncate"
                title="Ganti Profil Guru yang Sedang Aktif"
              >
                {safeProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Active School Display (Derived from activeProfile.schoolId) */}
            <div
              className="flex items-center gap-1.5 bg-emerald-50/80 px-2.5 py-1.5 rounded-xl border border-emerald-200/80 shrink-0 max-w-[130px] sm:max-w-[190px]"
              title={`Sekolah Utama: ${school.name || 'Satuan Pendidikan'}`}
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="text-xs font-semibold text-emerald-900 truncate">
                {school.name || 'Satuan Pendidikan'}
              </span>
            </div>

            {/* Workspace Quick Switcher */}
            <div className="flex items-center gap-1 bg-blue-50/80 p-1 rounded-xl border border-blue-200/80 shrink-0">
              <Layers className="w-3.5 h-3.5 text-blue-700 ml-1.5 hidden md:block" />
              <select
                id="select-header-workspace"
                value={activeWorkspaceId}
                onChange={(e) => onSelectWorkspace(e.target.value)}
                className="bg-transparent text-xs font-bold text-blue-900 focus:outline-hidden py-1 px-1.5 cursor-pointer max-w-[140px] sm:max-w-[210px] truncate"
                title="Pilih Administrasi Pembelajaran Aktif"
              >
                {safeWorkspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
              <button
                id="btn-header-new-workspace"
                type="button"
                onClick={onCreateWorkspaceClick}
                className="p-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs transition-colors shrink-0 shadow-xs cursor-pointer"
                title="Buat Administrasi / Kelas Baru (+)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Backup / Restore */}
            <button
              id="btn-header-backup"
              onClick={onOpenBackupModal}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium shadow-xs transition-colors cursor-pointer shrink-0"
              title="Cadangkan (Backup) atau Pulihkan (Restore) Data JSON"
            >
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden lg:inline">Backup</span>
            </button>

            {/* PWA Install Button */}
            <PWAInstallButton />
          </div>
        </div>
      </div>
    </header>
  );
};
