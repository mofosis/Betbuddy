export interface ResetOptions {
  resetBets: boolean;
  resetNotifications: boolean;
  resetUserStats: boolean;
}

export async function resetAllData(options: ResetOptions): Promise<void> {
  const res = await fetch('/api/admin/reset', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Reset failed' }));
    throw new Error(err.error || 'Reset failed');
  }
  console.log('System reset completed successfully with options:', options);
}
