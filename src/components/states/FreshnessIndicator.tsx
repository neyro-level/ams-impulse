import { StatusBadge, type StatusTone } from "./StatusBadge.tsx";

type Freshness = "fresh" | "stale" | "partial" | "unavailable";
const presentation: Record<Freshness, { label: string; tone: StatusTone }> = {
  fresh: { label: "Актуально", tone: "success" },
  stale: { label: "Устарело", tone: "warning" },
  partial: { label: "Частично", tone: "warning" },
  unavailable: { label: "Недоступно", tone: "destructive" },
};

export function FreshnessIndicator({ freshness }: { freshness: Freshness }) {
  const item = presentation[freshness];
  return <StatusBadge label={item.label} tone={item.tone} />;
}
