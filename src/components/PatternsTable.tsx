/**
 * Patterns Table Component
 * Displays candlestick patterns with "show on chart" checkbox.
 */
import { For, Show, createMemo, createSignal } from 'solid-js';
import { marketData } from '../stores/market';
import { selectedTimeframes } from '../stores/settings';

interface PatternInfo {
    name: string;
    classification: string;
    timeframe: string;
}

// Track which patterns to show on chart
const [visiblePatterns, setVisiblePatterns] = createSignal<Set<string>>(new Set());

function togglePattern(patternKey: string) {
    setVisiblePatterns(prev => {
        const next = new Set(prev);
        if (next.has(patternKey)) {
            next.delete(patternKey);
        } else {
            next.add(patternKey);
        }
        return next;
    });
}

// Friendly pattern names
function formatPatternName(name: string): string {
    return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Classification badge class
function getClassBadge(classification: string): string {
    switch (classification.toLowerCase()) {
        case 'bullish': return 'badge-bullish';
        case 'bearish': return 'badge-bearish';
        default: return 'badge-neutral';
    }
}

export default function PatternsTable() {
    // Collect all patterns from all timeframes
    const patterns = createMemo((): PatternInfo[] => {
        const data = marketData();
        if (!data?.data) return [];

        const result: PatternInfo[] = [];
        const timeframes = selectedTimeframes();

        for (const tf of timeframes) {
            const tfKey = `${tf}min`;
            const bar = data.data[tfKey]?.bars?.[0];
            if (bar?.patterns) {
                for (const p of bar.patterns) {
                    result.push({
                        name: p.name,
                        classification: p.classification,
                        timeframe: tf >= 60 ? `${tf / 60}h` : `${tf}m`,
                    });
                }
            }
        }

        return result;
    });

    return (
        <div class="patterns-section">
            <h4>Candlestick Patterns</h4>
            <Show
                when={patterns().length > 0}
                fallback={<div class="no-patterns">No patterns detected</div>}
            >
                <div class="patterns-list">
                    <For each={patterns()}>
                        {(p) => {
                            const key = `${p.name}-${p.timeframe}`;
                            return (
                                <div class="pattern-item">
                                    <label class="pattern-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={visiblePatterns().has(key)}
                                            onChange={() => togglePattern(key)}
                                        />
                                        <span class="checkmark" />
                                    </label>
                                    <span class={`pattern-badge ${getClassBadge(p.classification)}`}>
                                        {formatPatternName(p.name)}
                                    </span>
                                    <span class="pattern-tf">({p.timeframe})</span>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </Show>
        </div>
    );
}

export { visiblePatterns };
