import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, CheckSquare, Square, RefreshCw } from 'lucide-react';
import { ResetOptions, resetAllData } from '../services/adminService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ResetSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ResetSystemModal({ isOpen, onClose }: ResetSystemModalProps) {
  const [options, setOptions] = useState<ResetOptions>({
    resetBets: true,
    resetNotifications: true,
    resetUserStats: true,
  });
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleToggle = (key: keyof ResetOptions) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
    setErrorMsg(null);
  };

  const handleReset = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const selectedCount = Object.values(options).filter(Boolean).length;
    if (selectedCount === 0) {
      setErrorMsg('Bitte wähle mindestens eine Option zum Zurücksetzen aus.');
      return;
    }

    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setLoading(true);
    try {
      console.log('Starting system reset with options:', options);
      await resetAllData(options);
      setSuccessMsg('System erfolgreich zurückgesetzt!');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Reset failed:', error);
      setErrorMsg('Reset fehlgeschlagen: ' + (error instanceof Error ? error.message : String(error)));
      setShowConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setShowConfirm(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-app-bg/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-app-card border border-app-border rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-app-border flex items-center justify-between bg-red-500/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-app-text">
                    {showConfirm ? 'Bist du sicher?' : 'System Reset'}
                  </h2>
                  <p className="text-xs text-app-text/40 uppercase tracking-widest font-bold">Admin Only</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-app-bg rounded-xl text-app-text/40 hover:text-app-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs px-3 py-2 rounded-lg">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs px-3 py-2 rounded-lg">
                  {successMsg}
                </div>
              )}
              {showConfirm ? (
                <div className="space-y-4">
                  <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-3xl text-center space-y-3">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
                    <h3 className="text-lg font-bold text-red-500">Unwiderrufliche Aktion</h3>
                    <p className="text-sm text-red-500/80">
                      Du bist dabei, die gewählten Daten dauerhaft zu löschen. Dieser Vorgang kann nicht rückgängig gemacht werden.
                    </p>
                  </div>
                  <div className="p-4 bg-app-bg/50 rounded-2xl border border-app-border">
                    <p className="text-xs font-bold text-app-text/40 uppercase tracking-widest mb-2">Ausgewählte Aktionen:</p>
                    <ul className="text-sm text-app-text/70 space-y-1">
                      {options.resetBets && <li>• Alle Wetten löschen</li>}
                      {options.resetNotifications && <li>• Alle Benachrichtigungen löschen</li>}
                      {options.resetUserStats && <li>• User-Stats (Guthaben/Wins) zurücksetzen</li>}
                    </ul>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                    <p className="text-sm text-red-500/80 leading-relaxed">
                      <strong>Achtung:</strong> Das Zurücksetzen löscht unwiderruflich Daten aus der Datenbank. Wähle sorgfältig aus, was du behalten möchtest.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <ResetOptionItem 
                      label="Wetten löschen" 
                      description="Alle aktiven, offenen und beendeten Wetten entfernen."
                      checked={options.resetBets}
                      onToggle={() => handleToggle('resetBets')}
                    />
                    <ResetOptionItem 
                      label="Benachrichtigungen löschen" 
                      description="Alle System- und User-Benachrichtigungen entfernen."
                      checked={options.resetNotifications}
                      onToggle={() => handleToggle('resetNotifications')}
                    />
                    <ResetOptionItem 
                      label="User-Stats zurücksetzen" 
                      description="Alle Guthaben auf 1000 setzen, Wins/Losses auf 0."
                      checked={options.resetUserStats}
                      onToggle={() => handleToggle('resetUserStats')}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="p-6 bg-app-bg/50 border-t border-app-border flex gap-3">
              <button
                onClick={showConfirm ? () => setShowConfirm(false) : handleClose}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-app-card border border-app-border hover:bg-app-border text-app-text font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {showConfirm ? 'Zurück' : 'Abbrechen'}
              </button>
              <button
                onClick={handleReset}
                disabled={loading}
                className={cn(
                  "flex-[2] py-3 px-4 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50",
                  showConfirm ? "bg-red-600 hover:bg-red-700 shadow-red-600/20" : "bg-red-500 hover:bg-red-600 shadow-red-500/20"
                )}
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5" />
                    {showConfirm ? 'JETZT LÖSCHEN' : 'Reset ausführen'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ResetOptionItem({ label, description, checked, onToggle }: { label: string, description: string, checked: boolean, onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-start gap-4 p-4 bg-app-bg/30 border border-app-border rounded-2xl hover:border-app-accent/50 transition-all text-left group"
    >
      <div className="mt-0.5">
        {checked ? (
          <CheckSquare className="w-5 h-5 text-app-accent" />
        ) : (
          <Square className="w-5 h-5 text-app-text/20 group-hover:text-app-text/40" />
        )}
      </div>
      <div>
        <div className="font-bold text-app-text text-sm">{label}</div>
        <div className="text-xs text-app-text/40 mt-0.5">{description}</div>
      </div>
    </button>
  );
}
