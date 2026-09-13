import { Badge } from "../ui/badge.tsx";

export type StatusTone = "success" | "warning" | "info" | "destructive" | "neutral";

const toneClassName: Record<StatusTone, string> = {
  success: "border-transparent bg-success-soft text-success",
  warning: "border-transparent bg-warning-soft text-warning",
  info: "border-transparent bg-info-soft text-info",
  destructive: "border-transparent bg-destructive-soft text-destructive",
  neutral: "border-transparent bg-status-neutral-soft text-status-neutral",
};

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  return <Badge className={toneClassName[tone]}>{label}</Badge>;
}
