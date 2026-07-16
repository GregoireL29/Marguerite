import { formatPct } from "@/lib/indicateurs";

// Affichage unifié d'une variation chiffrée : flèche + pourcentage colorés
// par le signe (vert hausse, rouge baisse, neutre à zéro ou sans donnée),
// suffixe de contexte en retrait visuel pour que le chiffre ressorte.
export function VariationPct({
  value,
  suffix,
}: {
  value: number | null;
  suffix?: string;
}) {
  if (value === null) {
    return (
      <span className="text-xs text-faint-foreground">
        n/a{suffix ? ` ${suffix}` : ""}
      </span>
    );
  }

  const color =
    value > 0
      ? "text-green-600 dark:text-green-400"
      : value < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";
  const arrow = value > 0 ? "↑" : value < 0 ? "↓" : "→";

  return (
    <span className={`text-xs font-medium ${color}`}>
      {arrow} {formatPct(value)}
      {suffix && (
        <span className="font-normal text-faint-foreground"> {suffix}</span>
      )}
    </span>
  );
}
