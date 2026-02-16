/**
 * Trendlines Component
 * Displays trendlines and price relations for all timeframes.
 */
import { createSignal, createResource, For, Show } from 'solid-js';
import { fetchTrendlines } from '../api/client';
import type { PriceRelation } from '../api/client';
import './Trendlines.css';

const TIMEFRAMES = [1, 5, 30, 120];

function tfLabel(tf: number): string {
    if (tf >= 60) return `${tf / 60}h`;
    return `${tf}m`;
}

function formatPrice(price: number): string {
    return price.toFixed(2);
}

function formatPivotTime(pivot: { bar_datetime?: string }): string {
    if (!pivot.bar_datetime) return '--';
    const d = new Date(pivot.bar_datetime);
    return d.toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
}

export default function Trendlines() {
    const [refreshKey, setRefreshKey] = createSignal(0);

    const [data] = createResource(
        () => refreshKey(),
        async () => {
            return fetchTrendlines(TIMEFRAMES);
        }
    );

    const handleRefresh = () => {
        setRefreshKey(k => k + 1);
    };

    return (
        <div class="trendlines-container">
            <div class="trendlines-header">
                <h3>Trendlines</h3>
                <button
                    class="trendlines-refresh-btn"
                    onClick={handleRefresh}
                    disabled={data.loading}
                >
                    {data.loading ? '⟳ Loading...' : '⟳ Refresh'}
                </button>
            </div>

            <Show when={data.error}>
                <div class="trendlines-error">
                    Failed to load trendlines: {String(data.error)}
                </div>
            </Show>

            <Show when={data.loading && !data()}>
                <div class="trendlines-loading">Loading trendlines...</div>
            </Show>

            <Show when={data()}>
                <For each={TIMEFRAMES}>
                    {(tf) => {
                        const tfKey = `${tf}min`;
                        const result = () => data()!.timeframes[tfKey];
                        const trendlines = () => result()?.trendlines ?? [];
                        const relations = () => result()?.price_relations ?? [];

                        // Build a lookup: trendline index -> price relation
                        const relationMap = () => {
                            const m = new Map<number, PriceRelation>();
                            for (const r of relations()) {
                                m.set(r.trendline_index, r);
                            }
                            return m;
                        };

                        return (
                            <div class="tf-group">
                                <div class="tf-group-header">
                                    <span class="tf-group-label">{tfLabel(tf)} Timeframe</span>
                                    <span class="tf-group-count">{trendlines().length} trendline(s)</span>
                                </div>

                                <Show when={trendlines().length === 0}>
                                    <div class="tf-group-empty">No trendlines detected</div>
                                </Show>

                                <Show when={trendlines().length > 0}>
                                    <table class="trendlines-table">
                                        <thead>
                                            <tr>
                                                <th>Type</th>
                                                <th>Anchor</th>
                                                <th>2nd Pivot</th>
                                                <th>Touches</th>
                                                <th>Score</th>
                                                <th>Line Price</th>
                                                <th>Proximity</th>
                                                <th>Distance</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <For each={trendlines()}>
                                                {(tl, idx) => {
                                                    const rel = () => relationMap().get(idx());
                                                    return (
                                                        <tr>
                                                            <td>
                                                                <span class={`tl-type ${tl.type}`}>{tl.type}</span>
                                                                <Show when={tl.is_regression}>
                                                                    <span class="tl-regression">REG</span>
                                                                </Show>
                                                            </td>
                                                            <td class="tl-price" title={formatPivotTime(tl.anchor_pivot)}>
                                                                {formatPrice(tl.anchor_pivot.price)}
                                                            </td>
                                                            <td class="tl-price" title={formatPivotTime(tl.second_pivot)}>
                                                                {formatPrice(tl.second_pivot.price)}
                                                            </td>
                                                            <td class="tl-touches">{tl.touch_count}</td>
                                                            <td class="tl-score">{tl.score.toFixed(1)}</td>
                                                            <td class="tl-price">
                                                                {rel() ? formatPrice(rel()!.line_price) : '--'}
                                                            </td>
                                                            <td>
                                                                <Show when={rel()} fallback="--">
                                                                    <span class={`proximity-badge proximity-${rel()!.proximity}`}>
                                                                        {rel()!.proximity}
                                                                    </span>
                                                                </Show>
                                                            </td>
                                                            <td class="tl-distance">
                                                                <Show when={rel()} fallback="--">
                                                                    {rel()!.distance_pct > 0 ? '+' : ''}{(rel()!.distance_pct * 100).toFixed(3)}%
                                                                    ({rel()!.distance_atr.toFixed(2)} ATR)
                                                                </Show>
                                                            </td>
                                                        </tr>
                                                    );
                                                }}
                                            </For>
                                        </tbody>
                                    </table>
                                </Show>
                            </div>
                        );
                    }}
                </For>
            </Show>
        </div>
    );
}
