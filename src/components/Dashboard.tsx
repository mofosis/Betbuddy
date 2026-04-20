import React, { useState, useEffect } from 'react';
import { UserProfile, Bet } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, where, runTransaction, or, limit, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Plus, Search, Filter, History, LayoutDashboard, CheckCircle2, XCircle, Clock, Users, Mail, Trophy, User as UserIcon, MessageSquare, Activity as ActivityIcon, Coins, Flame } from 'lucide-react';
import { BetCard } from './BetCard';
import { CreateBetModal } from './CreateBetModal';
import { Leaderboard } from './Leaderboard';
import { ChallengeMode } from './ChallengeMode';
import { UsersList } from './UsersList';
import { UserPage } from './UserPage';
import { ActivityFeed } from './ActivityFeed';
import { FeatureRequestSystem } from './FeatureRequestSystem';
import { motion, AnimatePresence } from 'motion/react';
import { createNotification } from '../services/notificationService';
import { logActivity } from '../services/activityService';
import { ResetSystemModal } from './ResetSystemModal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import confetti from 'canvas-confetti';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DashboardProps {
  profile: UserProfile;
  initialBetId?: string | null;
  initialUser?: UserProfile | null;
  onBetIdHandled?: () => void;
  onUserHandled?: () => void;
}

export function Dashboard({ profile, initialBetId, initialUser, onBetIdHandled, onUserHandled }: DashboardProps) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [editingBet, setEditingBet] = useState<Bet | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'browse' | 'my-bets' | 'invites' | 'history' | 'users' | 'activity' | 'feedback' | 'ranking' | 'challenge'>('all');

  const handleUserClick = async (uid: string) => {
    try {
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (userSnap.exists()) {
        setSelectedUser(userSnap.data() as UserProfile);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    }
  };

  useEffect(() => {
    if (!profile.uid) return;

    const q = query(
      collection(db, 'bets'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const betsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bet));
      setBets(betsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'bets'));

    // Fetch all users for global leaderboard
    const usersQ = query(collection(db, 'users'), orderBy('wins', 'desc'), limit(50));
    const unsubscribeUsers = onSnapshot(usersQ, (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setAllUsers(usersData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => {
      unsubscribe();
      unsubscribeUsers();
    };
  }, [profile.uid]);

  useEffect(() => {
    if (initialBetId) {
      const fetchBet = async () => {
        try {
          const betSnap = await getDoc(doc(db, 'bets', initialBetId));
          if (betSnap.exists()) {
            setEditingBet({ id: betSnap.id, ...betSnap.data() } as Bet);
            setIsModalOpen(true);
          }
          onBetIdHandled?.();
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `bets/${initialBetId}`);
        }
      };
      fetchBet();
    }
  }, [initialBetId, onBetIdHandled]);

  useEffect(() => {
    if (initialUser) {
      setSelectedUser(initialUser);
      onUserHandled?.();
    }
  }, [initialUser, onUserHandled]);

  const filteredBets = bets.filter(bet => {
    if (activeTab === 'all') {
      return true;
    }
    if (activeTab === 'browse') {
      return bet.status === 'pending' && bet.creatorId !== profile.uid;
    }
    if (activeTab === 'invites') {
      return bet.status === 'pending' && bet.invitedId === profile.uid;
    }
    if (activeTab === 'my-bets') {
      return (bet.creatorId === profile.uid || !!bet.participants?.[profile.uid]) && bet.status !== 'completed' && bet.status !== 'cancelled';
    }
    if (activeTab === 'history') {
      return (bet.creatorId === profile.uid || !!bet.participants?.[profile.uid]) && (bet.status === 'completed' || bet.status === 'cancelled');
    }
    return true;
  });

  const handleJoinBet = async (bet: Bet, outcomeIndex: number, stake: number) => {
    if (isNaN(stake) || stake <= 0) {
      throw new Error("Der Einsatz muss eine gültige Zahl größer als 0 sein!");
    }

    if (bet.participants?.[profile.uid]) {
      throw new Error("Du bist bereits Teilnehmer dieser Wette!");
    }

    if (profile.balance < stake) {
      throw new Error("Nicht genug Guthaben!");
    }

    try {
      await runTransaction(db, async (transaction) => {
        const betRef = doc(db, 'bets', bet.id);
        const userRef = doc(db, 'users', profile.uid);
        
        const [userSnap, betSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(betRef)
        ]);

        if (!userSnap.exists()) throw new Error("User profile not found");
        if (!betSnap.exists()) throw new Error("Bet not found");
        
        const currentBalance = userSnap.data().balance;
        if (currentBalance < stake) throw new Error("Insufficient balance");

        const betData = betSnap.data() as Bet;
        if (betData.participants?.[profile.uid]) {
          throw new Error("Already joined");
        }

        const updatedParticipants = {
          ...(betData.participants || {}),
          [profile.uid]: {
            uid: profile.uid,
            name: profile.displayName,
            outcomeIndex: outcomeIndex,
            stake: stake
          }
        };

        const invitedUserIds = (betData.invitedUserIds || []).filter(id => id !== profile.uid);

        transaction.update(betRef, {
          participants: updatedParticipants,
          totalPot: (betData.totalPot || 0) + stake,
          status: 'active',
          updatedAt: serverTimestamp(),
          invitedUserIds: invitedUserIds
        });

        transaction.update(userRef, {
          balance: currentBalance - stake,
          balanceHistory: arrayUnion({ timestamp: Date.now(), balance: currentBalance - stake })
        });
      });
      
      const betSnap = await getDoc(doc(db, 'bets', bet.id));
      const betData = betSnap.data() as Bet;
      
      await logActivity({
        userId: profile.uid,
        userName: profile.displayName,
        type: 'bet_joined',
        betId: bet.id,
        betTitle: betData.title,
        amount: stake,
        outcomeName: betData.outcomes[outcomeIndex]
      });

      await createNotification(
        betData.creatorId,
        'update',
        'Wette beigetreten',
        `${profile.displayName} ist deiner Wette "${betData.title}" beigetreten!`,
        bet.id
      );
      
    } catch (error: any) {
      console.error('Error joining bet:', error);
      if (error.message === 'Already joined') {
        throw new Error("Du bist bereits Teilnehmer dieser Wette!");
      } else if (error.message === 'Insufficient balance') {
        throw new Error("Nicht genug Guthaben!");
      } else {
        handleFirestoreError(error, OperationType.WRITE, `bets/${bet.id}`);
        throw error;
      }
    }
  };
  
  const handleLeaveBet = async (bet: Bet) => {
    const userParticipant = bet.participants[profile.uid];
    if (!userParticipant) return;

    try {
      await runTransaction(db, async (transaction) => {
        const betRef = doc(db, 'bets', bet.id);
        const userRef = doc(db, 'users', profile.uid);
        
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("User profile not found");
        
        const refundAmount = userParticipant.stake;

        const updatedParticipants = { ...bet.participants };
        delete updatedParticipants[profile.uid];

        transaction.update(betRef, {
          participants: updatedParticipants,
          totalPot: (bet.totalPot || 0) - refundAmount,
          status: Object.keys(updatedParticipants).length > 1 ? 'active' : 'pending',
          updatedAt: serverTimestamp()
        });

        transaction.update(userRef, {
          balance: userSnap.data().balance + refundAmount,
          balanceHistory: arrayUnion({ timestamp: Date.now(), balance: userSnap.data().balance + refundAmount })
        });
      });

      await createNotification(
        bet.creatorId,
        'update',
        'Teilnehmer hat die Wette verlassen',
        `${profile.displayName} ist aus der Wette "${bet.title}" ausgestiegen.`,
        bet.id
      );
    } catch (error) {
      console.error('Error leaving bet:', error);
      handleFirestoreError(error, OperationType.WRITE, `bets/${bet.id}`);
    }
  };

  const handleResolveBet = async (bet: Bet, winnerOutcomeIndex: number) => {
    try {
      await runTransaction(db, async (transaction) => {
        const betRef = doc(db, 'bets', bet.id);
        const betSnap = await transaction.get(betRef);
        if (!betSnap.exists()) throw new Error("Bet not found");
        const betData = betSnap.data() as Bet;

        const participants = Object.values(betData.participants || {});
        const winners = participants.filter(p => p.outcomeIndex === winnerOutcomeIndex);
        const losers = participants.filter(p => p.outcomeIndex !== winnerOutcomeIndex);
        const totalWinningStake = winners.reduce((sum, p) => sum + p.stake, 0);

        // 1. COLLECT ALL READS FIRST
        const userSnaps: Record<string, any> = {};
        const allUserIds = Array.from(new Set(participants.map(p => p.uid)));
        
        for (const uid of allUserIds) {
          const userRef = doc(db, 'users', uid);
          const snap = await transaction.get(userRef);
          if (snap.exists()) {
            userSnaps[uid] = snap.data();
          }
        }
        
        // 2. NOW PERFORM ALL WRITES
        transaction.update(betRef, {
          status: 'completed',
          winnerOutcomeIndex: winnerOutcomeIndex,
          resolvedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        const userUpdates: Record<string, any> = {};
        for (const uid of allUserIds) {
          userUpdates[uid] = {
            lastBetResolvedAt: serverTimestamp()
          };
        }

        if (totalWinningStake > 0) {
          let currentUserIsWinner = false;
          for (const winner of winners) {
            if (winner.uid === profile.uid) currentUserIsWinner = true;
            const winnerData = userSnaps[winner.uid];
            if (winnerData) {
              const share = (winner.stake / totalWinningStake) * betData.totalPot;
              const newBalance = (winnerData.balance || 0) + share;
              userUpdates[winner.uid] = {
                ...userUpdates[winner.uid],
                balance: newBalance,
                wins: (winnerData.wins || 0) + 1,
                balanceHistory: arrayUnion({ timestamp: Date.now(), balance: newBalance })
              };
            }
          }
          
          if (currentUserIsWinner) {
            confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#10b981', '#34d399', '#6ee7b7']
            });
          }
        }

        for (const loser of losers) {
          const loserData = userSnaps[loser.uid];
          if (loserData) {
            userUpdates[loser.uid] = {
              ...userUpdates[loser.uid],
              losses: (loserData.losses || 0) + 1
            };
          }
        }

        for (const [uid, updates] of Object.entries(userUpdates)) {
          const userRef = doc(db, 'users', uid);
          transaction.update(userRef, updates);
        }
      });

      // Log activity for the winner (if any)
      const betData = (await getDoc(doc(db, 'bets', bet.id))).data() as Bet;
      const participants = Object.values(betData.participants || {});
      const winners = participants.filter(p => p.outcomeIndex === winnerOutcomeIndex);
      if (winners.length > 0) {
        await logActivity({
          userId: winners[0].uid,
          userName: winners[0].name,
          type: 'bet_resolved',
          betId: bet.id,
          betTitle: bet.title,
          outcomeName: bet.outcomes[winnerOutcomeIndex]
        });
      }

      // Notify all participants
      for (const p of Object.values(bet.participants)) {
        if (p.uid === profile.uid) continue;
        
        const isWinner = p.outcomeIndex === winnerOutcomeIndex;
        let resultMessage = '';
        
        if (isWinner) {
          const totalWinningStake = Object.values(bet.participants)
            .filter(part => part.outcomeIndex === winnerOutcomeIndex)
            .reduce((sum, part) => sum + part.stake, 0);
          const share = Math.floor((p.stake / totalWinningStake) * bet.totalPot);
          resultMessage = `Du hast gewonnen! Dein Gewinn: ${share} BetCoins.`;
        } else {
          resultMessage = `Du hast verloren. Dein Einsatz von ${p.stake} BetCoins ist weg.`;
        }

        await createNotification(
          p.uid,
          'resolved',
          'Wette abgeschlossen',
          `Die Wette "${bet.title}" wurde abgeschlossen. ${resultMessage}`,
          bet.id
        );
      }
    } catch (error) {
      console.error('Error resolving bet:', error);
      handleFirestoreError(error, OperationType.WRITE, `bets/${bet.id}`);
    }
  };

  const handleCancelBet = async (bet: Bet) => {
    try {
      await runTransaction(db, async (transaction) => {
        const betRef = doc(db, 'bets', bet.id);
        
        // 1. Fetch all participant profiles
        const userSnaps: Record<string, any> = {};
        for (const participantId of Object.keys(bet.participants || {})) {
          const userRef = doc(db, 'users', participantId);
          const snap = await transaction.get(userRef);
          if (snap.exists()) {
            userSnaps[participantId] = snap.data();
          }
        }

        // 2. Perform all writes
        transaction.update(betRef, {
          status: 'cancelled',
          updatedAt: serverTimestamp()
        });

        // Refund all participants
        for (const [participantId, participant] of Object.entries(bet.participants || {})) {
          const userData = userSnaps[participantId];
          if (userData) {
            const userRef = doc(db, 'users', participantId);
            const newBalance = (userData.balance || 0) + participant.stake;
            transaction.update(userRef, {
              balance: newBalance,
              balanceHistory: arrayUnion({ timestamp: Date.now(), balance: newBalance })
            });
          }
        }
      });
    } catch (error) {
      console.error('Error cancelling bet:', error);
      handleFirestoreError(error, OperationType.WRITE, `bets/${bet.id}`);
    }
  };

  const handleReset = () => {
    setIsResetModalOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Compact Header Section */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* Action Card */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-app-accent hover:opacity-90 text-app-bg rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all shadow-lg shadow-app-accent/20 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/20 rounded-full -mr-8 -mt-8 blur-xl group-hover:bg-white/30 transition-colors duration-500" />
          {profile.email === 'martinmosteil@gmail.com' && (
            <div
              onClick={(e) => { e.stopPropagation(); handleReset(); }}
              className="absolute top-1.5 right-1.5 p-1 bg-red-500/20 hover:bg-red-500/30 text-red-900 rounded-lg transition-all z-20"
              title="System Reset"
            >
              <History className="w-3 h-3" />
            </div>
          )}
          <Plus className="w-6 h-6 sm:w-7 sm:h-7 relative z-10" />
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider relative z-10">Neu</span>
        </button>

        {/* Balance Card */}
        <div className="bg-app-card border border-app-border rounded-2xl p-3 flex flex-col items-center justify-center gap-1 text-center">
          <Coins className="w-4 h-4 text-emerald-500 mb-0.5" />
          <div className="text-base sm:text-lg font-bold text-app-text leading-none">{profile.balance.toLocaleString()}</div>
          <div className="text-[9px] sm:text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Guthaben</div>
        </div>

        {/* Stats Card */}
        <div className="bg-app-card border border-app-border rounded-2xl p-3 flex flex-col items-center justify-center gap-1 text-center">
          <Trophy className="w-4 h-4 text-yellow-500 mb-0.5" />
          <div className="flex items-baseline gap-1">
            <div className="text-base sm:text-lg font-bold text-app-text leading-none">{profile.wins}</div>
            <div className="text-[9px] sm:text-[10px] font-bold text-emerald-500">
              ({profile.wins + profile.losses > 0 ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100) : 0}%)
            </div>
          </div>
          <div className="text-[9px] sm:text-[10px] font-bold text-yellow-500 uppercase tracking-widest">Siege</div>
        </div>
      </div>

      <div className="flex overflow-x-auto no-scrollbar gap-2 p-1 bg-app-card rounded-2xl border border-app-border w-full md:w-fit">
        <TabButton 
          active={activeTab === 'all'} 
          onClick={() => setActiveTab('all')}
          icon={<LayoutDashboard className="w-4 h-4" />}
          label="Alle"
        />
        <TabButton 
          active={activeTab === 'browse'} 
          onClick={() => setActiveTab('browse')}
          icon={<Search className="w-4 h-4" />}
          label="Entdecken"
        />
        <TabButton 
          active={activeTab === 'invites'} 
          onClick={() => setActiveTab('invites')}
          icon={<Mail className="w-4 h-4" />}
          label="Einladungen"
        />
        <TabButton 
          active={activeTab === 'my-bets'} 
          onClick={() => setActiveTab('my-bets')}
          icon={<LayoutDashboard className="w-4 h-4" />}
          label="Meine Wetten"
        />
        <TabButton 
          active={activeTab === 'history'} 
          onClick={() => setActiveTab('history')}
          icon={<History className="w-4 h-4" />}
          label="Historie"
        />
        <TabButton 
          active={activeTab === 'users'} 
          onClick={() => setActiveTab('users')}
          icon={<UserIcon className="w-4 h-4" />}
          label="User"
        />
        <TabButton 
          active={activeTab === 'ranking'} 
          onClick={() => setActiveTab('ranking')}
          icon={<Trophy className="w-4 h-4" />}
          label="Ranking"
        />
        <TabButton 
          active={activeTab === 'activity'} 
          onClick={() => setActiveTab('activity')}
          icon={<ActivityIcon className="w-4 h-4" />}
          label="Aktivität"
        />
        <TabButton 
          active={activeTab === 'feedback'} 
          onClick={() => setActiveTab('feedback')}
          icon={<MessageSquare className="w-4 h-4" />}
          label="Feedback"
        />
        <TabButton 
          active={activeTab === 'challenge'} 
          onClick={() => setActiveTab('challenge')}
          icon={<Flame className="w-4 h-4" />}
          label="Challenge"
        />
      </div>

      <div className="space-y-6">
        {activeTab === 'users' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <UsersList onUserClick={setSelectedUser} />
          </motion.div>
        ) : activeTab === 'ranking' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 max-w-2xl mx-auto"
          >
            <Leaderboard 
              users={allUsers} 
              title="Globales Ranking" 
              limit={50} 
              onUserClick={setSelectedUser}
            />
          </motion.div>
        ) : activeTab === 'challenge' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 max-w-2xl mx-auto"
          >
            <ChallengeMode profile={profile} allUsers={allUsers} />
          </motion.div>
        ) : activeTab === 'activity' ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <ActivityFeed />
            </motion.div>
          ) : activeTab === 'feedback' ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <FeatureRequestSystem profile={profile} />
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredBets.length > 0 ? (
                  filteredBets.map((bet) => (
                    <div key={bet.id}>
                      <BetCard 
                        bet={bet} 
                        currentUserId={profile.uid}
                        isAdmin={profile.email === 'martinmosteil@gmail.com'}
                        onJoin={(outcomeIndex, stake) => handleJoinBet(bet, outcomeIndex, stake)}
                        onResolve={(outcomeIndex) => handleResolveBet(bet, outcomeIndex)}
                        onCancel={() => handleCancelBet(bet)}
                        onEdit={() => {
                          setEditingBet(bet);
                          setIsModalOpen(true);
                        }}
                        onLeave={() => handleLeaveBet(bet)}
                        onUserClick={handleUserClick}
                      />
                    </div>
                  ))
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="col-span-full py-20 flex flex-col items-center justify-center text-app-text/40 border-2 border-dashed border-app-border rounded-3xl"
                  >
                    <Clock className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-lg">Keine Wetten gefunden.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
      </div>

      <ResetSystemModal 
        isOpen={isResetModalOpen} 
        onClose={() => setIsResetModalOpen(false)} 
      />

      <CreateBetModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingBet(null);
        }} 
        profile={profile}
        bet={editingBet}
        onBetCreated={async (betId, invitedUserIds) => {
          await logActivity({
            userId: profile.uid,
            userName: profile.displayName,
            type: 'bet_created',
            betId: betId,
            betTitle: 'Neue Wette' // We'd need the title here, but let's use a generic one or fetch it
          });

          for (const uid of invitedUserIds) {
            await createNotification(
              uid,
              'bet_invite',
              'Wetteinladung',
              `${profile.displayName} hat dich zu einer Wette eingeladen!`,
              betId
            );
          }
        }}
      />

      {selectedUser && (
        <UserPage 
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          user={selectedUser}
          currentUserId={profile.uid}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
        active ? "bg-app-border text-app-text shadow-sm" : "text-app-text/50 hover:text-app-text hover:bg-app-border/50"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
