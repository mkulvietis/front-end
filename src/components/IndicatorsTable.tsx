/**
 * Indicators Table Component
 * Displays indicator values across timeframes with semantic comments.
 * Features resizable columns.
 */
import { For, createMemo, createSignal } from 'solid-js';
import { marketData, marketState } from '../stores/market';
import { selectedTimeframes } from '../stores/settings';

// Friendly indicator names
const INDICATOR_LABELS: Record<string, string> = {
    RSI14: 'RSI (14)',
    SMA20: 'SMA (20)',
    EMA20: 'EMA (20)',
    ADX14: 'ADX (14)',
    ATR14: 'ATR (14)',
    VOLUME_SMA20: 'Volume SMA',
    CVD: 'CVD',
    POC: 'POC',
    VWAP: 'VWAP',
    REGIME_ADX14_SMA50: 'Regime',
};

// Column widths state (persisted per session)
const [columnWidths, setColumnWidths] = createSignal<Record<string, number>>({});

// Get list of indicator names from data
function getIndicatorNames(): string[] {
    const data = marketData();
    if (!data?.data) return [];

    const firstTf = Object.keys(data.data)[0];
    if (!firstTf || !data.data[firstTf]?.bars?.[0]?.indicators) return [];

    return Object.keys(data.data[firstTf].bars[0].indicators);
}

// Format indicator value for display
function formatValue(value: number | string | null): string {
    if (value === null) return '—';
    if (typeof value === 'string') return value;
    if (Math.abs(value) >= 1000) return value.toFixed(0);
    if (Math.abs(value) >= 100) return value.toFixed(1);
    return value.toFixed(2);
}

// Get semantic interpretation as a string
function getSemanticText(indicatorName: string): string {
    const state = marketState();
    if (!state?.state) return '';

    // Get semantic from the finest timeframe
    const timeframes = selectedTimeframes();
    const finestTf = `${Math.min(...timeframes)}min`;
    const tfState = state.state[finestTf];
    if (!tfState?.indicators?.[indicatorName]) return '';

    const semantic = tfState.indicators[indicatorName];
    // Combine all semantic properties
    const parts = Object.entries(semantic)
        .map(([_key, val]) => `${val}`)
        .filter(Boolean);

    return parts.join(', ');
}

// Get value for a specific timeframe
function getValueForTimeframe(indicatorName: string, tf: number): string {
    const data = marketData();
    const tfKey = `${tf}min`;
    const bar = data?.data?.[tfKey]?.bars?.[0];
    if (!bar?.indicators?.[indicatorName]) return '—';
    return formatValue(bar.indicators[indicatorName].value);
}

// Resize handler
function handleResizeStart(e: MouseEvent, columnId: string, th: HTMLTableCellElement) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = th.offsetWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
        const diff = moveEvent.clientX - startX;
        const newWidth = Math.max(50, startWidth + diff); // Min width 50px
        setColumnWidths(prev => ({ ...prev, [columnId]: newWidth }));
    };

    const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
}

export default function IndicatorsTable() {
    const timeframes = createMemo(() => selectedTimeframes());
    const indicators = createMemo(() => getIndicatorNames());

    return (
        <div class="indicators-section">
            <h3>Market Indicators</h3>
            <div class="table-wrapper">
                <table class="indicators-table resizable">
                    <thead>
                        <tr>
                            <th
                                style={{ width: columnWidths()['indicator'] ? `${columnWidths()['indicator']}px` : undefined }}
                            >
                                Indicator
                                <span
                                    class="resize-handle"
                                    onMouseDown={(e) => handleResizeStart(e, 'indicator', e.currentTarget.parentElement as HTMLTableCellElement)}
                                />
                            </th>
                            <For each={timeframes()}>
                                {(tf) => {
                                    const colId = `tf-${tf}`;
                                    return (
                                        <th style={{ width: columnWidths()[colId] ? `${columnWidths()[colId]}px` : undefined }}>
                                            {tf >= 60 ? `${tf / 60}h` : `${tf}m`}
                                            <span
                                                class="resize-handle"
                                                onMouseDown={(e) => handleResizeStart(e, colId, e.currentTarget.parentElement as HTMLTableCellElement)}
                                            />
                                        </th>
                                    );
                                }}
                            </For>
                            <th style={{ width: columnWidths()['semantic'] ? `${columnWidths()['semantic']}px` : undefined }}>
                                Semantic
                                <span
                                    class="resize-handle"
                                    onMouseDown={(e) => handleResizeStart(e, 'semantic', e.currentTarget.parentElement as HTMLTableCellElement)}
                                />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={indicators()}>
                            {(ind) => (
                                <tr>
                                    <td class="indicator-name">{INDICATOR_LABELS[ind] || ind}</td>
                                    <For each={timeframes()}>
                                        {(tf) => <td class="indicator-value">{getValueForTimeframe(ind, tf)}</td>}
                                    </For>
                                    <td class="indicator-semantic">{getSemanticText(ind)}</td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
