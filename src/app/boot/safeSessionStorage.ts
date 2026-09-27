/** sessionStorage access that never throws (privacy modes, sandboxed iframes). */
export const safeSessionStorage = {
  getItem(key: string): string | null {
    try { return window.sessionStorage.getItem(key); } catch { return null; }
  },
  setItem(key: string, value: string): void {
    try { window.sessionStorage.setItem(key, value); } catch { /* storage unavailable */ }
  },
  removeItem(key: string): void {
    try { window.sessionStorage.removeItem(key); } catch { /* storage unavailable */ }
  },
};
