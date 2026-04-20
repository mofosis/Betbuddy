import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Notification as AppNotification } from '../types';
import { Bell, Check, Trash2, X, AlertCircle, Info, UserPlus, Users, Coins, BellRing } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface NotificationsDropdownProps {
  profile: import('../types').UserProfile;
  onBetInviteClick?: (betId: string) => void;
}

export function NotificationsDropdown({ profile, onBetInviteClick }: NotificationsDropdownProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!profile.uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      setNotifications(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));

    return () => unsubscribe();
  }, [profile.uid]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `notifications/${id}`);
    }
  };

  const markAllAsRead = async () => {
    const batch = writeBatch(db);
    notifications.filter(n => !n.read).forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'notifications');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notifications/${id}`);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'invite': return <UserPlus className="w-4 h-4 text-blue-500" />;
      case 'bet_invite': return <Coins className="w-4 h-4 text-app-accent" />;
      case 'update': return <Info className="w-4 h-4 text-amber-500" />;
      case 'resolved': return <Check className="w-4 h-4 text-emerald-500" />;
      default: return <AlertCircle className="w-4 h-4 text-app-text/40" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-app-text/40 hover:text-app-text hover:bg-app-border rounded-lg transition-all relative group"
      >
        <Bell className={cn("w-5 h-5 transition-transform group-hover:scale-110", isOpen && "text-app-accent")} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-app-accent text-app-bg text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-app-card">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-app-card border border-app-border rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-app-border flex items-center justify-between bg-app-bg/50">
                <h3 className="font-bold text-app-text">Benachrichtigungen</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-xs text-app-accent hover:underline font-medium"
                  >
                    Alle als gelesen markieren
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-8 h-8 text-app-text/10 mx-auto mb-2" />
                    <p className="text-sm text-app-text/40 font-medium">Keine Benachrichtigungen</p>
                  </div>
                ) : (
                  <div className="divide-y divide-app-border">
                    {notifications.map((n) => (
                      <div 
                        key={n.id}
                        onClick={() => {
                          if (n.type === 'bet_invite' && n.betId && onBetInviteClick) {
                            onBetInviteClick(n.betId);
                            markAsRead(n.id);
                            setIsOpen(false);
                          }
                        }}
                        className={cn(
                          "p-4 transition-colors group relative",
                          !n.read ? "bg-app-accent/5" : "hover:bg-app-bg/50",
                          n.type === 'bet_invite' && "cursor-pointer"
                        )}
                      >
                        <div className="flex gap-3">
                          <div className="mt-1">
                            {getIcon(n.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={cn(
                                "text-sm font-semibold truncate",
                                !n.read ? "text-app-text" : "text-app-text/70"
                              )}>
                                {n.title}
                              </p>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!n.read && (
                                  <button 
                                    onClick={() => markAsRead(n.id)}
                                    className="p-1 hover:bg-app-border rounded text-app-accent"
                                    title="Als gelesen markieren"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                )}
                                <button 
                                  onClick={() => deleteNotification(n.id)}
                                  className="p-1 hover:bg-app-border rounded text-red-500"
                                  title="Löschen"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <p className="text-sm text-app-text/60 mt-0.5 line-clamp-2">
                              {n.message}
                            </p>
                            <p className="text-[10px] text-app-text/30 mt-1 font-medium">
                              {n.createdAt?.toDate ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true, locale: de }) : 'Gerade eben'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
