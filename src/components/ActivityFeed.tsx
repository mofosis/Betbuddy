import React, { useState, useEffect } from 'react';
import { Activity } from '../types';
import { subscribeToActivities } from '../services/activityService';
import { motion, AnimatePresence } from 'motion/react';
import { Coins, UserPlus, CheckCircle2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

export function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    return subscribeToActivities(setActivities);
  }, []);

  const getIcon = (type: Activity['type']) => {
    switch (type) {
      case 'bet_created': return <UserPlus className="w-4 h-4 text-blue-500" />;
      case 'bet_joined': return <Coins className="w-4 h-4 text-app-accent" />;
      case 'bet_resolved': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    }
  };

  const getMessage = (activity: Activity) => {
    switch (activity.type) {
      case 'bet_created':
        return (
          <span>
            <span className="font-bold text-app-text">{activity.userName}</span> hat eine neue Wette erstellt: <span className="text-app-accent font-medium">"{activity.betTitle}"</span>
          </span>
        );
      case 'bet_joined':
        return (
          <span>
            <span className="font-bold text-app-text">{activity.userName}</span> ist der Wette <span className="text-app-accent font-medium">"{activity.betTitle}"</span> beigetreten.
          </span>
        );
      case 'bet_resolved':
        return (
          <span>
            <span className="font-bold text-app-text">{activity.userName}</span> hat die Wette <span className="text-app-accent font-medium">"{activity.betTitle}"</span> gewonnen!
          </span>
        );
    }
  };

  return (
    <div className="bg-app-card border border-app-border rounded-3xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-app-text">Aktivitäts-Feed</h3>
        <span className="px-2 py-0.5 bg-app-accent/10 text-app-accent text-[10px] font-bold uppercase rounded-full border border-app-accent/20">Live</span>
      </div>
      
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {activities.map((activity) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex gap-3 p-3 bg-app-bg/50 border border-app-border/50 rounded-2xl hover:border-app-accent/30 transition-colors"
            >
              <div className="mt-1 p-2 bg-app-card rounded-xl border border-app-border shadow-sm">
                {getIcon(activity.type)}
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xs text-app-text/70 leading-relaxed">
                  {getMessage(activity)}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-app-text/40 font-medium">
                  <Clock className="w-3 h-3" />
                  {activity.createdAt?.toDate ? formatDistanceToNow(activity.createdAt.toDate(), { addSuffix: true, locale: de }) : "Gerade eben"}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {activities.length === 0 && (
          <div className="py-10 text-center text-app-text/30 text-sm italic">
            Noch keine Aktivitäten...
          </div>
        )}
      </div>
    </div>
  );
}
