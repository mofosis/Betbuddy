import { db } from '../firebase';
import { collection, getDocs, writeBatch, doc, deleteDoc } from 'firebase/firestore';

export interface ResetOptions {
  resetBets: boolean;
  resetNotifications: boolean;
  resetUserStats: boolean;
}

export async function resetAllData(options: ResetOptions) {
  let batch = writeBatch(db);
  let count = 0;

  const commitBatch = async () => {
    if (count > 0) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  };

  const addToBatch = async (operation: () => void) => {
    operation();
    count++;
    if (count >= 450) { // Keep a safety margin
      await commitBatch();
    }
  };

  // 1. Delete all bets
  if (options.resetBets) {
    const betsSnap = await getDocs(collection(db, 'bets'));
    for (const betDoc of betsSnap.docs) {
      await addToBatch(() => batch.delete(betDoc.ref));
    }
  }

  // 2. Delete all notifications
  if (options.resetNotifications) {
    const notificationsSnap = await getDocs(collection(db, 'notifications'));
    for (const notifDoc of notificationsSnap.docs) {
      await addToBatch(() => batch.delete(notifDoc.ref));
    }
  }

  // 3. Reset all users
  if (options.resetUserStats) {
    const usersSnap = await getDocs(collection(db, 'users'));
    for (const userDoc of usersSnap.docs) {
      await addToBatch(() => batch.update(userDoc.ref, {
        balance: 1000,
        wins: 0,
        losses: 0
      }));
    }
  }

  await commitBatch();
  console.log('System reset completed successfully with options:', options);
}
