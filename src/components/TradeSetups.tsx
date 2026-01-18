/**
 * Trade Setups Component
 * Displays AI-generated trading setups.
 */
import { Show, createMemo } from 'solid-js';
import { tradeSetups } from '../stores/market';

function formatDateTime(isoString: string | undefined): string {
    if (!isoString) return '--';
    try {
        const date = new Date(isoString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    } catch {
        return isoString;
    }
}

interface SetupCardProps {
    type: 'bullish' | 'bearish';
    setup: {
        status: string;
        entry_zone: string;
        stop_loss: number;
        target_1: number;
        target_2: number;
        trigger_condition: string;
    };
}

function SetupCard(props: SetupCardProps) {
    const isBullish = props.type === 'bullish';

    return (
        <div class={`setup-card ${props.type}`}>
            <div class="setup-header">
                <span class="setup-icon">{isBullish ? '📈' : '📉'}</span>
                <span class="setup-title">{isBullish ? 'BULLISH SETUP' : 'BEARISH SETUP'}</span>
                <span class={`setup-status status-${props.setup.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {props.setup.status}
                </span>
            </div>
            <div class="setup-body">
                <div class="setup-row">
                    <span class="setup-label">Entry Zone</span>
                    <span class="setup-value">{props.setup.entry_zone}</span>
                </div>
                <div class="setup-row">
                    <span class="setup-label">Stop Loss</span>
                    <span class="setup-value stop">{props.setup.stop_loss.toFixed(2)}</span>
                </div>
                <div class="setup-row">
                    <span class="setup-label">Targets</span>
                    <span class="setup-value target">
                        T1: {props.setup.target_1.toFixed(2)} | T2: {props.setup.target_2.toFixed(2)}
                    </span>
                </div>
                <div class="setup-trigger">
                    <span class="trigger-label">Trigger:</span> {props.setup.trigger_condition}
                </div>
            </div>
        </div>
    );
}

export default function TradeSetups() {
    const setups = createMemo(() => tradeSetups());

    return (
        <div class="setups-section">
            <div class="setups-header">
                <h3>AI Trade Setups</h3>
                <Show when={setups()}>
                    <span class="setups-updated">
                        Updated: {formatDateTime(setups()!.last_updated)}
                    </span>
                </Show>
            </div>

            <Show when={setups()} fallback={<div class="no-data">No trade setups available</div>}>
                {/* Bias and Rationale */}
                <div class="setups-overview">
                    <div class={`bias-indicator bias-${setups()!.bias.toLowerCase()}`}>
                        <span class="bias-label">Market Bias:</span>
                        <span class="bias-value">{setups()!.bias}</span>
                        <span class="confidence">({setups()!.confidence}/10 confidence)</span>
                    </div>
                    <div class="rationale">
                        {setups()!.rationale}
                    </div>
                </div>

                {/* Setup Cards */}
                <div class="setups-grid">
                    <SetupCard type="bullish" setup={setups()!.bullish_setup} />
                    <SetupCard type="bearish" setup={setups()!.bearish_setup} />
                </div>

                {/* Key Levels */}
                <Show when={setups()?.key_levels}>
                    <div class="key-levels">
                        <div class="levels-row">
                            <span class="levels-label">Support:</span>
                            <span class="levels-values">
                                {setups()!.key_levels!.support.map(l => l.toFixed(2)).join(' | ')}
                            </span>
                        </div>
                        <div class="levels-row">
                            <span class="levels-label">Resistance:</span>
                            <span class="levels-values">
                                {setups()!.key_levels!.resistance.map(l => l.toFixed(2)).join(' | ')}
                            </span>
                        </div>
                    </div>
                </Show>
            </Show>
        </div>
    );
}
