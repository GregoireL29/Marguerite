export type JourKey = "lun" | "mar" | "mer" | "jeu" | "ven" | "sam" | "dim";

export interface Creneau {
  debut: string;
  fin: string;
}

export type Horaires = Record<JourKey, Creneau[]>;

const JOUR_KEYS: JourKey[] = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

export function todayJourKey(d: Date = new Date()): JourKey {
  const day = d.getDay();
  return JOUR_KEYS[day === 0 ? 6 : day - 1];
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Heure de fermeture du jour en minutes depuis minuit (dernier créneau du
// jour), ou null si la boutique n'a aucun créneau ce jour-là (fermée).
export function getFermetureMinutesAujourdhui(
  horaires: Horaires,
  d: Date = new Date()
): number | null {
  const blocks = horaires[todayJourKey(d)] ?? [];
  if (blocks.length === 0) return null;
  return Math.max(...blocks.map((b) => timeToMinutes(b.fin)));
}
