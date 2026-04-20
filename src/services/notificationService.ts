import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { NotificationType } from '../types';

export const createNotification = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  betId?: string,
  requestingUserId?: string
) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      title,
      message,
      betId: betId || null,
      requestingUserId: requestingUserId || null,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};
