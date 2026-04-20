import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { FeatureRequest } from '../types';

export async function submitFeatureRequest(userId: string, userName: string, title: string, description: string) {
  return addDoc(collection(db, 'feature_requests'), {
    userId,
    userName,
    title,
    description,
    upvotes: [],
    status: 'pending',
    createdAt: serverTimestamp()
  });
}

export async function toggleUpvote(requestId: string, userId: string, isUpvoted: boolean) {
  const requestRef = doc(db, 'feature_requests', requestId);
  return updateDoc(requestRef, {
    upvotes: isUpvoted ? arrayRemove(userId) : arrayUnion(userId)
  });
}

export function subscribeToFeatureRequests(callback: (requests: FeatureRequest[]) => void) {
  const q = query(
    collection(db, 'feature_requests'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as FeatureRequest));
    callback(requests);
  });
}

export async function updateRequestStatus(requestId: string, status: FeatureRequest['status']) {
  const requestRef = doc(db, 'feature_requests', requestId);
  return updateDoc(requestRef, { status });
}
