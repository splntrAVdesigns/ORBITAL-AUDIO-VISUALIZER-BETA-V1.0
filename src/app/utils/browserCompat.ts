// Browser Compatibility Check Utility
// Extracted from App.tsx for better organization

/**
 * Checks if the browser supports all required features for ORBITAL
 * @returns Object with compatibility status and list of missing features
 */
export function checkBrowserCompatibility(): { compatible: boolean; missing: string[] } {
  const missing: string[] = [];
  
  // Check for Web Audio API
  if (typeof AudioContext === 'undefined' && typeof (window as any).webkitAudioContext === 'undefined') {
    missing.push('Web Audio API');
  }
  
  // Check for Canvas 2D
  try {
    const canvas = document.createElement('canvas');
    if (!canvas.getContext || !canvas.getContext('2d')) {
      missing.push('Canvas 2D');
    }
  } catch {
    missing.push('Canvas 2D');
  }
  
  // Check for localStorage
  try {
    localStorage.setItem('__test__', 'test');
    localStorage.removeItem('__test__');
  } catch {
    missing.push('localStorage');
  }
  
  // Check for modern ES6+ features (CSP-safe, no eval)
  try {
    // Direct feature detection without eval
    const test = () => {};
    const { a } = { a: 1 };
    // If we got here, ES6+ is supported
  } catch {
    missing.push('Modern JavaScript (ES6+)');
  }
  
  return { compatible: missing.length === 0, missing };
}

/**
 * Safe localStorage wrapper with error handling
 * Prevents crashes when localStorage is disabled or quota is exceeded
 */
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`localStorage.getItem failed for key "${key}":`, e);
      return null;
    }
  },
  setItem: (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn(`localStorage.setItem failed for key "${key}":`, e);
      // Show user notification
      alert('⚠️ Settings could not be saved. Your browser may have localStorage disabled or storage quota exceeded.');
      return false;
    }
  }
};
