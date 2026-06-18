import React, { useState, useEffect, useCallback, useRef } from 'react';
import { listSignals, getSignalStatus, deleteSignal } from '../services/api';

const STATUS_COLORS = {
  OPEN: '#3b82f6',
  TARGET_HIT: '#22c55e',
  STOPLOSS_HIT: '#ef4444',
  EXPIRED: '#6b7280',
};

const STATUS_LABELS = {
  OPEN: '🔵 OPEN',
  TARGET_HIT: '🟢 TARGET HIT',
  STOPLOSS_HIT: '🔴 STOP HIT',
  EXPIRED: '⚫ EXPIRED',
};

function formatTimeRemaining(seconds) {
  if (seconds <= 0) return 'Expired';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatPrice(price) {
  if (price == null) return '—';
  return Number(price).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function formatROI(roi) {
  if (roi == null) return '—';
  const sign = roi >= 0 ? '+' : '';
  return `${sign}${Number(roi).toFixed(2)}%`;
}

export default function Dashboard() {
  const [signals, setSignals] = useState([]);
  const [liveData, setLiveData] = useState({});
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(15);
  const [error, setError] = useState(null);

  // Ref to always have latest signals inside setInterval without stale closure
  const signalsRef = useRef([]);
  signalsRef.current = signals;

  const fetchSignals = useCallback(async () => {
    try {
      const res = await listSignals();
      setSignals(res.data);
      setError(null);
      return res.data;
    } catch (e) {
      setError('Failed to load signals. Is the backend running?');
      return [];
    }
  }, []);

  const fetchLiveStatuses = useCallback(async (signalList) => {
    const list = signalList ?? signalsRef.current;
    if (!list.length) return;
    const results = await Promise.allSettled(
      list.map((s) => getSignalStatus(s.id))
    );
    const map = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        map[list[i].id] = r.value.data;
      }
    });
    setLiveData(map);
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const list = await fetchSignals();
      await fetchLiveStatuses(list);
      setLoading(false);
    };
    init();
  }, [fetchSignals, fetchLiveStatuses]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const refresh = async () => {
      const list = await fetchSignals();
      await fetchLiveStatuses(list);
      setCountdown(15);
    };

    const refreshInterval = setInterval(refresh, 15000);
    const countdownInterval = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 15 : c - 1));
    }, 1000);

    return () => {
      clearInterval(refreshInterval);
      clearInterval(countdownInterval);
    };
  }, [fetchSignals, fetchLiveStatuses]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this signal?')) return;
    try {
      await deleteSignal(id);
      const list = await fetchSignals();
      await fetchLiveStatuses(list);
    } catch (e) {
      alert('Failed to delete signal');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading signals...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">Signal Dashboard</h2>
          <p className="dashboard-subtitle">
            {signals.length} signal{signals.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <div className="refresh-info">
          <div className="refresh-dot"></div>
          <span>
            Refreshing in <strong>{countdown}s</strong>
          </span>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {signals.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📊</span>
          <p>No signals yet. Create your first trading signal!</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="signal-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Dir</th>
                <th>Entry</th>
                <th>Target</th>
                <th>Stop Loss</th>
                <th>Current Price</th>
                <th>Status</th>
                <th>ROI %</th>
                <th>Time Left</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {signals.map((signal) => {
                const live = liveData[signal.id] || {};
                const status = live.status || signal.status;
                const currentPrice = live.current_price;
                const roi = live.realized_roi;
                const timeLeft = live.time_remaining_seconds;
                const roiPositive = roi != null && roi >= 0;

                return (
                  <tr key={signal.id} className={`signal-row status-${status}`}>
                    <td className="symbol-cell">
                      <span className="symbol-badge">{signal.symbol}</span>
                    </td>
                    <td>
                      <span className={`direction-badge ${signal.direction.toLowerCase()}`}>
                        {signal.direction === 'BUY' ? '▲' : '▼'} {signal.direction}
                      </span>
                    </td>
                    <td className="price-cell">{formatPrice(signal.entry_price)}</td>
                    <td className="price-cell target">{formatPrice(signal.target_price)}</td>
                    <td className="price-cell stoploss">{formatPrice(signal.stop_loss)}</td>
                    <td className="price-cell live">
                      {currentPrice != null ? (
                        <span className="live-price">{formatPrice(currentPrice)}</span>
                      ) : (
                        <span className="loading-price">…</span>
                      )}
                    </td>
                    <td>
                      <span
                        className="status-badge"
                        style={{
                          backgroundColor: STATUS_COLORS[status] + '22',
                          color: STATUS_COLORS[status],
                          border: `1px solid ${STATUS_COLORS[status]}44`,
                        }}
                      >
                        {STATUS_LABELS[status] || status}
                      </span>
                    </td>
                    <td className={`roi-cell ${roi != null ? (roiPositive ? 'positive' : 'negative') : ''}`}>
                      {formatROI(roi)}
                    </td>
                    <td className="time-cell">
                      {timeLeft != null ? formatTimeRemaining(timeLeft) : '—'}
                    </td>
                    <td>
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(signal.id)}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}