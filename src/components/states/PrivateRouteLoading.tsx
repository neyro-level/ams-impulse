import { Skeleton } from "../ui/skeleton.tsx";

export function PrivateRouteLoading({
  label,
  pattern = "list",
}: {
  label: string;
  pattern?: "dashboard" | "list" | "record";
}) {
  return (
    <div className="w-full space-y-6" aria-busy="true" aria-label={label}>
      <div className="space-y-3 border-b border-[var(--border)] pb-5">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-5 w-[32rem] max-w-full" />
      </div>
      {pattern === "dashboard" ? (
        <>
          <Skeleton className="h-56 rounded-[var(--radius-card)]" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <Skeleton className="h-28 rounded-[var(--radius-card)]" key={index} />)}
          </div>
        </>
      ) : pattern === "record" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-[32rem] rounded-[var(--radius-card)]" />
          <div className="space-y-6"><Skeleton className="h-40 rounded-[var(--radius-card)]" /><Skeleton className="h-32 rounded-[var(--radius-card)]" /></div>
        </div>
      ) : (
        <><Skeleton className="h-16 rounded-[var(--radius-panel)]" /><Skeleton className="h-80 rounded-[var(--radius-card)]" /></>
      )}
    </div>
  );
}
