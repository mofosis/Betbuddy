import { Activity } from '../types';

export async function logActivity(_activity: Omit<Activity, 'id' | 'createdAt'>) {
  // Activities are logged server-side after bet operations
}

export async function fetchActivities(): Promise<Activity[]> {
  const res = await fetch('/api/activities');
  if (!res.ok) return [];
  return res.json();
}

export function subscribeToActivities(callback: (activities: Activity[]) => void): () => void {
  fetchActivities().then(callback);
  return () => {};
}
