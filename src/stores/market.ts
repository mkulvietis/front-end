/**
 * Market Data Store
 * Manages market data state with auto-refresh.
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

const REFRESH_INTERVAL = 5000; // 5 seconds

// Reactive signals for market data
const [marketData, setMarketData] = createSignal<MarketDataResponse | null>(null);
const [marketState, setMarketState] = createSignal<MarketStateResponse | null>(null);
const [chartBars, setChartBars] = createSignal<Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>>([]);
const [chartTrendlines, setChartTrendlines] = createSignal<TrendlineTimeframeResult | null>(null);
const [lastUpdate, setLastUpdate] = createSignal<Date | null>(null);
const [isLoading, setIsLoading] = createSignal(false);
const [error, setError] = createSignal<string | null>(null);

/**
 * Fetch all market data.
 */
const trendlineCache = new Map<number, TrendlineTimeframeResult>();

async function refreshData(): Promise<void> {
    const timeframes = selectedTimeframes();
    const chartTf = chartTimeframe();
    if (timeframes.length === 0) return;

    // Only set generic loading if we are doing a full refresh that might block UI?
    // Actually, background refresh shouldn't flicker loading state ideally.
    // typically strictly background refresh doesn't set global isLoading if initialized.
    // But keeping existing behavior for now.
    // setIsLoading(true); 
    setError(null);

    try {
        // Fetch market data and bars always
        const dataPromise = fetchMarketData(timeframes);
        const statePromise = fetchMarketState(timeframes);
        const barsPromise = fetchBars(chartTf, 500);

        // NO automatic trendline fetching here anymore.

        const [dataResult, stateResult, barsResult] = await Promise.allSettled([
            dataPromise,
            statePromise,
            barsPromise,
        ]);

        if (dataResult.status === 'fulfilled') setMarketData(dataResult.value);
        if (stateResult.status === 'fulfilled') setMarketState(stateResult.value);
        if (barsResult.status === 'fulfilled') setChartBars(barsResult.value);

        setLastUpdate(new Date());
    } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
        // setIsLoading(false);
    }
}

/**
 * Explicitly recalculate trendlines for the current chart timeframe.
 * Updates cache and signal.
 */
export async function recalculateTrendlines() {
    const tf = chartTimeframe();
    setIsLoading(true); // Optional: show loading indicator
    try {
        const result = await fetchTrendlines([tf], 500);
        const key = `${tf}min`;
        if (result && result.timeframes && result.timeframes[key]) {
            const data = result.timeframes[key];
            trendlineCache.set(tf, data);

            // Only update signal if current timeframe is still the one we fetched
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

// Auto-refresh on interval
let intervalId: number | undefined;

export function startAutoRefresh(): void {
    refreshData(); // Initial fetch
    intervalId = window.setInterval(refreshData, REFRESH_INTERVAL);
}

export function stopAutoRefresh(): void {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
    }
}

// Re-fetch when timeframes or chart timeframe change
createEffect(() => {
    selectedTimeframes(); // Subscribe to changes
    const tf = chartTimeframe(); // Subscribe to chart timeframe changes
    refreshData();

    // Trendline Handling:
    // If we have cached data for this timeframe, use it.
    // If not, show nothing (wait for manual recalc).
    if (trendlineCache.has(tf)) {
        setChartTrendlines(trendlineCache.get(tf)!);
    } else {
        // First time or no cache -> Clear and wait for user
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
    refreshData,
};
