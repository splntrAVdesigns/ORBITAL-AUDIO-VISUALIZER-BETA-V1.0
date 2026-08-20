/**
 * ORBITAL Auto-Reactivity Engine
 * Extracted from App.tsx for better code organization
 * 
 * Adaptive gain control for consistent visuals across all music
 * Uses circular buffer for zero-allocation performance
 */

export class AutoReactivityEngine {
  // 🚀 TIER 1 FIX: Circular buffer for energy history (eliminates push/slice allocations!)
  private readonly HISTORY_SIZE = 180; // 3 seconds @ 60fps
  private readonly energyHistoryBuffer = new Float32Array(this.HISTORY_SIZE);
  private energyHistoryIndex = 0; // Write position
  private energyHistoryCount = 0; // Number of samples (0-180)
  
  private readonly HISTORY_DURATION_MS = 3000; // 3-second rolling window
  private readonly TARGET_ENERGY = 0.6; // Sweet spot (60% utilization)
  private readonly SMOOTHING_RATE = 0.02; // Slow adaptation
  
  public autoGain: number = 1.0;
  private lastUpdateTime: number = 0;
  
  /**
   * Update adaptive gain based on current audio energy
   * @param currentEnergy - Normalized audio energy (0-1)
   * @param timestamp - Current time in milliseconds
   * @returns Adjusted energy with auto-gain applied
   */
  updateAdaptiveGain(currentEnergy: number, timestamp: number): number {
    // 🚀 TIER 1 FIX: Add to circular buffer (zero allocations!)
    this.energyHistoryBuffer[this.energyHistoryIndex] = currentEnergy;
    this.energyHistoryIndex = (this.energyHistoryIndex + 1) % this.HISTORY_SIZE;
    if (this.energyHistoryCount < this.HISTORY_SIZE) {
      this.energyHistoryCount++;
    }
    
    // Calculate average energy over window (using circular buffer)
    let sum = 0;
    for (let i = 0; i < this.energyHistoryCount; i++) {
      sum += this.energyHistoryBuffer[i];
    }
    const avgEnergy = this.energyHistoryCount > 0
      ? sum / this.energyHistoryCount
      : currentEnergy;
    
    // Auto-calibrate gain to hit target energy
    // Avoid division by zero
    if (avgEnergy > 0.01) {
      const targetGain = this.TARGET_ENERGY / avgEnergy;
      // Smoothly lerp towards target gain (prevents sudden jumps)
      this.autoGain += (targetGain - this.autoGain) * this.SMOOTHING_RATE;
      // Clamp gain to reasonable range (0.3x - 3.0x)
      this.autoGain = Math.max(0.3, Math.min(3.0, this.autoGain));
    }
    
    this.lastUpdateTime = timestamp;
    
    // Apply auto-gain to current energy
    return Math.min(1.0, currentEnergy * this.autoGain);
  }
  
  /**
   * Reset the engine (useful when changing songs)
   */
  reset() {
    // 🚀 TIER 1 FIX: Reset circular buffer instead of array
    this.energyHistoryIndex = 0;
    this.energyHistoryCount = 0;
    // Clear buffer (optional but ensures clean state)
    this.energyHistoryBuffer.fill(0);
    this.autoGain = 1.0;
  }
  
  /**
   * Get current gain multiplier (for debugging/display)
   */
  getGain(): number {
    return this.autoGain;
  }
}
