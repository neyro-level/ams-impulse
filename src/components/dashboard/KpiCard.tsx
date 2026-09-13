type KpiCardProps = {
  label: string;
  value: string;
  tone?: "default" | "primary" | "soft" | "success";
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
};

const toneMap: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "border-border bg-card text-foreground",
  primary: "border-primary bg-primary text-primary-foreground",
  soft: "border-info/20 bg-info-soft text-foreground",
  success: "border-success/20 bg-success-soft text-foreground",
};

export function KpiCard({
  label,
  value,
  tone = "default",
  delta,
  deltaTone = "neutral",
}: KpiCardProps) {
  return (
    <article className={`rounded-card border p-5 shadow-surface ${toneMap[tone]}`}>
      <p
        className={`text-xs font-semibold uppercase ${
          tone === "primary" ? "text-primary-foreground opacity-75" : "text-muted-foreground"
        }`}
      >
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
      {delta ? (
        <p
          className={[
            "mt-2 text-xs font-semibold tabular-nums",
            tone === "primary"
              ? "text-primary-foreground opacity-85"
              : deltaTone === "positive"
                ? "text-success"
                : deltaTone === "negative"
                  ? "text-destructive"
                  : "text-muted-foreground",
          ].join(" ")}
        >
          {delta}
        </p>
      ) : null}
    </article>
  );
}
