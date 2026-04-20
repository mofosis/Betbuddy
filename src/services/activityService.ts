import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Activity } from '../types';

export async function logActivity(activity: Omit<Activity, 'id' | 'createdAt'>) {
  try {
    await addDoc(collection(db, 'activities'), {
      ...activity,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

export function subscribeToActivities(callback: (activities: Activity[]) => void) {
  const q = query(
    collection(db, 'activities'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );

  return onSnapshot(q, (snapshot) => {
    const activities = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Activity));
    callback(activities);
  });
}
