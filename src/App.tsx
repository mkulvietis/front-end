/**
 * Trading Dashboard App
 * Main application component that assembles all sections.
 */
import { onMount, onCleanup } from 'solid-js';
import { startAutoRefresh, stopAutoRefresh } from './stores/market';
import ControlPlane from './components/ControlPlane';
import Chart from './components/Chart';
import IndicatorsTable from './components/IndicatorsTable';
import PatternsTable from './components/PatternsTable';
import PivotPoints from './components/PivotPoints';
import TradeSetups from './components/TradeSetups';
import './App.css';

export default function App() {
  onMount(() => {
    startAutoRefresh();
  });

  onCleanup(() => {
    stopAutoRefresh();
  });

  return (
    <div class="dashboard">
      {/* 1. Control Plane */}
      <ControlPlane />

      {/* 2. Chart */}
      <Chart />

      {/* 3. Indicators + Patterns */}
      <div class="analysis-section">
        <IndicatorsTable />
        <PatternsTable />
      </div>

      {/* 4. Pivot Points */}
      <PivotPoints />

      {/* 5. AI Trade Setups */}
      <TradeSetups />
    </div>
  );
}
