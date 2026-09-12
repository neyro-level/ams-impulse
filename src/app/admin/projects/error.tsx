"use client";

import { PrivateRouteError } from "../../../components/states/PrivateRouteError.tsx";

export default function ProjectsError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <PrivateRouteError error={error} reset={reset} title="Не удалось загрузить проекты" />
  );
}
