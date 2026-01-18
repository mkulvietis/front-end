/**
 * TradingView Chart Component
 * Uses lightweight-charts v5 for candlestick display.
 * Supports pattern markers overlay.
 */
import { onMount, onCleanup, createEffect, createMemo, For } from 'solid-js';
import { createChart, createSeriesMarkers, CandlestickSeries, type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type CandlestickData, type Time, type SeriesMarker, ColorType } from 'lightweight-charts';
import { chartBars } from '../stores/market';
import { visiblePatterns, allPatterns } from './PatternsTable';
import { chartTimeframe, setChartTimeframe, CHART_TIMEFRAMES } from '../stores/settings';


/**
 * Convert yyyymmdd + hhmm (in NY timezone) to display timestamp (seconds).
 * Matches the chart bar timestamp format for correct marker placement.
 */
function patternToTimestamp(yyyymmdd: number, hhmm: number): number {
    const year = Math.floor(yyyymmdd / 10000);
    const month = Math.floor((yyyymmdd % 10000) / 100) - 1; // 0-indexed
    const day = yyyymmdd % 100;
    const hour = Math.floor(hhmm / 100);
    const minute = hhmm % 100;

    // Calculate NY timezone offset for this date (handles DST)
    const testDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
    const nyStr = testDate.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const utcStr = testDate.toLocaleString('en-US', { timeZone: 'UTC' });
    const nyOffsetMs = new Date(utcStr).getTime() - new Date(nyStr).getTime();

    // Treat the input as NY time: first create as if UTC, then add NY offset to get true UTC
    const asUtcMs = Date.UTC(year, month, day, hour, minute, 0);
    const trueUtcMs = asUtcMs + nyOffsetMs;

    // Add local offset for display (same offset applied to chart bars)
    const localOffsetMs = new Date().getTimezoneOffset() * -60 * 1000;

    return Math.floor((trueUtcMs + localOffsetMs) / 1000);
}

/**
 * Format pattern name for display.
 */
function formatPatternName(name: string): string {
    return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export default function Chart() {
    let containerRef: HTMLDivElement | undefined;
    let chart: IChartApi | undefined;
    let candleSeries: ISeriesApi<'Candlestick'> | undefined;
    let markersPlugin: ISeriesMarkersPluginApi<Time> | undefined;

    onMount(() => {
        if (!containerRef) return;

        chart = createChart(containerRef, {
            layout: {
                background: { type: ColorType.Solid, color: '#1a1a2e' },
                textColor: '#d1d4dc',
            },
            grid: {
                vertLines: { color: '#2a2a4a' },
                horzLines: { color: '#2a2a4a' },
            },
            crosshair: {
                mode: 1,
            },
            rightPriceScale: {
                borderColor: '#2a2a4a',
            },
            timeScale: {
                borderColor: '#2a2a4a',
                timeVisible: true,
                secondsVisible: false,
            },
        });

        // v5 API: use chart.addSeries with series type
        candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderDownColor: '#ef5350',
            borderUpColor: '#26a69a',
            wickDownColor: '#ef5350',
            wickUpColor: '#26a69a',
        });

        // Create markers plugin for pattern annotations (v5 API)
        markersPlugin = createSeriesMarkers(candleSeries, []);

        // Handle resize
        const resizeObserver = new ResizeObserver(entries => {
            if (chart && entries.length > 0) {
                const { width, height } = entries[0].contentRect;
                chart.applyOptions({ width, height });
            }
        });

        resizeObserver.observe(containerRef);

        onCleanup(() => {
            markersPlugin?.detach();
            resizeObserver.disconnect();
            chart?.remove();
        });
    });

    // Update chart data when bars change
    createEffect(() => {
        const bars = chartBars();
        if (candleSeries && bars.length > 0) {
            // Convert to proper CandlestickData type
            const candleData: CandlestickData<Time>[] = bars.map(bar => ({
                time: bar.time as Time,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
            }));
            candleSeries.setData(candleData);
        }
    });

    // Compute markers for visible patterns
    const patternMarkers = createMemo((): SeriesMarker<Time>[] => {
        const visible = visiblePatterns();
        const patterns = allPatterns();
        const currentChartTf = chartTimeframe();

        if (visible.size === 0 || patterns.length === 0) return [];

        const markers: SeriesMarker<Time>[] = [];

        for (const p of patterns) {
            const key = `${p.name}-${p.timeframe}`;
            if (!visible.has(key)) continue;

            // Only show markers for patterns matching chart timeframe
            if (p.timeframeMinutes !== currentChartTf) continue;

            const timestamp = patternToTimestamp(p.yyyymmdd, p.hhmm);
            const isBullish = p.classification.toLowerCase() === 'bullish';

            markers.push({
                time: timestamp as Time,
                position: isBullish ? 'belowBar' : 'aboveBar',
                color: isBullish ? '#26a69a' : '#ef5350',
                shape: isBullish ? 'arrowUp' : 'arrowDown',
                text: formatPatternName(p.name),
            });
        }

        // Sort markers by time (required by lightweight-charts)
        markers.sort((a, b) => (a.time as number) - (b.time as number));

        return markers;
    });

    // Update markers when visibility changes
    createEffect(() => {
        const markers = patternMarkers();
        if (markersPlugin) {
            markersPlugin.setMarkers(markers);
        }
    });

    /**
     * Format timeframe for display.
     */
    function formatTimeframe(tf: number): string {
        if (tf >= 60) return `${tf / 60}H`;
        return `${tf}m`;
    }

    return (
        <div class="chart-container">
            <div class="chart-header">
                <span class="chart-title">@ES - E-mini S&P 500</span>
                <div class="chart-timeframe-selector">
                    <For each={[...CHART_TIMEFRAMES]}>
                        {(tf) => (
                            <button
                                class={`chart-tf-btn ${chartTimeframe() === tf ? 'active' : ''}`}
                                onClick={() => setChartTimeframe(tf)}
                            >
                                {formatTimeframe(tf)}
                            </button>
                        )}
                    </For>
                </div>
            </div>
            <div ref={containerRef} class="chart-canvas" />
        </div>
    );
}


