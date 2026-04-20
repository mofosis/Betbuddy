import React from 'react';
import { Coins, ShieldCheck, Zap, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

interface LandingPageProps {
  onSignIn: () => void;
}

export function LandingPage({ onSignIn }: LandingPageProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 relative overflow-hidden bg-app-bg">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-app-accent/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-2xl"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-app-accent/10 border border-app-accent/20 text-app-accent text-sm font-medium mb-6">
          <Zap className="w-4 h-4" />
          <span>Wetten ohne Risiko</span>
        </div>
        
        <h1 className="text-6xl md:text-7xl font-bold text-app-text mb-6 tracking-tight">
          Wette mit <span className="text-app-accent">Freunden</span>, nicht mit Geld.
        </h1>
        
        <p className="text-xl text-app-text/60 mb-10 leading-relaxed">
          BetBuddy ist die soziale Plattform für fiktive Wetten. Fordere deine Freunde heraus, setze deine BetCoins und verfolge deine Erfolge – ganz ohne echtes Geld.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onSignIn}
            className="w-full sm:w-auto px-8 py-4 bg-app-accent hover:opacity-90 text-app-bg rounded-2xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-5 h-5" />
            Jetzt mit Google starten
          </button>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="p-6 bg-app-card border border-app-border rounded-2xl">
            <div className="w-10 h-10 bg-app-accent/10 rounded-xl flex items-center justify-center mb-4">
              <Coins className="text-app-accent w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-app-text mb-2">1.000 Start-Coins</h3>
            <p className="text-app-text/60 text-sm">Jeder neue User startet mit einem Guthaben von 1.000 fiktiven BetCoins.</p>
          </div>
          <div className="p-6 bg-app-card border border-app-border rounded-2xl">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4">
              <TrendingUp className="text-blue-500 w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-app-text mb-2">Eigene Wetten</h3>
            <p className="text-app-text/60 text-sm">Erstelle individuelle Wetten zu jedem Thema und lade andere dazu ein.</p>
          </div>
          <div className="p-6 bg-app-card border border-app-border rounded-2xl">
            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center mb-4">
              <ShieldCheck className="text-purple-500 w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-app-text mb-2">Trackbare Historie</h3>
            <p className="text-app-text/60 text-sm">Alle Wetten bleiben gespeichert, auch wenn sie bereits abgeschlossen sind.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
