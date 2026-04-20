import React, { useState, useEffect } from 'react';
import { UserProfile, Bet } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp, runTransaction, doc, query, where, onSnapshot, getDocs, updateDoc, limit, arrayUnion } from 'firebase/firestore';
import { X, Coins, Info, AlertCircle, User as UserIcon, Users, Edit3, Plus, UserPlus, Search, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createNotification } from '../services/notificationService';

interface CreateBetModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  bet?: Bet | null;
  onBetCreated?: (betId: string, invitedUserIds: string[]) => void;
}

export function CreateBetModal({ isOpen, onClose, profile, bet, onBetCreated }: CreateBetModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(100);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [outcomes, setOutcomes] = useState<string[]>(['Ja', 'Nein']);
  const [selectedOutcomeIndex, setSelectedOutcomeIndex] = useState<number>(0);
  
  // User invitation state
  const [userSearch, setUserSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserProfile[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<UserProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isCreator = !bet || bet.creatorId === profile.uid;
  const isJoining = bet && bet.creatorId !== profile.uid;

  useEffect(() => {
    if (bet && isOpen) {
      setTitle(bet.title);
      setDescription(bet.description || '');
      setAmount(bet.amount || 0);
      setOutcomes(bet.outcomes || ['Ja', 'Nein']);
      
      const participant = bet.participants?.[profile.uid];
      if (participant) {
        setSelectedOutcomeIndex(participant.outcomeIndex);
        if (isJoining) setAmount(participant.stake);
      }
    } else if (isOpen) {
      setTitle('');
      setDescription('');
      setAmount(100);
      setOutcomes(['Ja', 'Nein']);
      setSelectedOutcomeIndex(0);
      setInvitedUsers([]);
      setUserSearch('');
    }
  }, [bet, isOpen, profile.uid, isJoining]);

  useEffect(() => {
    if (!userSearch.trim() || userSearch.length < 2) {
      setUserSearchResults([]);
      return;
    }

    setSearchLoading(true);
    const lowerSearch = userSearch.toLowerCase();
    const capitalizedSearch = userSearch.charAt(0).toUpperCase() + userSearch.slice(1);

    const qLower = query(
      collection(db, 'users'),
      where('displayNameLower', '>=', lowerSearch),
      where('displayNameLower', '<=', lowerSearch + '\uf8ff'),
      limit(5)
    );

    const qDisplay = query(
      collection(db, 'users'),
      where('displayName', '>=', capitalizedSearch),
      where('displayName', '<=', capitalizedSearch + '\uf8ff'),
      limit(5)
    );

    const unsubLower = onSnapshot(qLower, (snapshot) => {
      const lowerResults = snapshot.docs
        .map(doc => doc.data() as UserProfile)
        .filter(u => u.uid !== profile.uid && !invitedUsers.some(iu => iu.uid === u.uid));
      
      setUserSearchResults(prev => {
        const combined = [...prev, ...lowerResults];
        const unique = Array.from(new Map(combined.map(u => [u.uid, u])).values());
        return unique.slice(0, 5);
      });
      setSearchLoading(false);
    });

    const unsubDisplay = onSnapshot(qDisplay, (snapshot) => {
      const displayResults = snapshot.docs
        .map(doc => doc.data() as UserProfile)
        .filter(u => u.uid !== profile.uid && !invitedUsers.some(iu => iu.uid === u.uid));
      
      setUserSearchResults(prev => {
        const combined = [...prev, ...displayResults];
        const unique = Array.from(new Map(combined.map(u => [u.uid, u])).values());
        return unique.slice(0, 5);
      });
      setSearchLoading(false);
    });

    return () => {
      unsubLower();
      unsubDisplay();
    };
  }, [userSearch, profile.uid, invitedUsers]);

  const addInvitedUser = (user: UserProfile) => {
    setInvitedUsers([...invitedUsers, user]);
    setUserSearch('');
    setUserSearchResults([]);
  };

  const removeInvitedUser = (uid: string) => {
    setInvitedUsers(invitedUsers.filter(u => u.uid !== uid));
  };

  const addOutcome = () => {
    setOutcomes([...outcomes, '']);
  };

  const updateOutcome = (index: number, value: string) => {
    const newOutcomes = [...outcomes];
    newOutcomes[index] = value;
    setOutcomes(newOutcomes);
  };

  const removeOutcome = (index: number) => {
    if (outcomes.length <= 2) return;
    const newOutcomes = outcomes.filter((_, i) => i !== index);
    setOutcomes(newOutcomes);
    if (selectedOutcomeIndex >= newOutcomes.length) {
      setSelectedOutcomeIndex(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || isNaN(amount) || amount <= 0 || outcomes.some(o => !o.trim())) {
      console.warn('Validation failed', { title, amount, outcomes });
      return;
    }
    
    const currentStake = bet?.participants?.[profile.uid]?.stake || 0;
    const balanceDiff = amount - currentStake;
    
    if (balanceDiff > profile.balance) {
      setError("Nicht genug Guthaben!");
      return;
    }

    setLoading(true);
    setError(null);
    let newBetId = '';
    let newInvitedUserIds: string[] = [];

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', profile.uid);
        const userSnap = await transaction.get(userRef);
        
        if (!userSnap.exists()) throw new Error("User not found");
        const currentBalance = userSnap.data().balance;
        
        if (currentBalance < balanceDiff) throw new Error("Insufficient balance");

        if (bet) {
          // Update existing bet or Join
          const betRef = doc(db, 'bets', bet.id);
          const updatedParticipants = { ...bet.participants };
          const oldStake = updatedParticipants[profile.uid]?.stake || 0;
          
          updatedParticipants[profile.uid] = {
            uid: profile.uid,
            name: profile.displayName,
            outcomeIndex: selectedOutcomeIndex,
            stake: amount
          };

          const invitedUserIds = (bet.invitedUserIds || []).filter(id => id !== profile.uid);
          const newStatus = isJoining && Object.keys(updatedParticipants).length >= 2 ? 'active' : bet.status;

          if (isJoining) {
            transaction.update(betRef, {
              participants: updatedParticipants,
              totalPot: (bet.totalPot - oldStake) + amount,
              updatedAt: serverTimestamp(),
              invitedUserIds: invitedUserIds,
              status: newStatus
            });
          } else {
            transaction.update(betRef, {
              title,
              description,
              outcomes,
              amount,
              participants: updatedParticipants,
              totalPot: (bet.totalPot - oldStake) + amount,
              updatedAt: serverTimestamp(),
              invitedUserIds: invitedUserIds,
              status: newStatus
            });
          }

          if (balanceDiff !== 0) {
            transaction.update(userRef, {
              balance: currentBalance - balanceDiff,
              balanceHistory: arrayUnion({ timestamp: Date.now(), balance: currentBalance - balanceDiff })
            });
          }
        } else {
          // Create new bet
          const betRef = doc(collection(db, 'bets'));
          newBetId = betRef.id;
          newInvitedUserIds = invitedUsers.map(u => u.uid);
          
          transaction.set(betRef, {
            creatorId: profile.uid,
            creatorName: profile.displayName,
            title,
            description,
            status: 'pending',
            createdAt: serverTimestamp(),
            outcomes,
            participants: {
              [profile.uid]: {
                uid: profile.uid,
                name: profile.displayName,
                outcomeIndex: selectedOutcomeIndex,
                stake: amount
              }
            },
            totalPot: amount,
            amount, // Legacy compatibility
            invitedUserIds: newInvitedUserIds
          });

          transaction.update(userRef, {
            balance: currentBalance - amount,
            balanceHistory: arrayUnion({ timestamp: Date.now(), balance: currentBalance - amount })
          });
        }
      });

      // Handle notifications after successful transaction
      if (!bet && onBetCreated && newBetId) {
        onBetCreated(newBetId, newInvitedUserIds);
      }

      onClose();
    } catch (error) {
      console.error('Submit error:', error);
      handleFirestoreError(error, OperationType.WRITE, 'bets');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
            className="relative w-full max-w-lg bg-app-card border border-app-border rounded-3xl shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col"
          >
            <div className="p-6 border-b border-app-border flex items-center justify-between bg-app-card z-10">
              <div className="flex items-center gap-3">
                {isJoining ? <UserPlus className="w-6 h-6 text-app-accent" /> : bet ? <Edit3 className="w-6 h-6 text-app-accent" /> : <Plus className="w-6 h-6 text-app-accent" />}
                <h2 className="text-2xl font-bold text-app-text">
                  {isJoining ? "Wette beitreten" : bet ? "Wette bearbeiten" : "Neue Wette"}
                </h2>
              </div>
              <button onClick={onClose} className="p-2 text-app-text/40 hover:text-app-text hover:bg-app-bg rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-app-text/40">Titel der Wette</label>
                <input
                  required
                  disabled={!isCreator}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Z.B. Wer gewinnt das Spiel heute Abend?"
                  className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-3 text-app-text focus:outline-none focus:border-app-accent transition-colors disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-app-text/40">Beschreibung (optional)</label>
                <textarea
                  disabled={!isCreator}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details zur Wette..."
                  className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-3 text-app-text focus:outline-none focus:border-app-accent transition-colors min-h-[80px] resize-none disabled:opacity-50"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-app-text/40">Mögliche Ausgänge</label>
                  {isCreator && (
                    <button
                      type="button"
                      onClick={addOutcome}
                      className="text-xs text-app-accent hover:underline font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Ausgang hinzufügen
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {outcomes.map((outcome, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          required
                          disabled={!isCreator}
                          type="text"
                          value={outcome}
                          onChange={(e) => updateOutcome(index, e.target.value)}
                          placeholder={`Ausgang ${index + 1}`}
                          className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-2 text-sm text-app-text focus:outline-none focus:border-app-accent transition-colors disabled:opacity-50"
                        />
                        {isCreator && outcomes.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOutcome(index)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-red-500 hover:bg-red-500/10 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedOutcomeIndex(index)}
                        className={`px-4 rounded-xl border text-xs font-bold transition-all ${
                          selectedOutcomeIndex === index
                            ? "bg-app-accent text-app-bg border-app-accent"
                            : "bg-app-bg border-app-border text-app-text/40 hover:border-app-text/60"
                        }`}
                      >
                        {selectedOutcomeIndex === index ? "Dein Tipp" : "Tippen"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {isCreator && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-app-text/40 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    User einladen (optional)
                  </label>
                  <div className="relative">
                    {searchLoading ? (
                      <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-accent animate-spin" />
                    ) : (
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text/40" />
                    )}
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="User suchen..."
                      className="w-full bg-app-bg border border-app-border rounded-xl pl-10 pr-4 py-2 text-sm text-app-text focus:outline-none focus:border-app-accent transition-colors"
                    />
                    <AnimatePresence>
                      {userSearchResults.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute left-0 right-0 top-full mt-1 bg-app-card border border-app-border rounded-xl shadow-xl z-20 overflow-hidden"
                        >
                          {userSearchResults.map(user => (
                            <button
                              key={user.uid}
                              type="button"
                              onClick={() => addInvitedUser(user)}
                              className="w-full flex items-center gap-3 p-3 hover:bg-app-bg transition-colors text-left"
                            >
                              {user.photoURL ? (
                                <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-app-bg flex items-center justify-center">
                                  <UserIcon className="w-4 h-4 text-app-text/40" />
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-app-text">{user.displayName}</span>
                                <span className="text-[10px] text-app-text/40">{user.email}</span>
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {invitedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {invitedUsers.map(user => (
                        <div key={user.uid} className="flex items-center gap-2 bg-app-accent/10 border border-app-accent/20 rounded-lg px-2 py-1">
                          <span className="text-xs font-bold text-app-accent">{user.displayName}</span>
                          <button
                            type="button"
                            onClick={() => removeInvitedUser(user.uid)}
                            className="text-app-accent hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-app-text/40">Einsatz (BetCoins)</label>
                <div className="relative">
                  <Coins className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-app-accent" />
                  <input
                    required
                    type="number"
                    min="1"
                    max={profile.balance}
                    value={amount || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setAmount(isNaN(val) ? 0 : val);
                    }}
                    className="w-full bg-app-bg border border-app-border rounded-xl pl-12 pr-4 py-3 text-app-text focus:outline-none focus:border-app-accent transition-colors font-mono"
                  />
                </div>
                <p className="text-xs text-app-text/40 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Dein aktuelles Guthaben: {profile.balance} BetCoins
                </p>
              </div>

              {amount > profile.balance && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>Du hast nicht genügend Guthaben für diesen Einsatz.</span>
                </div>
              )}

              <button
                disabled={
                  loading || 
                  (amount - (bet?.participants?.[profile.uid]?.stake || 0)) > profile.balance || 
                  !title.trim() || 
                  outcomes.some(o => !o.trim())
                }
                type="submit"
                className="w-full py-4 bg-app-accent hover:opacity-90 disabled:opacity-50 text-app-bg rounded-2xl font-bold text-lg transition-all shadow-lg"
              >
                {loading 
                  ? (isJoining ? "Wird beigetreten..." : bet ? "Wird aktualisiert..." : "Wird erstellt...") 
                  : (isJoining ? "Wette beitreten" : bet ? "Änderungen speichern" : "Wette veröffentlichen")
                }
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
