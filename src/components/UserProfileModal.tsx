import React, { useState, useEffect } from 'react';
import { UserProfile, Bet } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, query, collection, onSnapshot, orderBy } from 'firebase/firestore';
import { X, User as UserIcon, Camera, Save, Trophy, XCircle, Coins, Mail, Palette, History, Settings, Bell, BellOff, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BetCard } from './BetCard';

interface UserProfileModalProps {
  profile: UserProfile;
  onClose: () => void;
}

export function UserProfileModal({ profile, onClose }: UserProfileModalProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [photoURL, setPhotoURL] = useState(profile.photoURL || '');
  const [theme, setTheme] = useState(profile.theme || 'dark');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'history'>('settings');
  const [userBets, setUserBets] = useState<Bet[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'bets'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allBets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bet));
      const filtered = allBets.filter(bet => bet.participants && !!bet.participants[profile.uid]);
      setUserBets(filtered);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'bets'));
    return () => unsubscribe();
  }, [profile.uid]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        displayName,
        photoURL: photoURL || null,
        theme,
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  const winRate = profile.wins + profile.losses > 0 
    ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100) 
    : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 20 }} 
        className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-[calc(2rem+env(safe-area-inset-bottom))]">
          {/* Header/Banner */}
          <div className="relative h-32 bg-gradient-to-br from-emerald-500/20 to-zinc-900 border-b border-zinc-800">
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-zinc-950/50 hover:bg-zinc-950 text-zinc-400 hover:text-white rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-8">
            {/* Avatar Section */}
            <div className="relative -mt-16 mb-6 flex justify-center">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full bg-zinc-800 border-4 border-zinc-900 overflow-hidden shadow-xl">
                {photoURL ? (
                  <img src={photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <UserIcon className="w-12 h-12 text-zinc-600" />
                  </div>
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
                <Camera className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 p-1 bg-zinc-950 rounded-2xl border border-zinc-800">
            <button 
              onClick={() => setActiveTab('settings')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'settings' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Settings className="w-4 h-4" />
              Profil
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'history' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <History className="w-4 h-4" />
              Wetten ({userBets.length})
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'settings' ? (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                  <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-2xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-xl">
                      <Coins className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-white leading-none">{profile.balance}</div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mt-1">Guthaben</div>
                    </div>
                  </div>
                  <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-2xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-xl">
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-white leading-none">{winRate}%</div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mt-1">Win Rate</div>
                    </div>
                  </div>
                  <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-2xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/10 rounded-xl">
                      <Trophy className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-white leading-none">{profile.wins}</div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mt-1">Siege</div>
                    </div>
                  </div>
                  <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-2xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-red-500/10 rounded-xl">
                      <XCircle className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-white leading-none">{profile.losses}</div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mt-1">Niederlagen</div>
                    </div>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSave} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Anzeigename</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-12 pr-4 py-3.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                        placeholder="Dein Name"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Avatar URL</label>
                    <div className="relative">
                      <Camera className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                      <input
                        type="url"
                        value={photoURL}
                        onChange={(e) => setPhotoURL(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-12 pr-4 py-3.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <Palette className="w-3 h-3" />
                      Design Theme
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { id: 'dark', label: 'Dark', bg: '#09090b', card: '#18181b', accent: '#10b981' },
                        { id: 'light', label: 'Light', bg: '#f8fafc', card: '#ffffff', accent: '#3b82f6' },
                        { id: 'cyber', label: 'Cyber', bg: '#000000', card: '#0a0a0a', accent: '#ff00ff' },
                        { id: 'midnight', label: 'Midnight', bg: '#171026', card: '#2b1b42', accent: '#d946ef' },
                        { id: 'neon', label: 'Neon', bg: '#050510', card: '#0a0a20', accent: '#00f0ff' },
                        { id: 'brutal', label: 'Brutalism', bg: '#e5e5e5', card: '#fef08a', accent: '#ff3366' },
                        { id: 'brutal-flat', label: 'Flat Brutal', bg: '#f4f4f0', card: '#67e8f9', accent: '#2563eb' },
                        { id: 'brutal-dark', label: 'Dark Brutal', bg: '#121212', card: '#000000', accent: '#eab308' }
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTheme(t.id as any)}
                          className={`relative flex flex-col items-center gap-2 p-2 rounded-2xl border-2 transition-all overflow-hidden ${
                            theme === t.id 
                              ? 'border-emerald-500 bg-emerald-500/10' 
                              : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
                          }`}
                        >
                          <div 
                            className="w-full aspect-video rounded-xl border border-zinc-800/50 flex flex-col p-1.5 gap-1.5 shadow-inner"
                            style={{ backgroundColor: t.bg }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="w-4 h-1.5 rounded-full opacity-50" style={{ backgroundColor: t.accent }} />
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.accent }} />
                            </div>
                            <div className="flex-1 rounded-lg p-1.5 flex flex-col gap-1" style={{ backgroundColor: t.card }}>
                              <div className="w-3/4 h-1 rounded-full opacity-40" style={{ backgroundColor: t.accent }} />
                              <div className="w-1/2 h-1 rounded-full opacity-20" style={{ backgroundColor: t.accent }} />
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === t.id ? 'text-emerald-400' : 'text-zinc-400'}`}>
                            {t.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 space-y-3">
                    <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-zinc-500" />
                        <span className="text-sm text-zinc-400">{profile.email}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20"
                  >
                    {isSaving ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Änderungen speichern
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 pr-2"
              >
                {userBets.length > 0 ? (
                  userBets.map(bet => (
                    <React.Fragment key={bet.id}>
                      <BetCard 
                        bet={bet}
                        currentUserId={profile.uid}
                        isAdmin={profile.email === 'martinmosteil@gmail.com'}
                      />
                    </React.Fragment>
                  ))
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-zinc-600 border-2 border-dashed border-zinc-800 rounded-3xl">
                    <History className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm font-medium">Noch keine Wetten teilgenommen.</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
    </div>
  );
}
