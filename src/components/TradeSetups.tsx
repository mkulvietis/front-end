/**
 * Trade Setups Component
 * Displays AI-generated trading setups in a table with detailed rules view.
 */
import { createSignal, createEffect, onCleanup, Show, For } from 'solid-js';
import { activeSetups, daemonStatus } from '../stores/inference';
import './TradeSetups.css';

function formatTime(isoString: string): string {
    if (!isoString) return '--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const DEFAULT_WIDTHS = {
    status: 100,
    time: 80,
    symbol: 80,
    side: 60,
    entry: 80,
    target: 80
};

export default function TradeSetups() {
    const [selectedId, setSelectedId] = createSignal<string | null>(null);

    // Initialize widths from localStorage or defaults
    const [colWidths, setColWidths] = createSignal<typeof DEFAULT_WIDTHS>(
        (() => {
            try {
                const saved = localStorage.getItem('trade_setup_col_widths');
                return saved ? { ...DEFAULT_WIDTHS, ...JSON.parse(saved) } : DEFAULT_WIDTHS;
            } catch {
                return DEFAULT_WIDTHS;
            }
        })()
    );

    // Save to localStorage whenever widths change
    createEffect(() => {
        localStorage.setItem('trade_setup_col_widths', JSON.stringify(colWidths()));
    });

    const selectedSetup = () => activeSetups().find(s => s.id === selectedId());

    const handleRowClick = (id: string) => {
        if (selectedId() === id) {
            setSelectedId(null);
        } else {
            setSelectedId(id);
        }
    };

    // Resizing Logic
    const [resizingCol, setResizingCol] = createSignal<string | null>(null);
    let startX = 0;
    let startWidth = 0;

    const startResize = (e: MouseEvent, colKey: keyof typeof DEFAULT_WIDTHS) => {
        e.preventDefault();
        setResizingCol(colKey);
        startX = e.clientX;
        startWidth = colWidths()[colKey];

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        document.body.style.cursor = 'col-resize';
    };

    const onMouseMove = (e: MouseEvent) => {
        if (!resizingCol()) return;
        const diff = e.clientX - startX;
        const newWidth = Math.max(30, startWidth + diff); // Min width 30px
        setColWidths(prev => ({ ...prev, [resizingCol()!]: newWidth }));
    };

    const onMouseUp = () => {
        setResizingCol(null);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
    };

    onCleanup(() => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    });

    return (
        <div class="trade-setups-container">
            <div class="setups-header">
                <h3>Active Trade Setups</h3>
                <span class="last-updated">
                    Last update: {formatTime(daemonStatus()?.last_updated || '')}
                </span>
            </div>

            <div class="setups-content">
                {/* Table Section */}
                <div class="setups-table-container">
                    <table class="setups-table" style={{ "table-layout": "fixed", width: "100%" }}>
                        <colgroup>
                            <col style={{ width: `${colWidths().status}px` }} />
                            <col style={{ width: `${colWidths().time}px` }} />
                            <col style={{ width: `${colWidths().symbol}px` }} />
                            <col style={{ width: `${colWidths().side}px` }} />
                            <col style={{ width: `${colWidths().entry}px` }} />
                            <col style={{ width: `${colWidths().target}px` }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>
                                    Status
                                    <div class="resizer" onMouseDown={(e) => startResize(e, 'status')}></div>
                                </th>
                                <th>
                                    Time
                                    <div class="resizer" onMouseDown={(e) => startResize(e, 'time')}></div>
                                </th>
                                <th>
                                    Symbol
                                    <div class="resizer" onMouseDown={(e) => startResize(e, 'symbol')}></div>
                                </th>
                                <th>
                                    Side
                                    <div class="resizer" onMouseDown={(e) => startResize(e, 'side')}></div>
                                </th>
                                <th>
                                    Entry
                                    <div class="resizer" onMouseDown={(e) => startResize(e, 'entry')}></div>
                                </th>
                                <th>
                                    Target
                                    <div class="resizer" onMouseDown={(e) => startResize(e, 'target')}></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <For each={activeSetups()}>
                                {(setup) => (
                                    <tr
                                        class={`setup-row ${selectedId() === setup.id ? 'selected' : ''}`}
                                        onClick={() => handleRowClick(setup.id)}
                                    >
                                        <td>
                                            <span class={`status-badge status-${setup.status.toLowerCase()}`}>
                                                {setup.status}
                                            </span>
                                        </td>
                                        <td class="truncate">{formatTime(setup.created_at)}</td>
                                        <td class="truncate">{setup.symbol}</td>
                                        <td class={`truncate side-${setup.direction.toLowerCase()}`}>{setup.direction}</td>
                                        <td class="truncate">{setup.entry?.price != null ? setup.entry.price.toFixed(2) : '-'}</td>
                                        <td class="truncate">
                                            {setup.targets.length > 0 ? setup.targets[setup.targets.length - 1].price.toFixed(2) : '--'}
                                        </td>
                                    </tr>
                                )}
                            </For>
                            <Show when={activeSetups().length === 0}>
                                <tr>
                                    <td colspan="6" class="no-data">No active setups in backlog (30m)</td>
                                </tr>
                            </Show>
                        </tbody>
                    </table>
                </div>

                {/* Details / Rules Section (Unchanged) */}
                <div class="setup-details-panel">
                    <Show when={selectedSetup()} fallback={<div class="details-placeholder">Select a setup to view rules</div>}>
                        <div class="details-content">
                            <div class="details-header">
                                <h4>{selectedSetup()?.direction} {selectedSetup()?.entry?.price != null ? `@ ${selectedSetup()?.entry?.price}` : 'Market/Immediate'}</h4>
                                <span class="setup-id">ID: {selectedSetup()?.id}</span>
                            </div>

                            <div class="rules-box">
                                <label>Strategy Rules</label>
                                <p class="rules-text">{selectedSetup()?.rules_text}</p>
                            </div>

                            <div class="params-grid">
                                <div class="param-item">
                                    <label>Stop Loss</label>
                                    <span class="value stop">{selectedSetup()?.stop_loss.price.toFixed(2)}</span>
                                    <span class="sub-label">{selectedSetup()?.stop_loss.description}</span>
                                </div>
                                <div class="param-item">
                                    <label>Entry Condition</label>
                                    <span class="value">{selectedSetup()?.entry?.condition || selectedSetup()?.entry?.conditions || 'N/A'}</span>
                                </div>
                                <div class="param-item">
                                    <label>Targets</label>
                                    <div class="targets-list">
                                        <For each={selectedSetup()?.targets}>
                                            {t => (
                                                <div class="target-row">
                                                    <span class="value profit">{t.price.toFixed(2)}</span>
                                                    <span class="sub-label">{t.description}</span>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </div>

                            <Show when={selectedSetup()?.reasoning}>
                                <div class="reasoning-box">
                                    <label>AI Reasoning</label>
                                    <p>{selectedSetup()?.reasoning}</p>
                                </div>
                            </Show>
                        </div>
                    </Show>
                </div>
            </div>
        </div>
    );
}
