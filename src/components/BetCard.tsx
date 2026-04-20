import React from 'react';
import { Bet } from '../types';
import { Coins, User, Clock, CheckCircle2, XCircle, Trophy, UserPlus, Edit2, AlertTriangle, LogOut, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BetCardProps {
  bet: Bet;
  currentUserId: string;
  onJoin?: (outcomeIndex: number, stake: number) => Promise<void>;
  onResolve?: (outcomeIndex: number) => Promise<void>;
  onCancel?: () => Promise<void>;
  onEdit?: () => void;
  onLeave?: () => Promise<void>;
  onUserClick?: (uid: string) => void;
  isReadOnly?: boolean;
  isAdmin?: boolean;
}

export function BetCard({ 
  bet, 
  currentUserId, 
  onJoin, 
  onResolve, 
  onCancel, 
  onEdit,
  onLeave,
  onUserClick,
  isReadOnly = false,
  isAdmin = false
}: BetCardProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [joinStake, setJoinStake] = React.useState<number>(bet.amount || 100);
  const isCreator = bet.creatorId === currentUserId;
  const canResolve = isCreator || isAdmin;
  const isParticipant = !!bet.participants?.[currentUserId];
  const userParticipant = bet.participants?.[currentUserId];

  const handleAction = async (action?: () => Promise<void>) => {
    if (!action) {
      console.warn('handleAction called without action');
      return;
    }
    console.log('handleAction starting...');
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await action();
      console.log('handleAction completed successfully');
    } catch (err: any) {
      console.error('handleAction failed:', err);
      // Only show error if it's not a known error that was already handled
      if (!['Already joined', 'Insufficient balance'].includes(err.message)) {
        setErrorMsg('Aktion fehlgeschlagen: ' + (err.message || 'Unbekannter Fehler'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const statusColors = {
    pending: "bg-yellow-500",
    active: "bg-blue-500",
    completed: "bg-emerald-500",
    cancelled: "bg-zinc-500",
  };

  const statusLabels = {
    pending: "Wartet",
    active: "Läuft",
    completed: "Abgeschlossen",
    cancelled: "Abgebrochen",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-app-card/50 border border-app-border/60 rounded-2xl p-5 flex flex-col gap-4 hover:border-app-accent/50 transition-colors group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className={cn("w-2 h-2 rounded-full", statusColors[bet.status])} />
            <span className="text-xs font-medium text-app-text/60">{statusLabels[bet.status]}</span>
            {bet.isUpdated && (
              <span className="text-[10px] text-amber-500 font-medium flex items-center gap-1 ml-2">
                <AlertTriangle className="w-3 h-3" /> Aktualisiert
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-app-text group-hover:text-app-accent transition-colors leading-tight">{bet.title}</h3>
          {bet.description && <p className="text-app-text/60 text-sm mt-1.5 line-clamp-2">{bet.description}</p>}
        </div>
        
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-app-text font-mono font-bold bg-app-bg px-2.5 py-1 rounded-lg border border-app-border/50">
            <Coins className="w-3.5 h-3.5 text-app-accent" />
            {bet.totalPot || 0}
          </div>
          {isCreator && (bet.status === 'pending' || bet.status === 'active') && !isReadOnly && Object.keys(bet.participants || {}).length <= 1 && (
            <button
              onClick={onEdit}
              className="p-1.5 text-app-text/40 hover:text-app-text hover:bg-app-bg rounded-md transition-colors"
              title="Wette bearbeiten"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Outcomes */}
      <div className="flex flex-col gap-2 mt-1">
        {errorMsg && (
          <div className="text-red-500 text-xs px-2 py-1 bg-red-500/10 rounded-md mb-1">
            {errorMsg}
          </div>
        )}
        {(bet.outcomes || []).map((outcome, idx) => {
          const outcomeParticipants = Object.values(bet.participants || {}).filter(p => p.outcomeIndex === idx);
          const outcomePot = outcomeParticipants.reduce((sum, p) => sum + p.stake, 0);
          const isWinner = bet.status === 'completed' && bet.winnerOutcomeIndex === idx;
          
          const odds = outcomePot > 0 ? (bet.totalPot / outcomePot).toFixed(2) : "0.00";
          const potentialWin = userParticipant?.outcomeIndex === idx 
            ? Math.floor(userParticipant.stake * (bet.totalPot / outcomePot))
            : 0;

          return (
            <div 
              key={idx} 
              className={cn(
                "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition-all",
                isWinner ? "bg-emerald-500/10 border-emerald-500/30" : "bg-app-bg/30 border-app-border/50 hover:border-app-border",
                userParticipant?.outcomeIndex === idx && "border-app-accent/50 bg-app-accent/5"
              )}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn("font-medium text-sm", isWinner ? "text-emerald-500 font-bold" : "text-app-text")}>{outcome}</span>
                  {userParticipant?.outcomeIndex === idx && (
                    <span className="text-[9px] bg-app-accent/20 text-app-accent px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Dein Tipp</span>
                  )}
                  {isWinner && <Trophy className="w-3.5 h-3.5 text-emerald-500" />}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-app-text/50">
                  <span className="font-mono">{outcomePot} 🪙</span>
                  <span>Quote: x{odds}</span>
                  {outcomeParticipants.length > 0 && (
                    <span>• {outcomeParticipants.length} Spieler</span>
                  )}
                </div>
                {userParticipant?.outcomeIndex === idx && bet.status !== 'completed' && (
                  <div className="text-[10px] text-emerald-500/80 mt-1">
                    Möglicher Gewinn: {potentialWin}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {(!isReadOnly && !isParticipant && onJoin && (bet.status === 'pending' || bet.status === 'active')) && (
                  <div className="flex items-center gap-1.5">
                    <input 
                      type="number"
                      min="1"
                      value={joinStake || ''}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setJoinStake(isNaN(val) ? 0 : val);
                      }}
                      className="w-16 bg-app-bg border border-app-border rounded-md px-2 py-1.5 text-xs text-app-text text-center focus:outline-none focus:border-app-accent"
                      placeholder="Einsatz"
                    />
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAction(() => onJoin(idx, joinStake));
                      }}
                      disabled={isLoading || joinStake <= 0}
                      className="px-3 py-1.5 bg-app-accent text-app-bg rounded-md text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {isLoading ? '...' : 'Wetten'}
                    </button>
                  </div>
                )}

                {!isReadOnly && bet.status === 'active' && canResolve && (
                  <button
                    onClick={() => handleAction(() => onResolve!(idx))}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-md text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {isLoading ? '...' : 'Gewinner'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 mt-1 border-t border-app-border/30 text-xs text-app-text/40">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {bet.createdAt?.toDate ? formatDistanceToNow(bet.createdAt.toDate(), { addSuffix: true, locale: de }) : "Gerade eben"}
          </span>
          {bet.invitedUserIds && bet.invitedUserIds.length > 0 && (
            <span className="flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" />
              {bet.invitedUserIds.length}
            </span>
          )}
        </div>

        <div className="flex gap-3 font-medium">
          {!isReadOnly && bet.status === 'pending' && isCreator && (
            <button
              onClick={() => handleAction(onCancel)}
              disabled={isLoading}
              className="hover:text-red-500 transition-colors"
            >
              Abbrechen
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
