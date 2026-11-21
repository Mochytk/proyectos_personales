// Fired after signing in or out, so sync can start (or stop) without waiting for a timer.
export const SESSION_EVENT = 'constancia:session';

export function announceSessionChange(): void {
  window.dispatchEvent(new Event(SESSION_EVENT));
}
