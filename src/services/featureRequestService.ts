import { FeatureRequest } from '../types';

export async function submitFeatureRequest(userId: string, userName: string, title: string, description: string) {
  const res = await fetch('/api/feature-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, userName, title, description }),
  });
  if (!res.ok) throw new Error('Failed to submit feature request');
  return res.json();
}

export async function toggleUpvote(requestId: string, _userId: string, _isUpvoted: boolean) {
  const res = await fetch(`/api/feature-requests/${requestId}/upvote`, { method: 'PUT' });
  if (!res.ok) throw new Error('Failed to toggle upvote');
  return res.json();
}

export async function fetchFeatureRequests(): Promise<FeatureRequest[]> {
  const res = await fetch('/api/feature-requests');
  if (!res.ok) return [];
  return res.json();
}

export function subscribeToFeatureRequests(callback: (requests: FeatureRequest[]) => void): () => void {
  fetchFeatureRequests().then(callback);
  return () => {};
}

export async function updateRequestStatus(requestId: string, status: FeatureRequest['status']) {
  const res = await fetch(`/api/feature-requests/${requestId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
}
