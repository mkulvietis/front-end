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
async function refreshData(): Promise<void> {
    const timeframes = selectedTimeframes();
    const chartTf = chartTimeframe();
    if (timeframes.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
        // Fetch all data in parallel
        const [dataResult, stateResult, barsResult, trendResult] = await Promise.allSettled([
            fetchMarketData(timeframes),
            fetchMarketState(timeframes),
            fetchBars(chartTf, 500), // Use chart timeframe for chart bars
            fetchTrendlines([chartTf], 500),
        ]);

        if (dataResult.status === 'fulfilled') {
            setMarketData(dataResult.value);
        }

        if (stateResult.status === 'fulfilled') {
            setMarketState(stateResult.value);
        }

        if (barsResult.status === 'fulfilled') {
            setChartBars(barsResult.value);
        }

        if (trendResult.status === 'fulfilled') {
            const tfKey = `${chartTf}min`;
            const tfData = trendResult.value.timeframes[tfKey];
            setChartTrendlines(tfData ?? null);
        }

        setLastUpdate(new Date());
    } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
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
    chartTimeframe(); // Subscribe to chart timeframe changes
    refreshData();
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
