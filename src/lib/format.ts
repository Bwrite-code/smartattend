// ── Date / number formatting helpers ─────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-09-18' → '18 Sep 2026' */
export function fmtDate(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  if (!y || !m || !day) return d;
  return `${day} ${MONTHS[m - 1]} ${y}`;
}

/** ISO datetime → '18 Sep 2026, 10:08 AM' */
export function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  return `${fmtDate(iso.slice(0, 10))}, ${fmtTimeOfDay(dt)}`;
}

/** '10:00' (HH:mm) → '10:00 AM' */
export function fmtTime(t: string): string {
  if (!t) return '—';
  const [hRaw, min] = t.split(':');
  const h = Number(hRaw);
  if (isNaN(h)) return t;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min ?? '00'} ${suffix}`;
}

function fmtTimeOfDay(dt: Date): string {
  let h = dt.getHours();
  const m = dt.getMinutes().toString().padStart(2, '0');
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 === 0 ? 12 : h % 12;
  return `${h}:${m} ${suffix}`;
}

/** Today's date as YYYY-MM-DD (local). */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Minutes between two HH:mm times (assumes end > start). */
export function minutesAfter(dateStr: string, timeStr: string, addedMinutes: number): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  const dt = new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0, 0, 0);
  dt.setMinutes(dt.getMinutes() + addedMinutes);
  return dt;
}

export function pct(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${Math.round(n)}%`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
