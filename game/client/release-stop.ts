// This stores only a fixed nonsecret stop bit, never a credential, transcript, or allowance.
export function protectedLiveStopped(): boolean {
  try { return sessionStorage.getItem('tmh-goal-007-provider-stopped') === '1'; }
  catch { return false; }
}

export function rememberProtectedLiveStop(): void {
  try { sessionStorage.setItem('tmh-goal-007-provider-stopped', '1'); }
  catch { /* The current page still refuses another paid attempt. */ }
}
