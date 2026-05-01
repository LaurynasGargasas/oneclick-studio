/** Compact uppercase relative time, e.g. "12M AGO", "3D AGO", "JUST NOW". */
export function relativeTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const sec = diff / 1000;
  const min = sec / 60;
  const hr = min / 60;
  const day = hr / 24;
  if (sec < 45) return "JUST NOW";
  if (min < 60) return `${Math.floor(min)}M AGO`;
  if (hr < 24) return `${Math.floor(hr)}H AGO`;
  if (day < 30) return `${Math.floor(day)}D AGO`;
  return new Date(ts).toLocaleDateString().toUpperCase();
}
