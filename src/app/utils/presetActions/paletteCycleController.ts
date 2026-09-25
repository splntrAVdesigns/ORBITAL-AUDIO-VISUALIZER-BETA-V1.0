// ORBITAL — Palette menu, favorites and color auto-cycle.
//
// Sprint C: extracted from utils/presetActions.ts. The body below is the
// original code moved verbatim into a factory; the three closure helpers it
// used (ctx, listen, scheduleTimeout) are now passed in explicitly.

import { palettes } from '../../data/colorPalettes';
import { clamp } from '../audioVisualizationHelpers';
import { safeLocalStorage } from '../browserCompat';
import { cancelTrackedInterval, scheduleTrackedInterval } from '../../runtime/mainThread/MainThreadAsyncDiagnostics';
import type { PresetActionsContext } from '../presetActions';

type Listen = (
  target: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: AddEventListenerOptions,
) => void;
type ScheduleTimeout = (callback: () => void, delay: number) => unknown;

const $ = (sel: string) => document.querySelector(sel);

export interface PaletteCycleControllerDeps {
  ctx: PresetActionsContext;
  listen: Listen;
  scheduleTimeout: ScheduleTimeout;
}

export function createPaletteCycleController({ ctx, listen, scheduleTimeout }: PaletteCycleControllerDeps) {

    const paletteBtn = $("#paletteBtn") as HTMLButtonElement;
    const paletteLabel = $("#paletteLabel") as HTMLSpanElement;
    const paletteMenu = $("#paletteMenu") as HTMLDivElement;
    
    // selectedPaletteIndex/palette now live in App.tsx (read by the render loop directly);
    // bridged here via ctx.getSelectedPaletteIndex()/ctx.getPalette()/ctx.setPaletteState().
    let favorites = new Set<number>();
    let starsVisible = true; // DEFAULT: Stars visible on app load
    
    // Load favorites from localStorage
    try {
      const saved = safeLocalStorage.getItem('orbitalFavorites');
      if (saved) {
        favorites = new Set(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Could not load favorites:', e);
    }
    
    // Save favorites to localStorage
    function saveFavorites() {
      try {
        safeLocalStorage.setItem('orbitalFavorites', JSON.stringify([...favorites]));
      } catch (e) {
        console.warn('Could not save favorites:', e);
      }
    }
    
    // Populate custom dropdown
    function renderPaletteMenu() {
      if (!paletteMenu) return;
      paletteMenu.innerHTML = '';
      
      palettes.forEach((p, i) => {
        const optionDiv = document.createElement('div');
        optionDiv.style.cssText = `
          display: flex;
          align-items: center;
          padding: 0.6rem 0.75rem;
          cursor: pointer;
          transition: background 0.15s ease;
          gap: 0.5rem;
          border-bottom: 1px solid rgba(100, 200, 255, 0.1);
        `;
        
        // Checkmark for selected item
        const checkmark = document.createElement('span');
        checkmark.textContent = i === ctx.getSelectedPaletteIndex() ? '✓' : '';
        checkmark.style.cssText = `
          width: 20px;
          color: #1E90FF;
          font-weight: bold;
          flex-shrink: 0;
        `;
        
        // Color name
        const nameSpan = document.createElement('span');
        nameSpan.textContent = p.name;
        nameSpan.style.cssText = `
          flex: 1;
          color: rgba(255, 255, 255, 0.9);
        `;
        
        // Star icon (always present, visibility controlled by starsVisible)
        const starSpan = document.createElement('span');
        starSpan.innerHTML = favorites.has(i) ? '★' : '☆';
        starSpan.style.cssText = `
          color: #1E90FF;
          font-size: 18px;
          cursor: pointer;
          flex-shrink: 0;
          display: ${starsVisible ? 'block' : 'none'};
          width: 24px;
          text-align: center;
        `;
        starSpan.className = 'palette-star';
        
        // Star click handler
        listen(starSpan, 'click', ((e: Event) => {
          e.stopPropagation();
          if (favorites.has(i)) {
            favorites.delete(i);
          } else {
            favorites.add(i);
          }
          saveFavorites();
          renderPaletteMenu();
        }) as EventListener);
        
        // Option click handler
        listen(optionDiv, 'click', () => {
          ctx.setPaletteState(i);
          if (paletteLabel) paletteLabel.textContent = p.name;
          renderPaletteMenu();
          if (paletteMenu) paletteMenu.style.display = 'none';
        });
        
        // Hover effect
        listen(optionDiv, 'mouseenter', () => {
          optionDiv.style.backgroundColor = 'rgba(30, 144, 255, 0.15)';
        });
        listen(optionDiv, 'mouseleave', () => {
          optionDiv.style.backgroundColor = 'transparent';
        });
        
        optionDiv.appendChild(checkmark);
        optionDiv.appendChild(nameSpan);
        optionDiv.appendChild(starSpan);
        paletteMenu.appendChild(optionDiv);
      });
    }
    
    // Toggle dropdown
    if (paletteBtn) {
      listen(paletteBtn, 'click', ((e: Event) => {
        e.stopPropagation();
        if (paletteMenu) {
          const isOpen = paletteMenu.style.display === 'block';
          paletteMenu.style.display = isOpen ? 'none' : 'block';
        }
      }) as EventListener);
    }
    
    // Close dropdown when clicking outside
    ctx.eventHandlers.documentClick = () => {
      if (paletteMenu) paletteMenu.style.display = 'none';
    };
    listen(document, 'click', ctx.eventHandlers.documentClick);
    
    function setPaletteByName(name: string) {
      const idx = palettes.findIndex(p => p.name === name);
      if (idx >= 0) {
        ctx.setPaletteState(idx);
        if (paletteLabel) paletteLabel.textContent = name;
        renderPaletteMenu();
      }
    }
    
    renderPaletteMenu();
    
    // Initialize label with first palette name
    if (paletteLabel) paletteLabel.textContent = palettes[0].name;
    
    const favBtn = $("#fav");
    
    // Star button now toggles visibility of stars in dropdown
    if (favBtn) {
      listen(favBtn, "click", () => {
        starsVisible = !starsVisible;
        renderPaletteMenu();
        
        // Update button appearance
        const starIcon = favBtn.querySelector('.star-icon') as SVGElement;
        if (starIcon) {
          starIcon.style.fill = starsVisible ? '#1E90FF' : 'none';
        }
      });
      
      // Set initial star button state (filled since starsVisible = true by default)
      const starIcon = favBtn.querySelector('.star-icon') as SVGElement;
      if (starIcon) {
        starIcon.style.fill = starsVisible ? '#1E90FF' : 'none';
      }
    }

    const autoBox = $("#auto") as HTMLInputElement;
    const bpmSync = $("#bpmSync") as HTMLInputElement;
    const bpmIn = $("#bpm") as HTMLInputElement;
    const barsIn = $("#bars") as HTMLInputElement;
    const cycleSource = $("#cycleSource") as HTMLInputElement;
    let cycleTimer: ReturnType<typeof setInterval> | null = null;
    
    function nextPalette() {
      const pool = (cycleSource && cycleSource.checked && favorites.size > 0) ? [...favorites] : palettes.map((_, i) => i);
      const cur = ctx.getSelectedPaletteIndex();
      const idx = pool[(pool.indexOf(cur) + 1) % pool.length];
      ctx.setPaletteState(idx);
      if (paletteLabel) paletteLabel.textContent = palettes[idx].name;
      renderPaletteMenu();
    }
    
    function startCycle() {
      stopCycle();
      const change = () => { nextPalette(); };
      if (bpmSync && bpmSync.checked) {
        const bpm = clamp(parseInt(bpmIn?.value || "174", 10), 40, 220);
        const bars = clamp(parseInt(barsIn?.value || "8", 10), 1, 32);
        // Half the BPM speed = double the interval (cycle twice as slow)
        const ms = (60 / bpm) * 1000 * 4 * bars * 2;
        cycleTimer = scheduleTrackedInterval('palette-auto-cycle', change, ms);
      } else {
        cycleTimer = scheduleTrackedInterval('palette-auto-cycle', change, 30000);
      }
    }
    
    function stopCycle() {
      if (cycleTimer) {
        cancelTrackedInterval(cycleTimer);
        cycleTimer = null;
      }
    }
    
    if (autoBox) {
      listen(autoBox, "input", () => {
        const hueSpeedSlider = document.getElementById("hueSpeed") as HTMLInputElement;
        if (autoBox.checked) {
          startCycle();
          nextPalette();
          // Disable Hue Speed when Auto Cycle is ON
          if (hueSpeedSlider) {
            hueSpeedSlider.disabled = true;
            hueSpeedSlider.style.opacity = "0.4";
            hueSpeedSlider.style.cursor = "not-allowed";
          }
        } else {
          stopCycle();
          // Enable Hue Speed when Auto Cycle is OFF
          if (hueSpeedSlider) {
            hueSpeedSlider.disabled = false;
            hueSpeedSlider.style.opacity = "1";
            hueSpeedSlider.style.cursor = "pointer";
          }
        }
      });
      
      // Initialize Auto Cycle on page load if checkbox is checked
      scheduleTimeout(() => {
        const hueSpeedSlider = document.getElementById("hueSpeed") as HTMLInputElement;
        if (autoBox.checked) {
          // Start the auto cycle timer if checkbox is checked by default
          startCycle();
          // Disable Hue Speed when Auto Cycle is ON
          if (hueSpeedSlider) {
            hueSpeedSlider.disabled = true;
            hueSpeedSlider.style.opacity = "0.4";
            hueSpeedSlider.style.cursor = "not-allowed";
          }
        }
      }, 100);
    }
    
    if (bpmSync) {
      listen(bpmSync, "input", () => {
        if (autoBox && autoBox.checked) {
          startCycle();
        }
      });
    }
    
    // Update cycle timing when BPM or Bars change (if Auto Cycle + BPM Sync are on)
    if (bpmIn) {
      listen(bpmIn, "input", () => {
        if (autoBox && autoBox.checked && bpmSync && bpmSync.checked) {
          startCycle();
        }
      });
    }
    
    if (barsIn) {
      listen(barsIn, "input", () => {
        if (autoBox && autoBox.checked && bpmSync && bpmSync.checked) {
          startCycle();
        }
      });
    }

    // 🐛 BUG FIX (BPM Sync audit): the auto-cycle interval previously ran on a plain
    // setInterval, completely independent of the render loop's visibility handling —
    // unlike the shockwave BPM-sync timer (which lives inside the RAF loop and
    // correctly pauses/resumes via Sprint 22H.1's visibility guard), this kept running
    // its own separate, un-synced clock whenever the tab was hidden, with no clean
    // resync on resume. Pausing/restarting it on visibilitychange brings it in line
    // with the same visibility-safety principle already applied everywhere else.
    const handleAutoCycleVisibilityChange = () => {
      if (document.hidden) {
        stopCycle();
      } else if (autoBox && autoBox.checked) {
        startCycle();
      }
    };
    listen(document, "visibilitychange", handleAutoCycleVisibilityChange);

    return {
      paletteLabel,
      saveFavorites,
      renderPaletteMenu,
      setPaletteByName,
      nextPalette,
      startCycle,
      stopCycle,
    };
}
