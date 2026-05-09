import React, { useState } from 'react';
import { FolderOpen, ArrowRight, Sparkles, FolderSearch } from 'lucide-react';
import { initializeStorage, migrateFromLocalStorage } from '../../lib/fileSystemStorage';
import { Capacitor } from '@capacitor/core';
import { FolderPicker as NativeFolderPicker } from '../../lib/folderPickerPlugin';

interface FolderPickerProps {
  onComplete: () => void;
}

export function FolderPicker({ onComplete }: FolderPickerProps) {
  const [selectedPath, setSelectedPath] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [showContent, setShowContent] = useState(false);

  // Fallback folder name for web/non-native environments
  const [webFolderName, setWebFolderName] = useState('KryptonIDE');

  React.useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(t);
  }, []);

  const isNative = Capacitor.isNativePlatform();

  const handleSelectFolder = async () => {
    setError('');
    try {
      const result = await NativeFolderPicker.pickFolder();
      if (result.path) {
        setSelectedPath(result.path);
      } else {
        // User selected root of external storage
        setSelectedPath('KryptonIDE');
      }
    } catch (e: any) {
      // User cancelled the picker
      if (e?.message?.includes('cancelled')) {
        return;
      }
      console.error('Folder picker error:', e);
      setError(e.message || 'Failed to select folder. Please try again.');
    }
  };

  const handleContinue = async () => {
    const folderPath = isNative ? selectedPath : webFolderName.trim();

    if (!folderPath) {
      setError('Please select a folder first');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      await initializeStorage(folderPath);
      // Migrate any existing localStorage data
      await migrateFromLocalStorage();
      onComplete();
    } catch (e: any) {
      console.error('Storage init error:', e);
      setError(e.message || 'Failed to initialize storage. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-white dark:bg-[#050505] flex flex-col items-center justify-center px-8 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-emerald-500/[0.08] blur-[120px] animate-ambient-drift" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] rounded-full bg-blue-500/[0.06] blur-[120px] animate-ambient-drift" style={{ animationDelay: '-8s' }} />
      </div>

      <div className={`relative flex flex-col items-center max-w-md w-full transition-all duration-700 ease-out ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {/* Icon */}
        <div className="mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-3xl animate-pulse-glow" />
            <div className="relative w-24 h-24 rounded-[1.75rem] bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30 border border-white/10">
              <FolderOpen size={40} className="text-white" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300 mb-2 tracking-tight text-center">
          Choose Storage Folder
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-base mb-8 text-center leading-relaxed max-w-[320px]">
          Select where your projects and files will be saved. You can browse and edit them with any file manager.
        </p>

        {/* Selected Folder Preview */}
        {isNative ? (
          <>
            <div className="w-full bg-gray-100 dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-4 mb-4">
              <div className="text-[11px] text-gray-500 dark:text-gray-500 uppercase tracking-wider font-semibold mb-2">
                Storage Location
              </div>
              {selectedPath ? (
                <div className="flex items-center space-x-2 text-sm font-mono">
                  <span className="text-gray-400 dark:text-gray-600 truncate">/storage/emulated/0/</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate">{selectedPath}</span>
                  <span className="text-gray-400 dark:text-gray-600">/</span>
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-500 italic">
                  No folder selected yet
                </div>
              )}
            </div>

            {/* Select Folder Button */}
            <button
              onClick={handleSelectFolder}
              className="w-full flex items-center justify-center space-x-2 py-3.5 rounded-2xl font-bold text-base shadow-lg active:scale-[0.97] transition-all duration-300 bg-[#111] border border-white/10 text-white hover:bg-[#1a1a1a] hover:border-emerald-500/30 mb-3"
            >
              <FolderSearch size={20} className="text-emerald-400" />
              <span>{selectedPath ? 'Change Folder' : 'Select Folder'}</span>
            </button>
          </>
        ) : (
          /* Web fallback: text input for folder name */
          <>
            <div className="w-full bg-gray-100 dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-4 mb-4">
              <div className="text-[11px] text-gray-500 dark:text-gray-500 uppercase tracking-wider font-semibold mb-2">
                Storage Path
              </div>
              <div className="flex items-center space-x-2 text-sm font-mono">
                <span className="text-gray-400 dark:text-gray-600 truncate">/storage/emulated/0/</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{webFolderName || '...'}</span>
                <span className="text-gray-400 dark:text-gray-600">/</span>
              </div>
            </div>

            <div className="w-full mb-3">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 block uppercase tracking-wider">
                Folder Name
              </label>
              <input
                autoFocus
                value={webFolderName}
                onChange={(e) => { setWebFolderName(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                placeholder="KryptonIDE"
                className="w-full bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3.5 text-gray-900 dark:text-white text-lg placeholder-gray-400 dark:placeholder-gray-600 focus:border-emerald-500/60 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 transition-all font-semibold"
              />
            </div>
          </>
        )}

        {error && (
          <p className="text-red-400 text-sm mb-3 text-center">{error}</p>
        )}

        {/* Info pill */}
        <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 mb-6 w-full">
          <Sparkles size={14} className="text-emerald-400 flex-shrink-0" />
          <span className="text-[12px] text-emerald-600 dark:text-emerald-300 leading-snug">
            Files will be visible in ZArchiver, Files app, or any file manager on your device.
          </span>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={isCreating || (isNative && !selectedPath)}
          className="w-full flex items-center justify-center space-x-2 py-4 rounded-2xl font-bold text-lg shadow-xl active:scale-[0.97] transition-all duration-300 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 disabled:opacity-60"
        >
          {isCreating ? (
            <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Continue</span>
              <ArrowRight size={20} />
            </>
          )}
        </button>

        <p className="text-gray-500 dark:text-gray-600 text-[11px] mt-6 text-center">
          You can change this later in Settings
        </p>
      </div>
    </div>
  );
}
