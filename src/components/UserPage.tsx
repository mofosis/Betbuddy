import React, { useState, useEffect } from 'react';
import { UserProfile, Bet } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { X, User as UserIcon, Calendar, Flag, Users, LayoutDashboard, Trophy, Coins, TrendingUp, TrendingDown, QrCode, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BetCard } from './BetCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { QRCodeSVG } from 'qrcode.react';

interface UserPageProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  currentUserId: string;
}

export function UserPage({ isOpen, onClose, user, currentUserId }: UserPageProps) {
  const [userBets, setUserBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);

  const balanceData = user.balanceHistory?.map(h => ({
    time: new Date(h.timestamp?.toDate?.() || h.timestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
    balance: h.balance
  })) || [
    { time: 'Start', balance: 1000 },
    { time: 'Heute', balance: user.balance }
  ];

  useEffect(() => {
    if (!isOpen || !user.uid) return;

    setLoading(true);

    // Fetch bets where user is a participant
    // Note: Since participants is a map, we can't easily query by key in Firestore without a specific field.
    // However, we have creatorId. For other bets, we might need a separate collection or array.
    // For now, let's fetch bets where they are creator or we'll fetch all and filter client-side if needed,
    // but better to fetch by creatorId first.
    const betsQuery = query(
      collection(db, 'bets'),
      where('creatorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeBets = onSnapshot(betsQuery, (snapshot) => {
      const betsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bet));
      setUserBets(betsData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'bets'));

    return () => {
      unsubscribeBets();
    };
  }, [isOpen, user.uid]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unbekannt';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(date);
  };

  // Mock political orientation calculation
  const getPoliticalOrientation = () => {
    if (user.politicalOrientation) return user.politicalOrientation;
    
    // Fun logic: use UID to seed a stable "random" orientation
    const orientations = ['Liberal', 'Konservativ', 'Progressiv', 'Libertär', 'Sozialistisch', 'Zentristisch', 'Apolitisch'];
    const seed = user.uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return orientations[seed % orientations.length];
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl bg-app-card border border-app-border rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col"
          >
            <div className="flex-1 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
              {/* Header / Profile Section */}
              <div className="relative h-48 bg-gradient-to-br from-app-accent/20 to-app-bg border-b border-app-border">
                <button 
                  onClick={onClose}
                  className="absolute top-6 right-6 p-2 bg-app-bg/50 backdrop-blur-md text-app-text/60 hover:text-app-text rounded-full transition-colors z-10"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="px-8">
                <div className="relative -mt-16 mb-12 flex items-end gap-6">
                <div className="relative">
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName} 
                      className="w-32 h-32 rounded-3xl object-cover border-4 border-app-card shadow-xl"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-3xl bg-app-bg flex items-center justify-center border-4 border-app-card shadow-xl">
                      <UserIcon className="w-12 h-12 text-app-text/20" />
                    </div>
                  )}
                </div>
                <div className="pb-4">
                  <h2 className="text-3xl font-black text-app-text tracking-tight">{user.displayName}</h2>
                  <p className="text-app-text/50 font-medium">{user.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Sidebar Stats */}
                <div className="space-y-6">
                  <div className="bg-app-bg/50 border border-app-border rounded-3xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-app-text/40 uppercase tracking-widest">Profil teilen</h3>
                      <button 
                        onClick={() => setShowQR(!showQR)}
                        className="p-2 bg-app-card border border-app-border rounded-xl text-app-accent hover:bg-app-accent hover:text-app-bg transition-all"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <AnimatePresence>
                      {showQR && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="flex flex-col items-center gap-4 py-4 bg-white rounded-2xl p-4"
                        >
                          <QRCodeSVG 
                            value={`${window.location.origin}?user=${user.uid}`}
                            size={160}
                            level="H"
                            includeMargin
                          />
                          <p className="text-[10px] text-zinc-500 font-bold uppercase">Scan zum Profil-Besuch</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="bg-app-bg/50 border border-app-border rounded-3xl p-6 space-y-4">
                    <h3 className="text-sm font-bold text-app-text/40 uppercase tracking-widest">Informationen</h3>
                    
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-app-text/70">
                        <Calendar className="w-5 h-5 text-app-accent" />
                        <div>
                          <p className="text-[10px] uppercase font-bold opacity-50">Dabei seit</p>
                          <p className="text-sm font-medium">{formatDate(user.createdAt)}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 text-app-text/70">
                        <Flag className="w-5 h-5 text-app-accent" />
                        <div>
                          <p className="text-[10px] uppercase font-bold opacity-50">Politische Orientierung</p>
                          <p className="text-sm font-medium">{getPoliticalOrientation()}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-app-bg/50 border border-app-border rounded-3xl p-6 space-y-4">
                    <h3 className="text-sm font-bold text-app-text/40 uppercase tracking-widest">Statistiken</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-app-card p-4 rounded-2xl border border-app-border/50">
                        <Trophy className="w-5 h-5 text-app-accent mb-2" />
                        <p className="text-2xl font-black text-app-text">{user.wins || 0}</p>
                        <p className="text-[10px] uppercase font-bold text-app-text/40">Wins</p>
                      </div>
                      <div className="bg-app-card p-4 rounded-2xl border border-app-border/50">
                        <TrendingDown className="w-5 h-5 text-red-500 mb-2" />
                        <p className="text-2xl font-black text-app-text">{user.losses || 0}</p>
                        <p className="text-[10px] uppercase font-bold text-app-text/40">Losses</p>
                      </div>
                      <div className="col-span-2 bg-app-card p-4 rounded-2xl border border-app-border/50 flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-black text-app-text">{user.balance}</p>
                          <p className="text-[10px] uppercase font-bold text-app-text/40">Aktuelles Guthaben</p>
                        </div>
                        <Coins className="w-8 h-8 text-app-accent opacity-20" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Content: Bets & Analytics */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Analytics Chart */}
                  <div className="bg-app-bg/50 border border-app-border rounded-3xl p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-app-text/40 uppercase tracking-widest">Guthaben-Verlauf</h3>
                      <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs bg-emerald-500/10 px-2 py-1 rounded-lg">
                        <TrendingUp className="w-3 h-3" />
                        {((user.balance / 1000 - 1) * 100).toFixed(1)}%
                      </div>
                    </div>
                    
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={balanceData}>
                          <defs>
                            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--color-accent, #00ff00)" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="var(--color-accent, #00ff00)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis 
                            dataKey="time" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} 
                          />
                          <YAxis hide />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                            labelStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginBottom: '4px' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="balance" 
                            stroke="var(--color-accent, #00ff00)" 
                            fillOpacity={1} 
                            fill="url(#colorBalance)" 
                            strokeWidth={3}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-app-text flex items-center gap-2">
                      <LayoutDashboard className="w-6 h-6 text-app-accent" />
                      Erstellte Wetten
                    </h3>
                    <span className="px-3 py-1 bg-app-accent/10 text-app-accent text-xs font-bold rounded-full">
                      {userBets.length} Wetten
                    </span>
                  </div>

                  {loading ? (
                    <div className="flex justify-center py-12">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        className="w-10 h-10 border-4 border-app-accent border-t-transparent rounded-full"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {userBets.length > 0 ? (
                        userBets.map(bet => (
                          <div key={bet.id}>
                            <BetCard 
                              bet={bet}
                              currentUserId={currentUserId}
                              isReadOnly={true}
                            />
                          </div>
                        ))
                      ) : (
                        <div className="py-12 text-center bg-app-bg/30 border-2 border-dashed border-app-border rounded-3xl">
                          <LayoutDashboard className="w-12 h-12 mx-auto mb-4 opacity-10" />
                          <p className="text-app-text/40">Noch keine Wetten erstellt.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
