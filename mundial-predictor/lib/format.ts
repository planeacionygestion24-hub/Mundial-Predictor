// Formato compartido de la UI.
export const pct = (p: number) => Math.round(p * 100);
export const pct1 = (p: number) => (p * 100).toFixed(1);
export const xg = (l: number) => l.toFixed(2);

export function kickoff(dateIso: string) {
  const d = new Date(dateIso);
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  })
    .format(d)
    .toUpperCase();
}

export function runStamp(dateIso: string) {
  const d = new Date(dateIso);
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  })
    .format(d)
    .toUpperCase();
}
