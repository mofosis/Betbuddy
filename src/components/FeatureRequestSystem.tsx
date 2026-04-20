import React, { useState, useEffect } from 'react';
import { FeatureRequest, UserProfile } from '../types';
import { subscribeToFeatureRequests, submitFeatureRequest, toggleUpvote, updateRequestStatus } from '../services/featureRequestService';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquarePlus, ThumbsUp, Clock, CheckCircle2, Construction, Send, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FeatureRequestSystemProps {
  profile: UserProfile;
}

export function FeatureRequestSystem({ profile }: FeatureRequestSystemProps) {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const isAdmin = profile.email === 'martinmosteil@gmail.com';

  useEffect(() => {
    return subscribeToFeatureRequests(setRequests);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;

    setIsSubmitting(true);
    try {
      await submitFeatureRequest(profile.uid, profile.displayName, newTitle, newDescription);
      setNewTitle('');
      setNewDescription('');
      setShowForm(false);
    } catch (error) {
      console.error('Error submitting request:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: FeatureRequest['status']) => {
    switch (status) {
      case 'pending': return <Clock className="w-3 h-3" />;
      case 'planned': return <Construction className="w-3 h-3" />;
      case 'completed': return <CheckCircle2 className="w-3 h-3" />;
    }
  };

  const getStatusLabel = (status: FeatureRequest['status']) => {
    switch (status) {
      case 'pending': return 'Vorgeschlagen';
      case 'planned': return 'Geplant';
      case 'completed': return 'Umgesetzt';
    }
  };

  const getStatusColor = (status: FeatureRequest['status']) => {
    switch (status) {
      case 'pending': return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
      case 'planned': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'completed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-app-text">Feature Requests</h3>
          <p className="text-sm text-app-text/60 text-balance">Hilf uns, BetBuddy besser zu machen!</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="p-3 bg-app-accent text-app-bg rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-app-accent/20"
        >
          {showForm ? <X className="w-5 h-5" /> : <MessageSquarePlus className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="bg-app-card border border-app-border rounded-3xl p-6 space-y-4 overflow-hidden"
          >
            <div className="space-y-2">
              <label className="text-xs font-bold text-app-text/40 uppercase tracking-widest">Titel</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Was für ein Feature wünschst du dir?"
                className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-3 text-app-text focus:outline-none focus:border-app-accent transition-colors"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-app-text/40 uppercase tracking-widest">Beschreibung</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Beschreibe kurz, wie das Feature funktionieren soll..."
                className="w-full bg-app-bg border border-app-border rounded-xl px-4 py-3 text-app-text focus:outline-none focus:border-app-accent transition-colors min-h-[100px] resize-none"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-app-accent text-app-bg rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-app-bg border-t-transparent rounded-full" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Vorschlag absenden
                </>
              )}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid gap-4">
        {requests.map((request) => {
          const isUpvoted = request.upvotes.includes(profile.uid);
          return (
            <motion.div
              key={request.id}
              layout
              className="bg-app-card border border-app-border rounded-3xl p-6 flex gap-6 items-start hover:border-app-accent/30 transition-colors"
            >
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => toggleUpvote(request.id, profile.uid, isUpvoted)}
                  className={cn(
                    "p-3 rounded-2xl border transition-all flex flex-col items-center gap-1",
                    isUpvoted ? "bg-app-accent text-app-bg border-app-accent" : "bg-app-bg text-app-text/40 border-app-border hover:border-app-accent/50"
                  )}
                >
                  <ThumbsUp className={cn("w-5 h-5", isUpvoted ? "fill-current" : "")} />
                  <span className="text-xs font-bold">{request.upvotes.length}</span>
                </button>
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border mb-2", getStatusColor(request.status))}>
                      {getStatusIcon(request.status)}
                      {getStatusLabel(request.status)}
                    </div>
                    <h4 className="text-lg font-bold text-app-text">{request.title}</h4>
                  </div>
                  {isAdmin && (
                    <select
                      value={request.status}
                      onChange={(e) => updateRequestStatus(request.id, e.target.value as any)}
                      className="bg-app-bg border border-app-border rounded-lg px-2 py-1 text-xs text-app-text focus:outline-none focus:border-app-accent"
                    >
                      <option value="pending">Vorgeschlagen</option>
                      <option value="planned">Geplant</option>
                      <option value="completed">Umgesetzt</option>
                    </select>
                  )}
                </div>
                <p className="text-sm text-app-text/60 leading-relaxed">{request.description}</p>
                <div className="flex items-center gap-3 text-[10px] text-app-text/40 font-medium pt-2 border-t border-app-border/50">
                  <span className="flex items-center gap-1">
                    <Construction className="w-3 h-3" />
                    Von {request.userName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {request.createdAt?.toDate ? formatDistanceToNow(request.createdAt.toDate(), { addSuffix: true, locale: de }) : "Gerade eben"}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}

        {requests.length === 0 && (
          <div className="py-20 text-center text-app-text/30 border-2 border-dashed border-app-border rounded-3xl">
            <MessageSquarePlus className="w-12 h-12 mx-auto mb-4 opacity-10" />
            <p className="text-lg">Noch keine Feature Requests vorhanden.</p>
            <p className="text-sm">Sei der Erste und mach einen Vorschlag!</p>
          </div>
        )}
      </div>
    </div>
  );
}
