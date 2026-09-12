"use client";

import { PrivateRouteError } from "../../../components/states/PrivateRouteError.tsx";

export default function AdminResourceError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <PrivateRouteError error={error} reset={reset} title="Не удалось загрузить раздел администрирования" />
  );
}
