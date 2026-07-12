export type Periode = "jour" | "semaine" | "mois" | "annee";

export const PERIODES: { value: Periode; label: string }[] = [
  { value: "jour", label: "Jour" },
  { value: "semaine", label: "Semaine" },
  { value: "mois", label: "Mois" },
  { value: "annee", label: "Année" },
];

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

export function getMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

export function getRange(periode: Periode, anchor: Date): { start: Date; end: Date } {
  if (periode === "jour") {
    return { start: anchor, end: anchor };
  }
  if (periode === "semaine") {
    const start = getMonday(anchor);
    return { start, end: addDays(start, 6) };
  }
  if (periode === "mois") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { start, end };
  }
  return {
    start: new Date(anchor.getFullYear(), 0, 1),
    end: new Date(anchor.getFullYear(), 11, 31),
  };
}

export function getPrevAnchor(periode: Periode, anchor: Date): Date {
  if (periode === "jour") return addDays(anchor, -1);
  if (periode === "semaine") return addDays(anchor, -7);
  if (periode === "mois") return new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
  return new Date(anchor.getFullYear() - 1, 0, 1);
}

export function getLastYearAnchor(periode: Periode, anchor: Date): Date {
  return new Date(anchor.getFullYear() - 1, anchor.getMonth(), anchor.getDate());
}

export function navigateAnchor(periode: Periode, anchor: Date, dir: 1 | -1): Date {
  if (periode === "jour") return addDays(anchor, dir);
  if (periode === "semaine") return addDays(anchor, dir * 7);
  if (periode === "mois") return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  return new Date(anchor.getFullYear() + dir, 0, 1);
}

export function formatRangeLabel(periode: Periode, start: Date, end: Date): string {
  if (periode === "jour") {
    return start.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }
  if (periode === "annee") {
    return String(start.getFullYear());
  }
  return `${start.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
  })} – ${end.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })}`;
}

export function formatEuros(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}

export function pct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function formatPct(p: number | null): string {
  if (p === null) return "n/a";
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

export type Direction = "up" | "down" | "stable" | null;

export function classify(p: number | null): Direction {
  if (p === null) return null;
  if (p > 2) return "up";
  if (p < -2) return "down";
  return "stable";
}
