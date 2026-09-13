import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";

type StatusBannerProps = { tone: "success" | "info" | "warning" | "error"; title: string; description: string };

const toneMap = {
  success: { wrapper: "border-success/25 bg-success-soft text-success", Icon: CheckCircle2 },
  info: { wrapper: "border-info/25 bg-info-soft text-info", Icon: Info },
  warning: { wrapper: "border-warning/25 bg-warning-soft text-warning", Icon: TriangleAlert },
  error: { wrapper: "border-destructive/25 bg-destructive-soft text-destructive", Icon: AlertCircle },
} as const;

export function StatusBanner({ tone, title, description }: StatusBannerProps) {
  const { wrapper, Icon } = toneMap[tone];
  return <div className={`flex gap-3 rounded-panel border p-4 ${wrapper}`} role={tone === "error" ? "alert" : "status"}><Icon className="mt-0.5 size-5 shrink-0" strokeWidth={1.8} aria-hidden /><div className="space-y-1"><p className="text-sm font-semibold leading-5">{title}</p><p className="text-sm leading-5 text-foreground">{description}</p></div></div>;
}
