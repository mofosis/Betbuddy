import React, { useState, useEffect } from 'react';
import { auth, db, signIn, logOut, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, collection, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { UserProfile, Bet } from './types';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { LandingPage } from './components/LandingPage';
import { UserProfileModal } from './components/UserProfileModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedBetId, setSelectedBetId] = useState<string | null>(null);
  const [selectedUserFromSearch, setSelectedUserFromSearch] = useState<UserProfile | null>(null);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      // Clean up previous profile listener if it exists
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = undefined;
      }

      if (firebaseUser) {
        // Check if profile exists, if not create it
        const userRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Anonymous',
              displayNameLower: (firebaseUser.displayName || 'Anonymous').toLowerCase(),
              email: firebaseUser.email || '',
              balance: 1000,
              wins: 0,
              losses: 0,
              photoURL: firebaseUser.photoURL || undefined,
              theme: 'brutal-flat',
              createdAt: serverTimestamp(),
            };
            await setDoc(userRef, newProfile);
          }
          
          // Listen for profile changes (balance updates, push token, etc)
          profileUnsubscribe = onSnapshot(userRef, async (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data() as UserProfile;
              setProfile(data);
              
              // Migration: Ensure displayNameLower exists
              if (!data.displayNameLower) {
                await setDoc(userRef, { 
                  displayNameLower: data.displayName.toLowerCase() 
                }, { merge: true });
              }
            }
          }, (error) => handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`));
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (profile?.theme) {
      document.documentElement.setAttribute('data-theme', profile.theme);
    } else {
      document.documentElement.setAttribute('data-theme', 'brutal-flat');
    }
  }, [profile?.theme]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-[100dvh] bg-app-bg text-app-text font-sans selection:bg-app-accent/30 transition-colors duration-300">
        <AnimatePresence mode="wait">
          {!user ? (
            <LandingPage onSignIn={signIn} />
          ) : (
            <motion.div 
              key="app"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col min-h-[100dvh]"
            >
              <Navbar 
                user={user} 
                profile={profile} 
                onOpenProfile={() => setIsProfileModalOpen(true)}
                onBetInviteClick={(betId) => setSelectedBetId(betId)}
              />
              <main className="flex-1 max-w-7xl mx-auto w-full px-4 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom))] md:pb-8">
                {profile && (
                  <Dashboard 
                    profile={profile} 
                    initialBetId={selectedBetId} 
                    initialUser={selectedUserFromSearch}
                    onBetIdHandled={() => setSelectedBetId(null)} 
                    onUserHandled={() => setSelectedUserFromSearch(null)}
                  />
                )}
              </main>

              <AnimatePresence>
                {isProfileModalOpen && profile && (
                  <UserProfileModal 
                    profile={profile} 
                    onClose={() => setIsProfileModalOpen(false)} 
                  />
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
