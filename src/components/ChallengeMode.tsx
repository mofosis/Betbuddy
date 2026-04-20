import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, setDoc, updateDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { UserProfile } from '../types';
import { Flame, Skull } from 'lucide-react';

interface ChallengeModeData {
  isActive: boolean;
  challengerBalance: number;
  activatedAt: any;
}

interface ChallengeModeProps {
  profile: UserProfile;
  allUsers: UserProfile[];
}

const getMillis = (ts: any) => {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts === 'number') return ts;
  if (ts.seconds) return ts.seconds * 1000;
  return 0;
};

export function ChallengeMode({ profile, allUsers }: ChallengeModeProps) {
  const [challengeData, setChallengeData] = useState<ChallengeModeData | null>(null);
  const isAdmin = profile.email === 'martinmosteil@gmail.com';

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'challengeMode'), (docSnap) => {
      if (docSnap.exists()) {
        setChallengeData(docSnap.data() as ChallengeModeData);
      } else {
        setChallengeData({ isActive: false, challengerBalance: 0, activatedAt: null });
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'system/challengeMode'));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!challengeData?.isActive || !challengeData.activatedAt) return;
    
    // Only admin processes for everyone, normal users process for themselves
    const usersToProcess = isAdmin ? allUsers : allUsers.filter(u => u.uid === profile.uid);

    const interval = setInterval(() => {
      const now = Date.now();
      const threeHours = 3 * 60 * 60 * 1000;

      usersToProcess.forEach(async (user) => {
        const activatedAt = getMillis(challengeData.activatedAt);
        const lastBet = getMillis(user.lastBetResolvedAt);
        const lastDed = getMillis(user.lastChallengeDeductionAt);

        const effectiveStart = Math.max(activatedAt, lastBet, lastDed);
        const periods = Math.floor((now - effectiveStart) / threeHours);

        if (periods > 0) {
          try {
            await runTransaction(db, async (transaction) => {
              const userRef = doc(db, 'users', user.uid);
              const sysRef = doc(db, 'system', 'challengeMode');
              
              const userSnap = await transaction.get(userRef);
              const sysSnap = await transaction.get(sysRef);
              
              if (!userSnap.exists() || !sysSnap.exists()) return;
              
              const uData = userSnap.data() as UserProfile;
              const sData = sysSnap.data() as ChallengeModeData;
              
              if (!sData.isActive) return;

              const currentActivatedAt = getMillis(sData.activatedAt);
              const currentLastBet = getMillis(uData.lastBetResolvedAt);
              const currentLastDed = getMillis(uData.lastChallengeDeductionAt);
              
              const currentEffectiveStart = Math.max(currentActivatedAt, currentLastBet, currentLastDed);
              const currentPeriods = Math.floor((Date.now() - currentEffectiveStart) / threeHours);
              
              if (currentPeriods > 0) {
                let currentBalance = uData.balance;
                let totalDeducted = 0;
                
                if (currentBalance > 0) {
                  for (let i = 0; i < currentPeriods; i++) {
                    const deduction = Math.floor(currentBalance * 0.1);
                    currentBalance -= deduction;
                    totalDeducted += deduction;
                  }
                }
                
                if (totalDeducted > 0) {
                  transaction.update(userRef, {
                    balance: currentBalance,
                    lastChallengeDeductionAt: currentEffectiveStart + (currentPeriods * threeHours)
                  });
                  transaction.update(sysRef, {
                    challengerBalance: (sData.challengerBalance || 0) + totalDeducted
                  });
                } else {
                  transaction.update(userRef, {
                    lastChallengeDeductionAt: currentEffectiveStart + (currentPeriods * threeHours)
                  });
                }
              }
            });
          } catch (error) {
            console.error("Deduction failed for user", user.uid, error);
          }
        }
      });
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [challengeData, allUsers, isAdmin, profile.uid]);

  const toggleChallengeMode = async () => {
    if (!isAdmin) return;
    const ref = doc(db, 'system', 'challengeMode');
    if (challengeData?.isActive) {
      await updateDoc(ref, { isActive: false });
    } else {
      await setDoc(ref, { 
        isActive: true, 
        activatedAt: serverTimestamp(),
        challengerBalance: challengeData?.challengerBalance || 0 
      }, { merge: true });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="bg-app-card border border-app-border rounded-3xl p-6 relative overflow-hidden">
        {challengeData?.isActive && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
        )}
        
        <div className="flex items-center justify-between relative z-10">
          <div>
            <h2 className="text-2xl font-black text-app-text flex items-center gap-2">
              <Flame className={`w-8 h-8 ${challengeData?.isActive ? 'text-red-500' : 'text-app-text/20'}`} />
              Challenge Modus
            </h2>
            <p className="text-app-text/50 text-sm mt-1">
              {challengeData?.isActive 
                ? "Aktiv! Schließe Wetten ab, um deine Coins zu schützen." 
                : "Der Challenge Modus ist aktuell deaktiviert."}
            </p>
            <p className="text-app-text/40 text-xs mt-2 max-w-md">
              Wenn aktiv, verliert jeder Spieler alle 3 Stunden 10% seiner Coins. 
              Erstelle oder nimm an Wetten teil, um den Timer zurückzusetzen, sobald die Wette abgeschlossen wird!
            </p>
          </div>
          
          {isAdmin && (
            <button
              onClick={toggleChallengeMode}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                challengeData?.isActive 
                  ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' 
                  : 'bg-app-accent text-app-bg hover:opacity-90'
              }`}
            >
              {challengeData?.isActive ? 'Beenden' : 'Ausrufen'}
            </button>
          )}
        </div>

        {challengeData?.isActive && (
          <div className="mt-8 p-6 bg-zinc-950 rounded-2xl border border-red-500/20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20">
                <Skull className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <div className="text-sm font-bold text-red-500 uppercase tracking-widest">Der Challenger</div>
                <div className="text-3xl font-black text-white">{challengeData.challengerBalance.toLocaleString()} <span className="text-lg text-white/40">Coins</span></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {challengeData?.isActive && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-app-text/40 uppercase tracking-widest pl-2">Gefährdete Spieler</h3>
          {allUsers
            .map(user => {
              const activatedAt = getMillis(challengeData.activatedAt);
              const lastBet = getMillis(user.lastBetResolvedAt);
              const lastDed = getMillis(user.lastChallengeDeductionAt);
              const effectiveStart = Math.max(activatedAt, lastBet, lastDed);
              const threeHours = 3 * 60 * 60 * 1000;
              const nextDeduction = effectiveStart + threeHours;
              const remaining = Math.max(0, nextDeduction - Date.now());
              return { user, remaining };
            })
            .sort((a, b) => a.remaining - b.remaining)
            .map(({ user }) => (
              <UserChallengeRow key={user.uid} user={user} challengeData={challengeData} />
            ))}
        </div>
      )}
    </div>
  );
}

const UserChallengeRow = ({ user, challengeData }: { user: UserProfile, challengeData: ChallengeModeData }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!challengeData.isActive || !challengeData.activatedAt) return;
    
    const updateTimer = () => {
      const activatedAt = getMillis(challengeData.activatedAt);
      const lastBet = getMillis(user.lastBetResolvedAt);
      const lastDed = getMillis(user.lastChallengeDeductionAt);
      
      const effectiveStart = Math.max(activatedAt, lastBet, lastDed);
      const threeHours = 3 * 60 * 60 * 1000;
      const nextDeduction = effectiveStart + threeHours;
      const remaining = Math.max(0, nextDeduction - Date.now());
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [user, challengeData]);

  const formatTime = (ms: number) => {
    const h = Math.floor(ms / (1000 * 60 * 60));
    const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((ms % (1000 * 60)) / 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const deductionAmount = Math.floor(user.balance * 0.1);

  return (
    <div className="flex items-center justify-between p-4 bg-app-card rounded-2xl border border-app-border">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-app-bg flex items-center justify-center overflow-hidden border border-app-border">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="text-lg font-bold text-app-text/40">{user.displayName[0]}</span>
          )}
        </div>
        <div>
          <div className="text-sm font-bold text-app-text">{user.displayName}</div>
          <div className="text-[10px] text-app-text/50">Guthaben: {user.balance}</div>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-lg font-mono font-bold ${timeLeft < 3600000 ? 'text-red-500' : 'text-app-text'}`}>
          {formatTime(timeLeft)}
        </div>
        <div className="text-[10px] text-app-text/50">
          Verlust: <span className="text-red-500 font-bold">-{deductionAmount}</span>
        </div>
      </div>
    </div>
  );
};
