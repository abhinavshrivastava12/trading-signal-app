import React, { useState } from 'react';
import { createSignal } from '../services/api';

const COMMON_PAIRS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];

function getDefaultEntryTime() {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString().slice(0, 16);
}

function getDefaultExpiryTime() {
  const d = new Date();
  d.setHours(d.getHours() + 24);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export default function CreateSignalForm({ onSuccess }) {
  const [form, setForm] = useState({
    symbol: '',
    direction: 'BUY',
    entry_price: '',
    stop_loss: '',
    target_price: '',
    entry_time: getDefaultEntryTime(),
    expiry_time: getDefaultExpiryTime(),
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: '' }));
    setServerError('');
  };

  const validate = () => {
    const errs = {};
    if (!form.symbol.trim()) errs.symbol = 'Symbol is required';
    if (!form.entry_price || isNaN(form.entry_price) || Number(form.entry_price) <= 0)
      errs.entry_price = 'Valid entry price required';
    if (!form.stop_loss || isNaN(form.stop_loss) || Number(form.stop_loss) <= 0)
      errs.stop_loss = 'Valid stop loss required';
    if (!form.target_price || isNaN(form.target_price) || Number(form.target_price) <= 0)
      errs.target_price = 'Valid target price required';
    if (!form.entry_time) errs.entry_time = 'Entry time required';
    if (!form.expiry_time) errs.expiry_time = 'Expiry time required';

    if (form.entry_time && form.expiry_time) {
      if (new Date(form.expiry_time) <= new Date(form.entry_time))
        errs.expiry_time = 'Expiry must be after entry time';
    }

    const ep = Number(form.entry_price);
    const sl = Number(form.stop_loss);
    const tp = Number(form.target_price);
    if (ep && sl && tp) {
      if (form.direction === 'BUY') {
        if (sl >= ep) errs.stop_loss = 'BUY: Stop loss must be below entry price';
        if (tp <= ep) errs.target_price = 'BUY: Target must be above entry price';
      } else {
        if (sl <= ep) errs.stop_loss = 'SELL: Stop loss must be above entry price';
        if (tp >= ep) errs.target_price = 'SELL: Target must be below entry price';
      }
    }

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    setServerError('');

    try {
      const payload = {
        symbol: form.symbol.trim().toUpperCase(),
        direction: form.direction,
        entry_price: Number(form.entry_price),
        stop_loss: Number(form.stop_loss),
        target_price: Number(form.target_price),
        entry_time: new Date(form.entry_time).toISOString(),
        expiry_time: new Date(form.expiry_time).toISOString(),
      };
      await createSignal(payload);
      setSuccess(true);
      setTimeout(() => {
        onSuccess && onSuccess();
      }, 1200);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        const msg = detail.map(d => d.msg || d.message || JSON.stringify(d)).join('; ');
        setServerError(msg);
      } else if (typeof detail === 'string') {
        setServerError(detail);
      } else {
        setServerError('Failed to create signal. Check your inputs.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="form-container">
        <div className="success-message">
          <span className="success-icon">✅</span>
          <h3>Signal Created!</h3>
          <p>Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="form-container">
      <div className="form-card">
        <h2 className="form-title">Create Trading Signal</h2>
        <p className="form-subtitle">Set up a new signal with entry, target, and stop loss levels.</p>

        {serverError && (
          <div className="server-error">
            <strong>Error:</strong> {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Symbol */}
          <div className="form-group">
            <label className="form-label">Trading Pair *</label>
            <input
              className={`form-input ${errors.symbol ? 'error' : ''}`}
              type="text"
              placeholder="e.g. BTCUSDT"
              value={form.symbol}
              onChange={e => set('symbol', e.target.value.toUpperCase())}
            />
            <div className="quick-pairs">
              {COMMON_PAIRS.map(p => (
                <button key={p} type="button" className="pair-chip" onClick={() => set('symbol', p)}>
                  {p}
                </button>
              ))}
            </div>
            {errors.symbol && <span className="field-error">{errors.symbol}</span>}
          </div>

          {/* Direction */}
          <div className="form-group">
            <label className="form-label">Direction *</label>
            <div className="direction-toggle">
              <button
                type="button"
                className={`dir-btn ${form.direction === 'BUY' ? 'active buy' : ''}`}
                onClick={() => set('direction', 'BUY')}
              >
                ▲ BUY
              </button>
              <button
                type="button"
                className={`dir-btn ${form.direction === 'SELL' ? 'active sell' : ''}`}
                onClick={() => set('direction', 'SELL')}
              >
                ▼ SELL
              </button>
            </div>
          </div>

          {/* Prices */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Entry Price *</label>
              <input
                className={`form-input ${errors.entry_price ? 'error' : ''}`}
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={form.entry_price}
                onChange={e => set('entry_price', e.target.value)}
              />
              {errors.entry_price && <span className="field-error">{errors.entry_price}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">
                Stop Loss *
                <span className="hint">
                  {form.direction === 'BUY' ? '(below entry)' : '(above entry)'}
                </span>
              </label>
              <input
                className={`form-input ${errors.stop_loss ? 'error' : ''}`}
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={form.stop_loss}
                onChange={e => set('stop_loss', e.target.value)}
              />
              {errors.stop_loss && <span className="field-error">{errors.stop_loss}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">
                Target Price *
                <span className="hint">
                  {form.direction === 'BUY' ? '(above entry)' : '(below entry)'}
                </span>
              </label>
              <input
                className={`form-input ${errors.target_price ? 'error' : ''}`}
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={form.target_price}
                onChange={e => set('target_price', e.target.value)}
              />
              {errors.target_price && <span className="field-error">{errors.target_price}</span>}
            </div>
          </div>

          {/* Times */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Entry Date & Time *</label>
              <input
                className={`form-input ${errors.entry_time ? 'error' : ''}`}
                type="datetime-local"
                value={form.entry_time}
                onChange={e => set('entry_time', e.target.value)}
              />
              {errors.entry_time && <span className="field-error">{errors.entry_time}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Expiry Date & Time *</label>
              <input
                className={`form-input ${errors.expiry_time ? 'error' : ''}`}
                type="datetime-local"
                value={form.expiry_time}
                onChange={e => set('expiry_time', e.target.value)}
              />
              {errors.expiry_time && <span className="field-error">{errors.expiry_time}</span>}
            </div>
          </div>

          {/* Direction hint */}
          <div className="direction-hint">
            {form.direction === 'BUY' ? (
              <p>📘 <strong>BUY signal:</strong> Stop Loss &lt; Entry Price &lt; Target Price</p>
            ) : (
              <p>📕 <strong>SELL signal:</strong> Target Price &lt; Entry Price &lt; Stop Loss</p>
            )}
          </div>

          <button className="submit-btn" type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : '+ Create Signal'}
          </button>
        </form>
      </div>
    </div>
  );
}
