/**
 * TradingView Chart Component
 * Uses lightweight-charts v5 for candlestick display.
 * Supports pattern markers overlay.
 */
import { createSignal, onMount, onCleanup, createEffect, createMemo, For } from 'solid-js';
import { createChart, createSeriesMarkers, CandlestickSeries, HistogramSeries, LineSeries, BaselineSeries, type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type CandlestickData, type Time, type SeriesMarker, type AutoscaleInfo, ColorType } from 'lightweight-charts';
import { chartBars, chartTrendlines, chartOrderBlocks, marketState } from '../stores/market';
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
    let volumeSeries: ISeriesApi<'Histogram'> | undefined;
    let markersPlugin: ISeriesMarkersPluginApi<Time> | undefined;
    let trendlineSeries: ISeriesApi<'Line'>[] = [];
    let obSeries: ISeriesApi<'Baseline'>[] = [];
    let orb60Series: ISeriesApi<'Line'>[] = [];

    const [chartHeight, setChartHeight] = createSignal(Number(localStorage.getItem('obEngineChartHeight')) || 400);

    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    const onResizeStart = (e: MouseEvent) => {
        isResizing = true;
        startY = e.clientY;
        startHeight = chartHeight();
        document.addEventListener('mousemove', onResizeMove);
        document.addEventListener('mouseup', onResizeEnd);
        document.body.style.userSelect = 'none'; // Prevent text selection while dragging
    };

    const onResizeMove = (e: MouseEvent) => {
        if (!isResizing) return;
        requestAnimationFrame(() => {
            const delta = e.clientY - startY;
            const newHeight = Math.max(400, startHeight + delta);
            setChartHeight(newHeight);
            
            // Explicitly resize internal chart canvas
            if (containerRef && chart) {
                chart.applyOptions({ height: newHeight, width: containerRef.clientWidth });
            }
        });
    };

    const onResizeEnd = () => {
        if (!isResizing) return;
        isResizing = false;
        document.removeEventListener('mousemove', onResizeMove);
        document.removeEventListener('mouseup', onResizeEnd);
        document.body.style.userSelect = '';
        
        localStorage.setItem('obEngineChartHeight', chartHeight().toString());
    };

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
            autoSize: true, // Let it adapt fully
        });

        // Set initial height
        chart.applyOptions({ height: chartHeight() });

        // v5 API: use chart.addSeries with series type
        candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderDownColor: '#ef5350',
            borderUpColor: '#26a69a',
            wickDownColor: '#ef5350',
            wickUpColor: '#26a69a',
            autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
                const res = original();
                const bars = chartBars();
                if (!chart || bars.length === 0) return res;

                const logicalRange = chart.timeScale().getVisibleLogicalRange();
                if (logicalRange) {
                    const from = Math.max(0, Math.floor(logicalRange.from));
                    const to = Math.min(bars.length - 1, Math.ceil(logicalRange.to));
                    let min = Infinity;
                    let max = -Infinity;

                    for (let i = from; i <= to; i++) {
                        if (bars[i]) {
                            if (bars[i].low < min) min = bars[i].low;
                            if (bars[i].high > max) max = bars[i].high;
                        }
                    }

                    if (min !== Infinity && max !== -Infinity) {
                        return {
                            priceRange: {
                                minValue: min,
                                maxValue: max,
                            },
                        };
                    }
                }
                return res;
            },
        });

        // Volume histogram at the bottom with separate price scale
        volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });

        // Configure volume price scale
        chart.priceScale('volume').applyOptions({
            scaleMargins: {
                top: 0.85, // Volume occupies bottom 15% of chart
                bottom: 0,
            },
            borderVisible: false,
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

    // Track whether initial range has been set for the current timeframe
    let initialRangeSet = false;

    createEffect(() => {
        chartTimeframe(); // Subscribe to timeframe changes to reset focus
        initialRangeSet = false;
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

            // Set volume data with colors based on candle direction
            if (volumeSeries) {
                const volumeData = bars.map(bar => ({
                    time: bar.time as Time,
                    value: bar.volume || 0,
                    color: bar.close >= bar.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
                }));
                volumeSeries.setData(volumeData);
            }

            // Set initial visible focus range (most recent ~100 bars) on initial load or timeframe switch
            if (!initialRangeSet && chart) {
                const defaultVisibleBars = 100;
                const fromIndex = Math.max(0, bars.length - defaultVisibleBars);
                const toIndex = bars.length + 3;
                chart.timeScale().setVisibleLogicalRange({
                    from: fromIndex,
                    to: toIndex,
                });
                chart.priceScale('right').applyOptions({ autoScale: true });
                initialRangeSet = true;
            }
        }
    });

    // Draw trendlines when data changes
    createEffect(() => {
        const tfResult = chartTrendlines();
        const bars = chartBars();
        if (!chart) return;

        // Remove previous trendline series
        for (const s of trendlineSeries) {
            chart.removeSeries(s);
        }
        trendlineSeries = [];

        if (!tfResult || tfResult.trendlines.length === 0 || bars.length === 0) return;

        const localOffsetSeconds = new Date().getTimezoneOffset() * -60;

        for (const tl of tfResult.trendlines) {
            let startIdx = tl.anchor_pivot.index;
            if (tl.anchor_pivot.bar_datetime) {
                const pivotTimeSecs = new Date(tl.anchor_pivot.bar_datetime).getTime() / 1000 + localOffsetSeconds;
                const foundIdx = bars.findIndex(b => Math.abs(b.time - pivotTimeSecs) < 1);
                if (foundIdx !== -1) {
                    startIdx = foundIdx;
                }
            }

            if (startIdx < 0 || startIdx >= bars.length) continue;

            const color = tl.type === 'resistance' ? '#ef5350' : '#26a69a';

            const series = chart.addSeries(LineSeries, {
                color,
                lineWidth: 2,
                lineStyle: 2, // Dashed
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
                // Exclude trendlines from auto-scaling so they never push the
                // chart's price axis to fit them — only candles set the scale.
                autoscaleInfoProvider: () => null,
            });

            // Plot a point per bar so the line follows chart spacing through time gaps
            const points: { time: Time; value: number }[] = [];
            for (let j = startIdx; j < bars.length; j++) {
                const i = tl.anchor_pivot.index + (j - startIdx);
                points.push({
                    time: bars[j].time as Time,
                    value: tl.slope * i + tl.intercept,
                });
            }

            // Extend 5 bars into future
            const intervalSeconds = chartTimeframe() * 60;
            const lastBarTime = bars[bars.length - 1].time as number;

            for (let k = 1; k <= 5; k++) {
                const futureIdx = tl.anchor_pivot.index + (bars.length - 1 - startIdx) + k;
                points.push({
                    time: (lastBarTime + (k * intervalSeconds)) as Time,
                    value: tl.slope * futureIdx + tl.intercept,
                });
            }

            series.setData(points);

            trendlineSeries.push(series);
        }
    });

    // Draw Order Block zones
    createEffect(() => {
        const obs = chartOrderBlocks();
        const bars = chartBars();
        if (!chart) return;

        // Remove previous OB series
        for (const s of obSeries) {
            chart.removeSeries(s);
        }
        obSeries = [];

        if (obs.length === 0 || bars.length === 0) return;

        const localOffsetSeconds = new Date().getTimezoneOffset() * -60;

        for (const ob of obs) {
            // Find the robust starting index by mapping the exact datetime
            let startIdx = ob.origin_index;
            if (ob.origin_datetime) {
                const obTimeSecs = new Date(ob.origin_datetime).getTime() / 1000 + localOffsetSeconds;
                const foundIdx = bars.findIndex(b => Math.abs(b.time - obTimeSecs) < 1);
                if (foundIdx !== -1) {
                    startIdx = foundIdx;
                }
            }
            
            if (startIdx < 0 || startIdx >= bars.length) continue;

            const isBullish = ob.type === 'bullish';
            const baseColor = isBullish ? '38, 166, 154' : '239, 83, 80';
            const alpha = ob.mitigated ? 0.3 : 0.6;

            // Draw a single filled BaselineSeries to represent the OB zone block
            const series = chart.addSeries(BaselineSeries, {
                baseValue: { type: 'price', price: ob.low },
                topFillColor1: `rgba(${baseColor}, ${alpha})`,
                topFillColor2: `rgba(${baseColor}, ${alpha})`,
                topLineColor: `rgba(${baseColor}, ${Math.min(1, alpha + 0.3)})`,
                bottomFillColor1: 'transparent',
                bottomFillColor2: 'transparent',
                bottomLineColor: `rgba(${baseColor}, ${Math.min(1, alpha + 0.3)})`,
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
                autoscaleInfoProvider: () => null,
            });

            const points: { time: Time; value: number }[] = [];
            for (let i = startIdx; i < bars.length; i++) {
                points.push({ time: bars[i].time as Time, value: ob.high });
            }

            // Extend 3 bars into the future
            const intervalSeconds = chartTimeframe() * 60;
            const lastBarTime = bars[bars.length - 1].time as number;
            for (let k = 1; k <= 3; k++) {
                points.push({
                    time: (lastBarTime + (k * intervalSeconds)) as Time,
                    value: ob.high,
                });
            }

            series.setData(points);
            obSeries.push(series);
        }
    });

    // Draw ORB60 lines when available
    createEffect(() => {
        const state = marketState();
        const orb60 = state?.session?.ORB60;
        const bars = chartBars();

        if (!chart) return;

        // Remove existing ORB60 series
        for (const s of orb60Series) {
            chart.removeSeries(s);
        }
        orb60Series = [];

        if (orb60 && bars.length > 0) {
            const firstTime = bars[0].time as Time;
            const lastTime = bars[bars.length - 1].time as Time;

            const highSeries = chart.addSeries(LineSeries, {
                color: '#ff9800',
                lineWidth: 2,
                lineStyle: 2, // Dashed
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
                autoscaleInfoProvider: () => null,
            });
            highSeries.setData([
                { time: firstTime, value: orb60.high },
                { time: lastTime, value: orb60.high },
            ]);
            orb60Series.push(highSeries);

            const lowSeries = chart.addSeries(LineSeries, {
                color: '#ff9800',
                lineWidth: 2,
                lineStyle: 2, // Dashed
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
                autoscaleInfoProvider: () => null,
            });
            lowSeries.setData([
                { time: firstTime, value: orb60.low },
                { time: lastTime, value: orb60.low },
            ]);
            orb60Series.push(lowSeries);
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
                <div style={{ display: 'flex', 'align-items': 'center', gap: '16px' }}>
                    <span class="chart-title">@ES</span>
                </div>
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
            <div 
                ref={containerRef} 
                class="chart-canvas" 
                style={{ height: `${chartHeight()}px` }}
            />
            <div class="chart-resizer" onMouseDown={onResizeStart} title="Drag to resize chart vertically" />
        </div>
    );
}
