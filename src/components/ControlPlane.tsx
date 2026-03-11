/**
 * Control Plane Component
 * Shows last update time, local time, timeframe selection,
 * and inference controls.
 */
import { For, Show, createSignal, onMount, onCleanup } from 'solid-js';
import {
    AVAILABLE_TIMEFRAMES,
    toggleTimeframe,
    isTimeframeSelected
} from '../stores/settings';
import { lastUpdate, isLoading, error } from '../stores/market';
import {
    inferenceStatus,
    autoIntervalMinutes,
    isRunningInference,
    runInference,
    updateAutoInferenceInterval,
    loadAutoInferenceSettings,
    DEFAULT_AUTO_INTERVAL_MINUTES,
} from '../stores/inference';

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
    const [intervalInput, setIntervalInput] = createSignal(DEFAULT_AUTO_INTERVAL_MINUTES);
    const [inferenceError, setInferenceError] = createSignal<string | null>(null);

    onMount(() => {
        // startInferencePolling() is managed in App.tsx
        loadAutoInferenceSettings().then(() => {
            setIntervalInput(autoIntervalMinutes());
        });
    });

    onCleanup(() => {
        // stopInferencePolling() is managed in App.tsx
    });

    async function handleRunInference(strategy: 'main' | 'alt' = 'main') {
        setInferenceError(null);
        const result = await runInference(strategy);
        if (!result.success && result.error) {
            setInferenceError(result.error);
            // Auto-clear error after 5 seconds
            setTimeout(() => setInferenceError(null), 5000);
        }
    }

    async function handleUpdateInterval() {
        const minutes = intervalInput();
        await updateAutoInferenceInterval(minutes);
    }

    function getStatusBadgeClass(): string {
        const status = inferenceStatus()?.status;
        switch (status) {
            case 'running': return 'status-badge running';
            case 'complete': return 'status-badge complete';
            case 'error': return 'status-badge error';
            default: return 'status-badge idle';
        }
    }

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

            {/* Inference Controls */}
            <div class="control-plane-center">
                <div class="inference-controls">
                    <button
                        class={`run-inference-btn ${isRunningInference() ? 'running' : ''}`}
                        onClick={() => handleRunInference('main')}
                        disabled={isRunningInference()}
                    >
                        <Show when={isRunningInference() && inferenceStatus()?.strategy === 'main'} fallback={<>▶ Run</>}>
                            <span class="loading-dot">⟳</span> Running...
                        </Show>
                    </button>

                    <button
                        class={`run-inference-btn run-alt ${isRunningInference() ? 'running' : ''}`}
                        onClick={() => handleRunInference('alt')}
                        disabled={isRunningInference()}
                    >
                        <Show when={isRunningInference() && inferenceStatus()?.strategy === 'alt'} fallback={<>⚡ Run Alt</>}>
                            <span class="loading-dot">⟳</span> Running...
                        </Show>
                    </button>

                    <div class="auto-inference-control">
                        <label class="label">Auto Update:</label>
                        <input
                            type="number"
                            class="interval-input"
                            min="0"
                            max="120"
                            value={intervalInput()}
                            onInput={(e) => setIntervalInput(parseInt(e.currentTarget.value) || 0)}
                        />
                        <span class="label">min</span>
                        <button class="set-interval-btn" onClick={handleUpdateInterval}>
                            Set
                        </button>
                    </div>

                    <div class={getStatusBadgeClass()}>
                        {inferenceStatus()?.status?.toUpperCase() || 'IDLE'}
                    </div>
                </div>

                <Show when={inferenceError() || (inferenceStatus()?.status === 'error' && inferenceStatus()?.error)}>
                    <div class="inference-error">
                        <span class="error-icon">⚠</span>
                        <span>{inferenceError() || inferenceStatus()?.error}</span>
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

