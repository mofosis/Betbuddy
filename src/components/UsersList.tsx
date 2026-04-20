import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Search, User as UserIcon, Trophy, Coins, TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UsersListProps {
  onUserClick?: (user: UserProfile) => void;
}

export function UsersList({ onUserClick }: UsersListProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredUsers = users.filter(user => 
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-app-text/40" />
        <input
          type="text"
          placeholder="User suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-app-card border border-app-border rounded-2xl pl-12 pr-4 py-4 text-app-text focus:outline-none focus:border-app-accent transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-10 h-10 border-4 border-app-accent border-t-transparent rounded-full"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredUsers.map((user, index) => (
              <motion.div
                key={user.uid}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onUserClick?.(user)}
                className="bg-app-card border border-app-border rounded-3xl p-5 hover:border-app-accent transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName} className="w-14 h-14 rounded-2xl object-cover border-2 border-app-border group-hover:border-app-accent transition-colors" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-app-bg flex items-center justify-center border-2 border-app-border group-hover:border-app-accent transition-colors">
                        <UserIcon className="w-6 h-6 text-app-text/40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-app-text truncate">{user.displayName}</h3>
                    <p className="text-sm text-app-text/50 truncate">{user.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-6">
                  <div className="bg-app-bg rounded-xl p-2 text-center border border-app-border/50">
                    <div className="flex justify-center mb-1">
                      <Coins className="w-3.5 h-3.5 text-app-accent" />
                    </div>
                    <div className="text-xs font-bold text-app-text">{user.balance}</div>
                    <div className="text-[10px] text-app-text/50 uppercase font-medium">Coins</div>
                  </div>
                  <div className="bg-app-bg rounded-xl p-2 text-center border border-app-border/50">
                    <div className="flex justify-center mb-1">
                      <TrendingUp className="w-3.5 h-3.5 text-app-accent" />
                    </div>
                    <div className="text-xs font-bold text-app-text">{user.wins || 0}</div>
                    <div className="text-[10px] text-app-text/50 uppercase font-medium">Wins</div>
                  </div>
                  <div className="bg-app-bg rounded-xl p-2 text-center border border-app-border/50">
                    <div className="flex justify-center mb-1">
                      <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                    </div>
                    <div className="text-xs font-bold text-app-text">{user.losses || 0}</div>
                    <div className="text-[10px] text-app-text/50 uppercase font-medium">Losses</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {!loading && filteredUsers.length === 0 && (
        <div className="text-center py-20 text-app-text/40">
          <UserIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>Keine User gefunden.</p>
        </div>
      )}
    </div>
  );
}
