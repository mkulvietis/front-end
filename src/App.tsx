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

      {/* 2. Tab Switcher & Trendline Control */}
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

        <button
          onClick={() => recalculateTrendlines()}
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
