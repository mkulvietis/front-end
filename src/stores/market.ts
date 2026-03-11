/**
 * Market Data Store
 * Manages market data state with auto-refresh.
 *
 * Two refresh tiers:
 *   Slow (15s): market_data, market_state — heavy analytical endpoints
 *   Fast (5s):  chart bars — lightweight, fetches only 2 bars when recent
 */
import { createSignal, createEffect } from 'solid-js';
import {
    fetchMarketData,
    fetchMarketState,
    fetchBars,
    fetchTrendlines,
    type MarketDataResponse,
    type MarketStateResponse,
    type TrendlineTimeframeResult,
} from '../api/client';
import { selectedTimeframes, chartTimeframe } from './settings';

const ANALYSIS_INTERVAL = 30000; // 30s — market_data + market_state
const BARS_INTERVAL = 5000;      // 5s  — chart bars (incremental)

// If chart was updated less than 60s ago, fetch only a few bars
const INCREMENTAL_THRESHOLD_MS = 60_000;
const INCREMENTAL_BARS_BACK = 2;
const FULL_BARS_BACK = 500;

// Reactive signals for market data
const [marketData, setMarketData] = createSignal<MarketDataResponse | null>(null);
const [marketState, setMarketState] = createSignal<MarketStateResponse | null>(null);
const [chartBars, setChartBars] = createSignal<Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>>([]);
const [chartTrendlines, setChartTrendlines] = createSignal<TrendlineTimeframeResult | null>(null);
const [lastUpdate, setLastUpdate] = createSignal<Date | null>(null);
const [isLoading, setIsLoading] = createSignal(false);
const [error, setError] = createSignal<string | null>(null);

const trendlineCache = new Map<number, TrendlineTimeframeResult>();

// Track when bars were last fully loaded so we know when to do incremental
let lastBarsFullLoad = 0;

/**
 * Merge incoming bars into existing chart data.
 * Updates existing bars (same time key) and appends new ones.
 */
function mergeBars(
    existing: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>,
    incoming: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>,
): Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }> {
    if (existing.length === 0) return incoming;
    if (incoming.length === 0) return existing;

    // Build a map from existing bars for quick lookup
    const map = new Map(existing.map(b => [b.time, b]));

    for (const bar of incoming) {
        map.set(bar.time, bar); // overwrite or insert
    }

    // Return sorted by time
    return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

// ==================== Slow loop: analysis data (15s) ====================

let analysisTimerId: number | undefined;

async function refreshAnalysis(): Promise<void> {
    const timeframes = selectedTimeframes();
    if (timeframes.length === 0) return;

    setError(null);

    try {
        const dataResult = await fetchMarketData(timeframes);
        setMarketData(dataResult);
    } catch (e) { console.error("Market data fetch error:", e); }

    try {
        const stateResult = await fetchMarketState(timeframes);
        setMarketState(stateResult);
    } catch (e) { console.error("Market state fetch error:", e); }

    setLastUpdate(new Date());

    // Schedule next
    if (analysisTimerId !== undefined) {
        analysisTimerId = window.setTimeout(refreshAnalysis, ANALYSIS_INTERVAL);
    }
}

// ==================== Fast loop: chart bars (5s) ====================

let barsTimerId: number | undefined;

async function refreshBars(): Promise<void> {
    const chartTf = chartTimeframe();

    try {
        const now = Date.now();
        const isRecent = lastBarsFullLoad > 0 && (now - lastBarsFullLoad) < INCREMENTAL_THRESHOLD_MS;
        const barsBack = isRecent ? INCREMENTAL_BARS_BACK : FULL_BARS_BACK;

        const newBars = await fetchBars(chartTf, barsBack);

        if (isRecent) {
            // Merge incoming bars into existing chart data
            const merged = mergeBars(chartBars(), newBars);
            setChartBars(merged);
        } else {
            // Full replacement
            setChartBars(newBars);
            lastBarsFullLoad = Date.now();
        }
    } catch (e) { console.error("Bars fetch error:", e); }

    // Schedule next
    if (barsTimerId !== undefined) {
        barsTimerId = window.setTimeout(refreshBars, BARS_INTERVAL);
    }
}

// ==================== Combined start/stop ====================

export function startAutoRefresh(): void {
    if (analysisTimerId !== undefined) return; // already running
    analysisTimerId = -1;
    barsTimerId = -1;
    lastBarsFullLoad = 0; // force full load on first fetch
    refreshAnalysis();
    refreshBars();
}

export function stopAutoRefresh(): void {
    if (analysisTimerId !== undefined && analysisTimerId !== -1) {
        window.clearTimeout(analysisTimerId);
    }
    analysisTimerId = undefined;

    if (barsTimerId !== undefined && barsTimerId !== -1) {
        window.clearTimeout(barsTimerId);
    }
    barsTimerId = undefined;
}

/**
 * Full refresh — called when timeframe/settings change.
 * Resets bars to force a full reload, then restarts both loops.
 */
export async function refreshData(): Promise<void> {
    stopAutoRefresh();
    lastBarsFullLoad = 0; // force full bar reload
    analysisTimerId = -1;
    barsTimerId = -1;
    await refreshAnalysis();
    await refreshBars();
}

/**
 * Explicitly recalculate trendlines for the current chart timeframe.
 * Updates cache and signal.
 */
export async function recalculateTrendlines() {
    const tf = chartTimeframe();
    setIsLoading(true);
    try {
        const result = await fetchTrendlines([tf], 500);
        const key = `${tf}min`;
        if (result && result.timeframes && result.timeframes[key]) {
            const data = result.timeframes[key];
            trendlineCache.set(tf, data);

            if (chartTimeframe() === tf) {
                setChartTrendlines(data);
            }
        }
    } catch (e) {
        console.error("Failed to recalculate trendlines", e);
    } finally {
        setIsLoading(false);
    }
}

let effectTimeout: number | undefined;
let effectInitialized = false;

// Re-fetch when timeframes or chart timeframe change
createEffect(() => {
    selectedTimeframes(); // Subscribe to changes
    const tf = chartTimeframe(); // Subscribe to chart timeframe changes

    // Skip initial run — startAutoRefresh() handles the first fetch
    if (!effectInitialized) {
        effectInitialized = true;
        return;
    }

    // Debounce the refresh to avoid double-fetching when both signals change
    if (effectTimeout) window.clearTimeout(effectTimeout);
    effectTimeout = window.setTimeout(() => {
        if (analysisTimerId !== undefined) {
            refreshData();
        }
    }, 50);

    // Trendline Handling:
    // If we have cached data for this timeframe, use it.
    // If not, show nothing (wait for manual recalc).
    if (trendlineCache.has(tf)) {
        setChartTrendlines(trendlineCache.get(tf)!);
    } else {
        setChartTrendlines(null);
    }
});

export {
    marketData,
    marketState,
    chartBars,
    chartTrendlines,
    lastUpdate,
    isLoading,
    error,
};
