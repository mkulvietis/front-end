/**
 * TradingView Chart Component
 * Uses lightweight-charts v5 for candlestick display.
 */
import { onMount, onCleanup, createEffect } from 'solid-js';
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi, type CandlestickData, type Time, ColorType } from 'lightweight-charts';
import { chartBars } from '../stores/market';

export default function Chart() {
    let containerRef: HTMLDivElement | undefined;
    let chart: IChartApi | undefined;
    let candleSeries: ISeriesApi<'Candlestick'> | undefined;

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

        // Handle resize
        const resizeObserver = new ResizeObserver(entries => {
            if (chart && entries.length > 0) {
                const { width, height } = entries[0].contentRect;
                chart.applyOptions({ width, height });
            }
        });

        resizeObserver.observe(containerRef);

        onCleanup(() => {
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

    return (
        <div class="chart-container">
            <div class="chart-header">
                <span class="chart-title">@ES - E-mini S&P 500</span>
            </div>
            <div ref={containerRef} class="chart-canvas" />
        </div>
    );
}
