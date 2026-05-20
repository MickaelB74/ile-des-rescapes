class GameTimer {
  constructor(valueEl, labelEl) {
    this.valueEl = valueEl;
    this.labelEl = labelEl;
    this._interval = null;
    this.endAt = null;
  }

  start(endAt) {
    this.endAt = endAt;
    this._stop();
    this._tick();
    this._interval = setInterval(() => this._tick(), 500);
  }

  clear(text = '--:--') {
    this._stop();
    this.endAt = null;
    this.valueEl.textContent = text;
    this.valueEl.className = 'timer-value';
  }

  setLabel(text) {
    if (this.labelEl) this.labelEl.textContent = text;
  }

  _stop() {
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
  }

  _tick() {
    if (!this.endAt) return;
    const rem = Math.max(0, Math.floor((this.endAt - Date.now()) / 1000));
    const m = Math.floor(rem / 60);
    const s = rem % 60;
    this.valueEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    this.valueEl.className = 'timer-value' + (rem <= 10 ? ' danger' : rem <= 30 ? ' warn' : '');
    if (rem === 0) {
      this._stop();
      this.valueEl.dispatchEvent(new CustomEvent('timer-end', { bubbles: true }));
    }
  }
}
