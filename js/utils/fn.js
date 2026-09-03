/** CULINA — small function utilities. */

/** Trailing-edge debounce. Returns debounced fn with .cancel() and .flush(). */
export function debounce(fn, wait = 300) {
  let timer = null;
  let lastArgs = null;
  const debounced = (...args) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...lastArgs);
    }, wait);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      fn(...lastArgs);
    }
  };
  return debounced;
}

export function once(fn) {
  let called = false;
  let result;
  return (...args) => {
    if (called) return result;
    called = true;
    result = fn(...args);
    return result;
  };
}

/** Pretty kitchen quantity: 0.5 → ½, 1.5 → 1½, 2.25 → 2¼ … */
export function formatQuantity(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const whole = Math.floor(value);
  const frac = value - whole;
  const map = [
    [0.25, '¼'],
    [0.33, '⅓'],
    [0.5, '½'],
    [0.66, '⅔'],
    [0.75, '¾'],
  ];
  let suffix = '';
  if (frac > 0.05) {
    let best = null;
    let bestDiff = 1;
    for (const [v, sym] of map) {
      const diff = Math.abs(frac - v);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = sym;
      }
    }
    if (best && bestDiff < 0.08) suffix = best;
    else suffix = String(Math.round(frac * 100) / 100).slice(1); // e.g. .3
  }
  if (whole === 0 && suffix) return suffix.startsWith('.') ? String(Math.round(frac * 100) / 100) : suffix;
  return `${whole}${suffix}`;
}
