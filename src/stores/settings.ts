/**
 * Settings Store
 * Manages user preferences with localStorage persistence.
 */
import { createSignal, createEffect } from 'solid-js';

const STORAGE_KEY = 'trading-dashboard-settings';

// Available timeframes
export const AVAILABLE_TIMEFRAMES = [1, 3, 5, 10, 15, 30, 60, 120] as const;

// Default selected timeframes
const DEFAULT_TIMEFRAMES = [1, 5, 30, 120];

// Load from localStorage
function loadSettings(): number[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed.timeframes)) {
                return parsed.timeframes;
            }
        }
    } catch (e) {
        console.warn('Failed to load settings from localStorage:', e);
    }
    return DEFAULT_TIMEFRAMES;
}

// Create reactive signals
const [selectedTimeframes, setSelectedTimeframes] = createSignal<number[]>(loadSettings());

// Persist to localStorage whenever settings change
createEffect(() => {
    const settings = { timeframes: selectedTimeframes() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
});

/**
 * Toggle a timeframe on/off.
 */
export function toggleTimeframe(tf: number): void {
    setSelectedTimeframes(prev => {
        if (prev.includes(tf)) {
            // Don't allow removing all timeframes
            if (prev.length <= 1) return prev;
            return prev.filter(t => t !== tf);
        } else {
            return [...prev, tf].sort((a, b) => a - b);
        }
    });
}

/**
 * Check if a timeframe is selected.
 */
export function isTimeframeSelected(tf: number): boolean {
    return selectedTimeframes().includes(tf);
}

/**
 * Get sorted selected timeframes.
 */
export function getSelectedTimeframes(): number[] {
    return selectedTimeframes();
}

export { selectedTimeframes };
