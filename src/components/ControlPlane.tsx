/**
 * Control Plane Component
 * Shows last update time, local time, and timeframe selection.
 */
import { For, Show, createSignal } from 'solid-js';
import {
    AVAILABLE_TIMEFRAMES,
    toggleTimeframe,
    isTimeframeSelected
} from '../stores/settings';
import { lastUpdate, isLoading, error } from '../stores/market';

// Reactive local time - updates every second
const [localTime, setLocalTime] = createSignal(new Date());
const localTimeInterval = setInterval(() => setLocalTime(new Date()), 1000);

// Cleanup on module unload (hot reload)
if (import.meta.hot) {
    import.meta.hot.dispose(() => clearInterval(localTimeInterval));
}

function formatTime(date: Date | null): string {
    if (!date) return '--:--:--';
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

function formatTimeframeLabel(tf: number): string {
    if (tf >= 60) return `${tf / 60}h`;
    return `${tf}m`;
}

export default function ControlPlane() {
    return (
        <div class="control-plane">
            <div class="control-plane-left">
                <div class="time-display">
                    <span class="label">Last Update:</span>
                    <span class="value">
                        <Show when={!isLoading()} fallback={<span class="loading-dot">⟳</span>}>
                            {formatTime(lastUpdate())}
                        </Show>
                    </span>
                </div>
                <div class="time-display">
                    <span class="label">Local Time:</span>
                    <span class="value">{formatTime(localTime())}</span>
                </div>
                <Show when={error()}>
                    <div class="error-display">
                        <span class="error-icon">⚠</span>
                        <span class="error-text">{error()}</span>
                    </div>
                </Show>
            </div>

            <div class="control-plane-right">
                <span class="label">Timeframes:</span>
                <div class="timeframe-buttons">
                    <For each={AVAILABLE_TIMEFRAMES}>
                        {(tf) => (
                            <button
                                class={`tf-btn ${isTimeframeSelected(tf) ? 'active' : ''}`}
                                onClick={() => toggleTimeframe(tf)}
                            >
                                {formatTimeframeLabel(tf)}
                            </button>
                        )}
                    </For>
                </div>
            </div>
        </div>
    );
}
