"use client";

import { useEffect, useRef } from "react";
import { Button } from "../ui/button.tsx";
import { ErrorState } from "./StatePanel.tsx";

type SafeRouteError = Error & { code?: string; correlationId?: string; digest?: string };

function safeCode(error: SafeRouteError) {
  return error.code && /^[A-Z][A-Z0-9_]{2,63}$/.test(error.code)
    ? error.code
    : "PRIVATE_ROUTE_FAILED";
}

function safeCorrelation(error: SafeRouteError) {
  if (error.correlationId && /^[0-9a-f-]{36}$/i.test(error.correlationId)) return error.correlationId;
  return error.digest ? `next-${error.digest}` : "не передан";
}

export function PrivateRouteError({
  error,
  reset,
  title,
}: {
  error: SafeRouteError;
  reset: () => void;
  title: string;
}) {
  const code = safeCode(error);
  const correlationId = safeCorrelation(error);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { containerRef.current?.focus(); }, []);
  return (
    <div ref={containerRef} tabIndex={-1} className="mx-auto w-full max-w-3xl py-6 outline-none">
      <ErrorState
        title={title}
        description={`Данные не изменены. Код: ${code}. Correlation ID: ${correlationId}. Повторите запрос; если ошибка сохранится, передайте эти два значения.`}
        action={<Button onClick={reset} type="button">Повторить</Button>}
      />
    </div>
  );
}
