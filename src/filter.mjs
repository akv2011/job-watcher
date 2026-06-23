// Title + location filtering. Mirrors career-ops/scan.mjs semantics:
//   keep if  (>=1 positive matches)  AND  (0 negatives match)
// Location filter is optional and OFF unless `location` block is present.
// All matching is case-insensitive substring.

export function matchesTitle(title, { positive = [], negative = [] } = {}) {
  const t = (title || '').toLowerCase();
  if (!t) return false;
  if (negative.some((k) => t.includes(k.toLowerCase()))) return false;
  if (positive.length === 0) return true;
  return positive.some((k) => t.includes(k.toLowerCase()));
}

// Location semantics (only applied when `location` config exists):
//   - empty location string  -> pass (don't penalize missing data)
//   - any always_allow match  -> pass (wins over block)
//   - any block match         -> reject
//   - allow empty             -> pass
//   - allow non-empty         -> must match at least one
export function matchesLocation(loc, locationCfg) {
  if (!locationCfg) return true;
  const l = (loc || '').toLowerCase();
  if (!l) return true;
  const { always_allow = [], allow = [], block = [] } = locationCfg;
  if (always_allow.some((k) => l.includes(k.toLowerCase()))) return true;
  if (block.some((k) => l.includes(k.toLowerCase()))) return false;
  if (allow.length === 0) return true;
  return allow.some((k) => l.includes(k.toLowerCase()));
}

export function keepJob(j, filterCfg = {}) {
  return (
    matchesTitle(j.title, filterCfg) &&
    matchesLocation(j.location, filterCfg.location)
  );
}
