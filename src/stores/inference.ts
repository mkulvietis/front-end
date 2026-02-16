/**
 * Inference Store
 * Manages inference state and trade setups from trading-daemon.
 */
import { createSignal } from 'solid-js';
import {
    triggerInference,
    getAutoInferenceInterval,
    setAutoInferenceInterval as apiSetAutoInferenceInterval,
    fetchDaemonStatus,
    type DaemonStatus,
    type TradeSetup,
} from '../api/client';

// Default auto-inference interval in minutes (10 minutes)
const DEFAULT_AUTO_INTERVAL_MINUTES = 10;

// Reactive signals
const [daemonStatus, setDaemonStatus] = createSignal<DaemonStatus | null>(null);
const [activeSetups, setActiveSetups] = createSignal<TradeSetup[]>([]);
const [autoIntervalMinutes, setAutoIntervalMinutes] = createSignal<number>(DEFAULT_AUTO_INTERVAL_MINUTES);
const [isRunningInference, setIsRunningInference] = createSignal(false);

// Polling interval
let statusPollIntervalId: number | undefined;

/**
 * Poll daemon status.
 */
async function pollDaemonStatus(): Promise<void> {
    const status = await fetchDaemonStatus();
    if (status) {
        setDaemonStatus(status);
        setActiveSetups(status.active_setups || []);

        // Update inference running state if we can infer it, 
        // or we might need to keep fetching /api/inference if /api/status doesn't have detailed inference state?
        // DaemonState has `inference` field (InferenceState) in Python, let's make sure it's in the snapshot.
        // In python state.py: `get_snapshot` returns `is_running`, `last_output`... 
        // It DOES NOT return `inference` object in `get_snapshot`. 
        // It returns `active_setups`.
        // So we still need /api/inference for detailed inference status (like error message, result text)?
        // Or we should add `inference` to `get_snapshot`.
        // For now, let's keep polling `getInferenceStatus` if we need that detail, OR merge them.
        // User wants "Table / inference control refreshed every 1s".

        // Let's assume we use /api/inference for the control plane status
        // AND /api/status for trades? That's 2 calls.
        // Optimization: Add `inference` to `/api/status` snapshot in backend? 
        // Too late to go back to backend easily without context switching.
        // Let's just call both or assume `fetchDaemonStatus` is enough for setups.
    }
}

// We also need `getInferenceStatus` for the control plane to show "Running", "Error", etc.
import { getInferenceStatus, type InferenceStatus } from '../api/client';
const [inferenceStatus, setInferenceStatus] = createSignal<InferenceStatus | null>(null);

async function pollAll(): Promise<void> {
    await Promise.all([
        pollDaemonStatus(),
        (async () => {
            const status = await getInferenceStatus();
            if (status) {
                setInferenceStatus(status);
                setIsRunningInference(status.status === 'running');
            }
        })()
    ]);
}

/**
 * Start polling.
 */
export function startInferencePolling(): void {
    pollAll(); // Initial fetch
    statusPollIntervalId = window.setInterval(pollAll, 1000); // Poll every 1s
}

/**
 * Stop polling.
 */
export function stopInferencePolling(): void {
    if (statusPollIntervalId) {
        clearInterval(statusPollIntervalId);
        statusPollIntervalId = undefined;
    }
}

/**
 * Trigger inference manually.
 */
export async function runInference(strategy: 'main' | 'alt' = 'main'): Promise<{ success: boolean; error?: string }> {
    if (isRunningInference()) {
        return { success: false, error: 'Inference already running' };
    }

    setIsRunningInference(true);
    const result = await triggerInference(strategy);

    if (!result.success) {
        setIsRunningInference(false);
    }
    // On success, polling will update the status
    return result;
}

/**
 * Load current auto-inference setting from daemon.
 */
export async function loadAutoInferenceSettings(): Promise<void> {
    const intervalSeconds = await getAutoInferenceInterval();
    // Convert seconds to minutes, default to 10 if 0
    const minutes = intervalSeconds > 0 ? Math.round(intervalSeconds / 60) : DEFAULT_AUTO_INTERVAL_MINUTES;
    setAutoIntervalMinutes(minutes);
}

/**
 * Update auto-inference interval.
 * @param minutes Interval in minutes (0 = disabled)
 */
export async function updateAutoInferenceInterval(minutes: number): Promise<boolean> {
    const intervalSeconds = minutes * 60;
    const result = await apiSetAutoInferenceInterval(intervalSeconds);
    if (result) {
        setAutoIntervalMinutes(minutes);
        return true;
    }
    return false;
}

export {
    inferenceStatus,
    daemonStatus,
    activeSetups,
    autoIntervalMinutes,
    isRunningInference,
    DEFAULT_AUTO_INTERVAL_MINUTES,
};
