import React from 'react';
import { UserProfile } from '../types';
import { Trophy, Medal, Award, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

interface LeaderboardProps {
  users: UserProfile[];
  title: string;
  limit?: number;
  onUserClick?: (user: UserProfile) => void;
}

export function Leaderboard({ users, title, limit = 5, onUserClick }: LeaderboardProps) {
  const sortedUsers = [...users].sort((a, b) => {
    // Rank by wins first, then by balance
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.balance - a.balance;
  }).slice(0, limit);

  return (
    <div className="bg-app-card border border-app-border rounded-3xl p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-500" />
        <h3 className="text-xl font-bold text-app-text">{title}</h3>
      </div>

      <div className="space-y-3">
        {sortedUsers.map((user, index) => {
          const winRate = user.wins + user.losses > 0 
            ? Math.round((user.wins / (user.wins + user.losses)) * 100) 
            : 0;

          return (
            <motion.div
              key={user.uid}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onUserClick?.(user)}
              className="flex items-center justify-between p-3 bg-app-bg rounded-2xl border border-app-border/50 group hover:border-app-accent/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full bg-app-card flex items-center justify-center overflow-hidden border-2 border-app-border">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-lg font-bold text-app-text/40">{user.displayName[0]}</span>
                    )}
                  </div>
                  {index < 3 && (
                    <div className="absolute -top-1 -right-1">
                      {index === 0 && <Medal className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                      {index === 1 && <Medal className="w-4 h-4 text-zinc-400 fill-zinc-400" />}
                      {index === 2 && <Medal className="w-4 h-4 text-amber-600 fill-amber-600" />}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-app-text truncate">{user.displayName}</div>
                  <div className="text-[10px] text-app-text/50 flex items-center gap-2 truncate">
                    <span className="flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3 text-app-accent" />
                      {winRate}% Win Rate
                    </span>
                    <span>•</span>
                    <span>{user.wins} Siege</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono font-bold text-app-accent">{user.balance}</div>
                <div className="text-[10px] text-app-text/50 uppercase tracking-wider">BetCoins</div>
              </div>
            </motion.div>
          );
        })}

        {sortedUsers.length === 0 && (
          <div className="py-8 text-center text-app-text/40 text-sm italic">
            Noch keine Daten verfügbar.
          </div>
        )}
      </div>
    </div>
  );
}
