/**
 * Market Data Store
 * Manages market data state with auto-refresh.
 */
import { createSignal, createEffect } from 'solid-js';
import {
    fetchMarketData,
    fetchMarketState,
    fetchBars,
    fetchTradeSetups,
    type MarketDataResponse,
    type MarketStateResponse,
    type TradeSetupsResponse
} from '../api/client';
import { selectedTimeframes } from './settings';

const REFRESH_INTERVAL = 5000; // 5 seconds

// Reactive signals for market data
const [marketData, setMarketData] = createSignal<MarketDataResponse | null>(null);
const [marketState, setMarketState] = createSignal<MarketStateResponse | null>(null);
const [tradeSetups, setTradeSetups] = createSignal<TradeSetupsResponse | null>(null);
const [chartBars, setChartBars] = createSignal<Array<{ time: number; open: number; high: number; low: number; close: number }>>([]);
const [lastUpdate, setLastUpdate] = createSignal<Date | null>(null);
const [isLoading, setIsLoading] = createSignal(false);
const [error, setError] = createSignal<string | null>(null);

/**
 * Fetch all market data.
 */
async function refreshData(): Promise<void> {
    const timeframes = selectedTimeframes();
    if (timeframes.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
        // Fetch all data in parallel
        const [dataResult, stateResult, barsResult, setupsResult] = await Promise.allSettled([
            fetchMarketData(timeframes),
            fetchMarketState(timeframes),
            fetchBars(timeframes[0], 500), // Use finest timeframe for chart
            fetchTradeSetups(),
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

        if (setupsResult.status === 'fulfilled') {
            setTradeSetups(setupsResult.value);
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

// Re-fetch when timeframes change
createEffect(() => {
    selectedTimeframes(); // Subscribe to changes
    refreshData();
});

export {
    marketData,
    marketState,
    tradeSetups,
    chartBars,
    lastUpdate,
    isLoading,
    error,
    refreshData,
};
