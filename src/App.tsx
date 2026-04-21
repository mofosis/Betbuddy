import React, { useState, useEffect } from 'react';
import { UserProfile } from './types';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { UserProfileModal } from './components/UserProfileModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedBetId, setSelectedBetId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then(r => { if (!r.ok) throw new Error('Auth error'); return r.json(); })
      .then(data => { setProfile(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!profile?.uid) return;
    const es = new EventSource('/api/events');
    es.addEventListener('profile_updated', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setProfile(prev => prev ? { ...prev, ...data } : prev);
    });
    return () => es.close();
  }, [profile?.uid]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', profile?.theme || 'brutal-flat');
  }, [profile?.theme]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl font-bold mb-2">Nicht eingeloggt</p>
          <p className="text-zinc-400 text-sm">Bitte über Authelia einloggen.</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-[100dvh] bg-app-bg text-app-text font-sans selection:bg-app-accent/30 transition-colors duration-300">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col min-h-[100dvh]">
          <Navbar
            profile={profile}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            onBetInviteClick={(betId) => setSelectedBetId(betId)}
          />
          <main className="flex-1 max-w-7xl mx-auto w-full px-4 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom))] md:pb-8">
            <Dashboard
              profile={profile}
              onProfileUpdate={setProfile}
              initialBetId={selectedBetId}
              onBetIdHandled={() => setSelectedBetId(null)}
            />
          </main>
          <AnimatePresence>
            {isProfileModalOpen && (
              <UserProfileModal
                profile={profile}
                onClose={() => setIsProfileModalOpen(false)}
                onProfileUpdate={setProfile}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </ErrorBoundary>
  );
}
