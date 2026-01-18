/**
 * Pivot Points Component
 * Displays pivot levels with user-friendly labels.
 */
import { Show, createMemo } from 'solid-js';
import { marketState } from '../stores/market';

// User-friendly pivot level names
const LEVEL_LABELS: Record<string, string> = {
    pp: 'Pivot Point (PP)',
    tc: 'Top Central (TC)',
    bc: 'Bottom Central (BC)',
    r1: 'Resistance 1 (R1)',
    r2: 'Resistance 2 (R2)',
    r3: 'Resistance 3 (R3)',
    r4: 'Resistance 4 (R4)',
    s1: 'Support 1 (S1)',
    s2: 'Support 2 (S2)',
    s3: 'Support 3 (S3)',
    s4: 'Support 4 (S4)',
    h3: 'Camarilla H3',
    h4: 'Camarilla H4',
    l3: 'Camarilla L3',
    l4: 'Camarilla L4',
};

function getLevelLabel(rawId: string): string {
    return LEVEL_LABELS[rawId.toLowerCase()] || rawId;
}

export default function PivotPoints() {
    const pivots = createMemo(() => marketState()?.pivots);
    const latestPrice = createMemo(() => marketState()?.latest_price);

    return (
        <div class="pivots-section">
            <h4>Pivot Points</h4>
            <Show
                when={pivots()}
                fallback={<div class="no-data">No pivot data available</div>}
            >
                <div class="pivots-content">
                    {/* Structural Bias */}
                    <Show when={pivots()?.structural_bias}>
                        <div class="pivot-row">
                            <span class="pivot-label">Structural Bias</span>
                            <span class={`pivot-value bias-${pivots()!.structural_bias!.bias_direction.toLowerCase()}`}>
                                {pivots()!.structural_bias!.bias_direction}
                            </span>
                        </div>
                        <div class="pivot-row">
                            <span class="pivot-label">CPR Relationship</span>
                            <span class="pivot-value">
                                {pivots()!.structural_bias!.cpr_relationship.replace(/_/g, ' ')}
                            </span>
                        </div>
                    </Show>

                    {/* Active Zone */}
                    <Show when={pivots()?.active_zone}>
                        <div class="pivot-divider" />
                        <div class="pivot-row">
                            <span class="pivot-label">Active Zone</span>
                            <span class="pivot-value" />
                        </div>
                        <Show when={pivots()?.active_zone?.floor_level}>
                            <div class="pivot-row indent">
                                <span class="pivot-label">
                                    Floor: {getLevelLabel(pivots()!.active_zone!.floor_level!.raw_id)}
                                </span>
                                <span class="pivot-value">
                                    {pivots()!.active_zone!.floor_level!.price.toFixed(2)}
                                </span>
                            </div>
                        </Show>
                        <Show when={pivots()?.active_zone?.ceiling_level}>
                            <div class="pivot-row indent">
                                <span class="pivot-label">
                                    Ceiling: {getLevelLabel(pivots()!.active_zone!.ceiling_level!.raw_id)}
                                </span>
                                <span class="pivot-value">
                                    {pivots()!.active_zone!.ceiling_level!.price.toFixed(2)}
                                </span>
                            </div>
                        </Show>
                    </Show>

                    {/* Current Price for reference */}
                    <Show when={latestPrice()}>
                        <div class="pivot-divider" />
                        <div class="pivot-row highlight">
                            <span class="pivot-label">Current Price</span>
                            <span class="pivot-value">{latestPrice()!.toFixed(2)}</span>
                        </div>
                    </Show>
                </div>
            </Show>
        </div>
    );
}
