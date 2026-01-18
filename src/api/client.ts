/**
 * API Client for Data Service
 * Provides typed fetch wrappers for all market data endpoints.
 */

// Use environment variable for API base URL, fallback to localhost for development
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
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

export interface TradeSetup {
    status: string;
    entry_zone: string;
    stop_loss: number;
    target_1: number;
    target_2: number;
    trigger_condition: string;
}

export interface TradeSetupsResponse {
    last_updated: string;
    bias: string;
    confidence: number;
    rationale: string;
    bullish_setup: TradeSetup;
    bearish_setup: TradeSetup;
    key_levels?: {
        support: number[];
        resistance: number[];
    };
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
    return bars.map((bar: any) => ({
        time: new Date(bar.bar_datetime).getTime() / 1000,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
    }));
}

/**
 * Fetch AI trade setups from trading-daemon.
 * Trading daemon runs on a separate port and serves LLM-generated analysis.
 */
const TRADING_DAEMON_BASE = import.meta.env.VITE_TRADING_DAEMON_BASE || 'http://localhost:8001';

export async function fetchTradeSetups(): Promise<TradeSetupsResponse | null> {
    try {
        const response = await fetch(`${TRADING_DAEMON_BASE}/api/trade_setups`);
        if (!response.ok) return null;
        return response.json();
    } catch {
        return null;
    }
}
