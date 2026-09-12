"use client";

import { PrivateRouteError } from "../../../components/states/PrivateRouteError.tsx";

export default function ResearchError({ error, reset }: { error: Error; reset: () => void }) {
  return <PrivateRouteError error={error} reset={reset} title="Не удалось открыть исследования" />;
}
