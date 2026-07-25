import { createSignal, Show } from 'solid-js';

export default function BacktestDashboard() {
  const [ticker, setTicker] = createSignal('@ES');
  const [timeframe, setTimeframe] = createSignal(5);
  const [lookback, setLookback] = createSignal(5);
  const [vwapSd, setVwapSd] = createSignal(1.0);
  const [loading, setLoading] = createSignal(false);
  const [reportUrl, setReportUrl] = createSignal('');

  const runBacktest = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: ticker(),
          timeframe: timeframe(),
          limit: 1000,
          pivot_lookback: lookback(),
          vwap_sd: vwapSd(),
          step: 10
        })
      });
      if (res.ok) {
        // Force iframe refresh by appending timestamp
        setReportUrl(`http://localhost:8000/backtest/report?t=${Date.now()}`);
      } else {
        const error = await res.text();
        alert('Backtest failed: ' + error);
      }
    } catch (e) {
      console.error(e);
      alert('Error connecting to backend');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '16px', 'padding-top': '16px' }}>
      <div style={{
        display: 'flex', gap: '16px', 'align-items': 'center', 'background-color': 'var(--bg-secondary)', 'padding': '16px', 'border-radius': '8px'
      }}>
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
          <label style={{ 'font-size': '0.8rem', color: '#aaa' }}>Ticker</label>
          <input value={ticker()} onInput={e => setTicker(e.currentTarget.value)} style={{ padding: '6px', 'border-radius': '4px', background: '#333', color: 'white', border: 'none' }} />
        </div>
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
          <label style={{ 'font-size': '0.8rem', color: '#aaa' }}>Timeframe (m)</label>
          <input type="number" value={timeframe()} onInput={e => setTimeframe(parseInt(e.currentTarget.value))} style={{ padding: '6px', 'border-radius': '4px', background: '#333', color: 'white', border: 'none' }} />
        </div>
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
          <label style={{ 'font-size': '0.8rem', color: '#aaa' }}>Pivot Lookback</label>
          <input type="number" value={lookback()} onInput={e => setLookback(parseInt(e.currentTarget.value))} style={{ padding: '6px', 'border-radius': '4px', background: '#333', color: 'white', border: 'none' }} />
        </div>
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
          <label style={{ 'font-size': '0.8rem', color: '#aaa' }}>VWAP SD</label>
          <input type="number" step="0.1" value={vwapSd()} onInput={e => setVwapSd(parseFloat(e.currentTarget.value))} style={{ padding: '6px', 'border-radius': '4px', background: '#333', color: 'white', border: 'none' }} />
        </div>
        <button 
          onClick={runBacktest} 
          disabled={loading()}
          style={{
            "background-color": loading() ? "#555" : "var(--accent-blue)",
            "color": "white",
            "border": "none",
            "font-weight": "bold",
            "padding": "10px 20px",
            "border-radius": "4px",
            "cursor": loading() ? "not-allowed" : "pointer",
            "margin-top": "20px" // align with inputs
          }}
        >
          {loading() ? 'Running...' : 'Run Backtest'}
        </button>
      </div>
      
      <div style={{ 'min-height': '600px', 'background-color': 'var(--bg-secondary)', 'border-radius': '8px', overflow: 'hidden' }}>
        <Show when={reportUrl()}>
          <iframe src={reportUrl()} width="100%" height="800px" style={{ border: 'none' }} />
        </Show>
        <Show when={!reportUrl()}>
          <div style={{ padding: '32px', 'text-align': 'center', color: '#888' }}>
            Run a backtest to view the QuantStats tear sheet.
          </div>
        </Show>
      </div>
    </div>
  );
}
