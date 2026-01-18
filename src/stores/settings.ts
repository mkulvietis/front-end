/**
 * Settings Store
 * Manages user preferences with localStorage persistence.
 */
import { createSignal, createEffect } from 'solid-js';

const STORAGE_KEY = 'trading-dashboard-settings';

// Available timeframes
export const AVAILABLE_TIMEFRAMES = [1, 3, 5, 10, 15, 30, 60, 120] as const;

// Chart timeframe options (subset for chart display)
export const CHART_TIMEFRAMES = [1, 3, 5, 10, 15, 30, 60] as const;

// Default selected timeframes
const DEFAULT_TIMEFRAMES = [1, 5, 30, 120];

// Default chart timeframe (5 minutes)
const DEFAULT_CHART_TIMEFRAME = 5;

// Load from localStorage
function loadSettings(): { timeframes: number[]; chartTimeframe: number } {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                timeframes: Array.isArray(parsed.timeframes) ? parsed.timeframes : DEFAULT_TIMEFRAMES,
                chartTimeframe: typeof parsed.chartTimeframe === 'number' ? parsed.chartTimeframe : DEFAULT_CHART_TIMEFRAME,
            };
        }
    } catch (e) {
        console.warn('Failed to load settings from localStorage:', e);
    }
    return { timeframes: DEFAULT_TIMEFRAMES, chartTimeframe: DEFAULT_CHART_TIMEFRAME };
}

const initialSettings = loadSettings();

// Create reactive signals
const [selectedTimeframes, setSelectedTimeframes] = createSignal<number[]>(initialSettings.timeframes);
const [chartTimeframe, setChartTimeframe] = createSignal<number>(initialSettings.chartTimeframe);

// Persist to localStorage whenever settings change
createEffect(() => {
    const settings = {
        timeframes: selectedTimeframes(),
        chartTimeframe: chartTimeframe(),
    };
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

export { selectedTimeframes, chartTimeframe, setChartTimeframe };
