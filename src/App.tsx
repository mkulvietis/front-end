/**
 * Trading Dashboard App
 * Main application component that assembles all sections.
 */
import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { startAutoRefresh, stopAutoRefresh, recalculateTrendlines } from './stores/market';
import { startInferencePolling, stopInferencePolling } from './stores/inference';
import ControlPlane from './components/ControlPlane';
import Chart from './components/Chart';
import IndicatorsTable from './components/IndicatorsTable';
import PatternsTable from './components/PatternsTable';
import PivotPoints from './components/PivotPoints';
import TradeSetups from './components/TradeSetups';
import Trendlines from './components/Trendlines';
import './App.css';

type Tab = 'chart' | 'setups' | 'trendlines';

const [activeTab, setActiveTab] = createSignal<Tab>('chart');

export default function App() {
  const [timeOption, setTimeOption] = createSignal<'current' | 'bars_back'>('current');
  const [barsBack, setBarsBack] = createSignal<number>(15);

  onMount(() => {
    startAutoRefresh();
    startInferencePolling();
  });

  onCleanup(() => {
    stopAutoRefresh();
    stopInferencePolling();
  });

  return (
    <div class="dashboard">
      {/* 1. Control Plane */}
      <ControlPlane />

      {/* 2. Trendline Control (Above tabs, left-adjusted) */}
      <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'justify-content': 'flex-start' }}>
        <button
          onClick={() => {
            const bars = timeOption() === 'bars_back' ? barsBack() : undefined;
            recalculateTrendlines(bars);
          }}
          style={{
            "background-color": "var(--accent-blue)",
            "color": "white",
            "border": "none",
            "font-weight": "bold",
            "padding": "8px 16px",
            "border-radius": "4px",
            "cursor": "pointer"
          }}
        >
          Calculate Trendlines & OBs
        </button>

        <select
          value={timeOption()}
          onChange={(e) => setTimeOption(e.currentTarget.value as 'current' | 'bars_back')}
          style={{
            background: 'var(--bg-secondary, #1e1e1e)',
            color: 'var(--text-primary, #ffffff)',
            border: '1px solid var(--border-default, #333)',
            padding: '6px 12px',
            'border-radius': '4px',
            cursor: 'pointer',
            'font-size': '0.9rem'
          }}
        >
          <option value="current">Current</option>
          <option value="bars_back">Bars Back</option>
        </select>

        <Show when={timeOption() === 'bars_back'}>
          <input
            type="number"
            min="1"
            value={barsBack()}
            onInput={(e) => setBarsBack(parseInt(e.currentTarget.value) || 1)}
            style={{
              width: '60px',
              background: 'var(--bg-secondary, #1e1e1e)',
              color: 'var(--text-primary, #ffffff)',
              border: '1px solid var(--border-default, #333)',
              padding: '6px 8px',
              'border-radius': '4px',
              'font-size': '0.9rem'
            }}
          />
        </Show>
      </div>

      {/* 3. Tab Switcher */}
      <div class="navigation-row" style={{ display: 'flex', 'align-items': 'center', gap: '16px' }}>
        <div class="tab-bar">
          <button
            class={`tab-btn ${activeTab() === 'chart' ? 'active' : ''}`}
            onClick={() => setActiveTab('chart')}
          >
            📊 Chart & Analysis
          </button>
          <button
            class={`tab-btn ${activeTab() === 'setups' ? 'active' : ''}`}
            onClick={() => setActiveTab('setups')}
          >
            🎯 Trade Setups
          </button>
          <button
            class={`tab-btn ${activeTab() === 'trendlines' ? 'active' : ''}`}
            onClick={() => setActiveTab('trendlines')}
          >
            📐 Trendlines
          </button>
        </div>
      </div>

      {/* 3. Tab Content */}
      <Show when={activeTab() === 'chart'}>
        <Chart />
        <div class="analysis-section">
          <IndicatorsTable />
          <PatternsTable />
        </div>
        <PivotPoints />
      </Show>

      <Show when={activeTab() === 'setups'}>
        <TradeSetups />
      </Show>

      <Show when={activeTab() === 'trendlines'}>
        <Trendlines />
      </Show>
    </div>
  );
}
