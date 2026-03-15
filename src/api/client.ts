/**
 * API Client for Data Service
 * Provides typed fetch wrappers for all market data endpoints.
 */

// When accessed through a proxy (e.g. ngrok), use same-origin so requests
// go through the data-service proxy. On localhost, hit services directly.
const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const API_BASE = import.meta.env.VITE_API_BASE || (isLocalhost ? 'http://localhost:8000' : '');
const TICKER = '@ES';

// Types based on actual API responses
export interface Bar {
    yyyymmdd: number;
    hhmm: number;
    is_final: boolean;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    indicators: Record<string, { value: number | string | null }>;
    patterns: Array<{ name: string; classification: string }>;
}

export interface Session {
    session: string;
    hhmm: number;
    yyyymmdd: number;
    ORB5?: { low: number; high: number };
    ORB15?: { low: number; high: number };
}

export interface MarketDataResponse {
    ticker: string;
    session: Session;
    data: Record<string, { bars: Bar[] }>;
}

export interface IndicatorSemantic {
    level?: string;
    momentum?: string;
    price_position?: string;
    proximity?: string;
    slope?: string;
    strength?: string;
    volatility?: string;
    trend?: string;
    participation?: string;
    bias?: string;
    divergence?: string;
    regime?: string;
}

export interface TimeframeState {
    is_final: boolean;
    indicators: Record<string, IndicatorSemantic>;
    patterns: Array<{ name: string; classification: string }>;
}

export interface Pivots {
    structural_bias?: {
        cpr_relationship: string;
        bias_direction: string;
    };
    active_zone?: {
        floor_level?: { id: string; raw_id: string; price: number; confidence: number };
        ceiling_level?: { id: string; raw_id: string; price: number; confidence: number } | null;
        zone_width?: number | null;
    };
    primary_interaction?: string | null;
}

export interface MarketStateResponse {
    ticker: string;
    latest_price: number | null;
    session: Session;
    state: Record<string, TimeframeState>;
    pivots?: Pivots;
}

export interface EntryRule {
    type: 'limit' | 'market' | 'stop' | 'immediate';
    price?: number;
    condition?: string;
    conditions?: string;
}

export interface StopLossRule {
    price: number;
    description?: string;
}

export interface TargetRule {
    price: number;
    description?: string;
}

export interface TradeSetup {
    id: string;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    status: 'NEW' | 'MONITORING' | 'CLOSE_TO_ENTRY' | 'TRADING' | 'PROFIT' | 'STOP_LOSS' | 'CANCELED';
    created_at: string;
    entry?: EntryRule;
    stop_loss: StopLossRule;
    targets: TargetRule[];
    rules_text: string;
    reasoning?: string;
}

// Check if we need TradeSetupsResponse still?
// The backend `get_inference_snapshot` returns `active_setups` list now in `InferenceStatus`? 
// Wait, `get_inference_snapshot` returns `active_setups` inside the snapshot dict.
// We also have `fetchTradeSetups` but where is that used? 
// In market.ts: `fetchTradeSetups` calls `/api/trade_setups` (which we didn't explicitly create separate endpoint for, 
// we just added it to `get_snapshot` i.e. `/api/status` or `get_inference_snapshot`).
// Actually, `web_server.py` `get_inference` returns `app_state.get_inference_snapshot()`.
// `state.py` `get_inference_snapshot` DOES NOT include `active_setups`.
// `state.py` `get_snapshot` (for `/api/status`) DOES include `active_setups`.
// So we should fetch setups from `/api/status` or add it to `get_inference` or create `/api/trade_setups`.
// Let's assume we use `/api/status` or we update `fetchTradeSetups` to call `/api/status` or extracts it from there.
// For now, let's update `InferenceStatus` interface to include `active_setups` if we plan to send it there,
// OR update `MarketState`? 
// Actually `/api/status` returns `DaemonState` snapshot.
// Let's update `DaemonStatus` interface here.

export interface DaemonStatus {
    is_running: boolean;
    last_output: string;
    current_interval: number;
    last_updated: string | null;
    auto_inference_interval: number;
    active_setups: TradeSetup[];
}

/**
 * Fetch market data with indicators and patterns.
 */
export async function fetchMarketData(timeframes: number[]): Promise<MarketDataResponse> {
    const response = await fetch(`${API_BASE}/analysis/market_data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ticker: TICKER,
            bars_back: 1,
            timeframes,
        }),
    });

    if (!response.ok) {
        throw new Error(`Market data fetch failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Fetch semantic market state with pivots.
 */
export async function fetchMarketState(timeframes: number[]): Promise<MarketStateResponse> {
    const response = await fetch(`${API_BASE}/analysis/market_state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ticker: TICKER,
            timeframes,
        }),
    });

    if (!response.ok) {
        throw new Error(`Market state fetch failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Fetch OHLCV bars for chart (TradingView format).
 */
export async function fetchBars(timeframe: number = 1, barsBack: number = 500): Promise<Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}>> {
    const response = await fetch(
        `${API_BASE}/bars/${TICKER}?timeframe=${timeframe}&bars_back=${barsBack}`
    );

    if (!response.ok) {
        throw new Error(`Bars fetch failed: ${response.status}`);
    }

    const bars = await response.json();

    // Convert to TradingView format (time in seconds)
    // Adjust by local timezone offset so chart displays local time
    const localOffsetSeconds = new Date().getTimezoneOffset() * -60;

    return bars.map((bar: any) => ({
        time: new Date(bar.bar_datetime).getTime() / 1000 + localOffsetSeconds,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
    }));
}

// --- Trendlines ---

export interface TrendlinePivot {
    index: number;
    price: number;
    type: string;
    bar_datetime?: string;
}

export interface TrendlineData {
    timeframe: number;
    type: string;  // "support" or "resistance"
    anchor_pivot: TrendlinePivot;
    second_pivot: TrendlinePivot;
    slope: number;
    intercept: number;
    touch_count: number;
    touch_pivots: TrendlinePivot[];
    is_regression: boolean;
    score: number;
}

export interface PriceRelation {
    trendline_index: number;
    type: string;        // "support" or "resistance"
    distance: number;
    distance_pct: number;
    distance_atr: number;
    proximity: string;   // "at", "near", "moderate", "far", "extreme"
    line_price: number;
}

export interface TrendlineTimeframeResult {
    trendlines: TrendlineData[];
    price_relations: PriceRelation[];
    last_bar_index?: number;
    last_bar_datetime?: string;
}

export interface TrendlineResponse {
    ticker: string;
    timeframes: Record<string, TrendlineTimeframeResult>;
}

/**
 * Fetch trendlines for given timeframes.
 */
export async function fetchTrendlines(timeframes: number[], barsBack: number = 500): Promise<TrendlineResponse> {
    const response = await fetch(`${API_BASE}/trendlines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ticker: TICKER,
            bars_back: barsBack,
            timeframes,
            only_final: false,
            params: { max_bars: barsBack },
        }),
    });

    if (!response.ok) {
        throw new Error(`Trendlines fetch failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Fetch AI trade setups from trading-daemon.
 * Trading daemon runs on a separate port and serves LLM-generated analysis.
 */
const TRADING_DAEMON_BASE = import.meta.env.VITE_TRADING_DAEMON_BASE || (isLocalhost ? 'http://localhost:8001' : '');

/**
 * Fetch Daemon Status (including active setups).
 */
export async function fetchDaemonStatus(): Promise<DaemonStatus | null> {
    try {
        const response = await fetch(`${TRADING_DAEMON_BASE}/api/status`);
        if (!response.ok) return null;
        return response.json();
    } catch {
        return null;
    }
}

// ==================== INFERENCE API ====================

export interface InferenceStatus {
    status: 'none' | 'running' | 'complete' | 'error';
    result: string | null;
    error: string | null;
    started_at: string | null;
    completed_at: string | null;
    strategy: string | null;
}

export interface AutoInferenceSettings {
    interval: number;
    message?: string;
}

/**
 * Get current inference status from trading-daemon.
 */
export async function getInferenceStatus(): Promise<InferenceStatus | null> {
    try {
        const response = await fetch(`${TRADING_DAEMON_BASE}/api/inference`);
        if (!response.ok) return null;
        return response.json();
    } catch {
        return null;
    }
}

/**
 * Trigger a new inference run.
 * Returns 409 if inference is already running.
 */
export async function triggerInference(strategy: 'main' | 'alt' = 'main'): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(`${TRADING_DAEMON_BASE}/api/inference`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ strategy }),
        });
        if (response.ok) {
            return { success: true };
        }
        const data = await response.json();
        return { success: false, error: data.error || `Failed with status ${response.status}` };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Network error' };
    }
}

/**
 * Get current auto-inference interval setting.
 */
export async function getAutoInferenceInterval(): Promise<number> {
    try {
        const response = await fetch(`${TRADING_DAEMON_BASE}/api/auto-inference`);
        if (!response.ok) return 0;
        const data = await response.json();
        return data.interval || 0;
    } catch {
        return 0;
    }
}

/**
 * Set auto-inference interval.
 * @param interval Interval in seconds (0 = disabled)
 */
export async function setAutoInferenceInterval(interval: number): Promise<AutoInferenceSettings | null> {
    try {
        const response = await fetch(`${TRADING_DAEMON_BASE}/api/auto-inference`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interval }),
        });
        if (!response.ok) return null;
        return response.json();
    } catch {
        return null;
    }
}
