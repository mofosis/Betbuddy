import React from 'react';
import { User } from 'firebase/auth';
import { UserProfile } from '../types';
import { Coins, User as UserIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { NotificationsDropdown } from './NotificationsDropdown';

interface NavbarProps {
  user: User;
  profile: UserProfile | null;
  onOpenProfile: () => void;
  onBetInviteClick?: (betId: string) => void;
  onUserClick?: (user: UserProfile) => void;
}

export function Navbar({ user, profile, onOpenProfile, onBetInviteClick }: NavbarProps) {
  return (
    <nav className="border-b border-app-border bg-app-card/50 backdrop-blur-md sticky top-0 z-50 pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-4 h-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 bg-app-accent rounded-md flex items-center justify-center">
            <Coins className="text-app-bg w-4 h-4" />
          </div>
          <span className="font-bold text-lg tracking-tight text-app-text hidden sm:block">BetBuddy</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0 ml-auto">
          {profile && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-app-bg rounded-full border border-app-border">
              <Coins className="w-3.5 h-3.5 text-app-accent" />
              <span className="font-mono text-sm font-medium text-app-accent">{profile.balance.toLocaleString()}</span>
            </div>
          )}

          <div className="flex items-center gap-1 sm:gap-2">
            {profile && <NotificationsDropdown profile={profile} onBetInviteClick={onBetInviteClick} />}
            <button 
              onClick={onOpenProfile}
              className="flex items-center gap-2 hover:bg-app-border p-1 rounded-full transition-colors group"
            >
              <div className="flex flex-col items-end hidden md:flex">
                <span className="text-xs font-medium text-app-text group-hover:text-app-accent transition-colors">{profile?.displayName || user.displayName}</span>
              </div>
              {profile?.photoURL || user.photoURL ? (
                <img src={profile?.photoURL || user.photoURL || ''} alt="" className="w-7 h-7 rounded-full border border-app-border group-hover:border-app-accent transition-colors" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-app-bg flex items-center justify-center border border-app-border group-hover:border-app-accent transition-colors">
                  <UserIcon className="w-3.5 h-3.5 text-app-text/40" />
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
