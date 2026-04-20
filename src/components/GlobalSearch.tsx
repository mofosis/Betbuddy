import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { Search, User as UserIcon, X, Coins, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GlobalSearchProps {
  onUserClick?: (user: UserProfile) => void;
}

export function GlobalSearch({ onUserClick }: GlobalSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const lowerSearch = searchTerm.toLowerCase();
    const capitalizedSearch = searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1);
    
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
      const lowerResults = snapshot.docs.map(doc => doc.data() as UserProfile);
      setResults(prev => {
        const combined = [...prev, ...lowerResults];
        const unique = Array.from(new Map(combined.map(u => [u.uid, u])).values());
        return unique.slice(0, 5);
      });
      setLoading(false);
    });

    const unsubDisplay = onSnapshot(qDisplay, (snapshot) => {
      const displayResults = snapshot.docs.map(doc => doc.data() as UserProfile);
      setResults(prev => {
        const combined = [...prev, ...displayResults];
        const unique = Array.from(new Map(combined.map(u => [u.uid, u])).values());
        return unique.slice(0, 5);
      });
      setLoading(false);
    });

    return () => {
      unsubLower();
      unsubDisplay();
    };
  }, [searchTerm]);

  return (
    <div className="relative flex-1 max-w-md" ref={searchRef}>
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text/40 group-focus-within:text-app-accent transition-colors" />
        <input
          type="text"
          placeholder="User suchen..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full bg-app-bg/50 border border-app-border rounded-xl pl-10 pr-4 py-2 text-sm text-app-text focus:outline-none focus:border-app-accent focus:bg-app-bg transition-all"
        />
        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('');
              setResults([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-app-border rounded-full text-app-text/40 hover:text-app-text transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (searchTerm.length >= 2) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full left-0 right-0 mt-2 bg-app-card border border-app-border rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {loading && results.length === 0 ? (
              <div className="p-4 text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-5 h-5 border-2 border-app-accent border-t-transparent rounded-full mx-auto"
                />
              </div>
            ) : results.length > 0 ? (
              <div className="divide-y divide-app-border">
                {results.map((user) => (
                  <button
                    key={user.uid}
                    onClick={() => {
                      onUserClick?.(user);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-app-bg transition-colors text-left group"
                  >
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-xl object-cover border border-app-border group-hover:border-app-accent transition-colors" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-app-bg flex items-center justify-center border border-app-border group-hover:border-app-accent transition-colors">
                        <UserIcon className="w-5 h-5 text-app-text/40" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-app-text truncate group-hover:text-app-accent transition-colors">{user.displayName}</span>
                        <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-app-accent bg-app-accent/10 px-1.5 py-0.5 rounded border border-app-accent/20">
                          <Coins className="w-2.5 h-2.5" />
                          {user.balance}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-app-text/40 truncate">{user.email}</span>
                        <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold">
                          <Trophy className="w-2.5 h-2.5" />
                          {user.wins || 0}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-app-text/40">
                Keine User gefunden.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
