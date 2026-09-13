"use client";

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { Button } from "../../../components/ui/button.tsx";
import { Card, CardContent, CardHeader } from "../../../components/ui/card.tsx";
import { Input, Textarea } from "../../../components/ui/input.tsx";
import { NativeSelect, NativeSelectOption } from "../../../components/ui/native-select.tsx";
import { Field, FieldDescription, FieldError, FieldLabel } from "../../../components/ui/field.tsx";
import type { DefinedAction } from "../../../platform/actions/define-action.ts";
import type { PlatformAdminActionFailure } from "../../../modules/platform-admin/index.ts";

export type ActionResultLike<TResult> = DefinedAction<TResult> | PlatformAdminActionFailure;
export type Feedback = { kind: "success" | "error" | "stale"; message: string } | null;

export function applyFieldErrors<TValues extends FieldValues>(
  fieldErrors: Record<string, string[]>,
  setError: UseFormSetError<TValues>,
) {
  for (const [field, messages] of Object.entries(fieldErrors)) {
    const message = messages[0];
    if (message) setError(field as Path<TValues>, { message });
  }
}

export function feedbackFrom(result: { ok: true } | { ok: false; error: { code: string; message: string } }): Feedback {
  if (result.ok) return { kind: "success", message: "Данные сохранены" };
  return {
    kind: result.error.code === "STALE_STATE" ? "stale" : "error",
    message: result.error.message,
  };
}

export function FeedbackMessage({ feedback, onRefresh }: { feedback: Feedback; onRefresh?: () => void }) {
  if (!feedback) return null;
  return (
    <div
      className={feedback.kind === "success" ? "text-sm font-medium text-success" : feedback.kind === "stale" ? "text-sm font-medium text-warning" : "text-sm font-medium text-destructive"}
      role={feedback.kind === "success" ? "status" : "alert"}
    >
      <span>{feedback.message}</span>
      {feedback.kind === "stale" && onRefresh ? (
        <Button className="ml-2" variant="link" type="button" onClick={onRefresh}>
          Обновить данные
        </Button>
      ) : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm leading-6 text-secondary-text">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function FormField({
  label,
  required,
  error,
  helper,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  helper?: string;
  children: ReactNode;
}) {
  const fieldId = useId();
  const descriptionId = helper ? `${fieldId}-description` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const childProps = isValidElement(children)
    ? (children.props as { id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean })
    : null;
  const control = childProps
    ? cloneElement(children as ReactElement<typeof childProps>, {
        id: childProps.id ?? fieldId,
        "aria-describedby": [childProps["aria-describedby"], descriptionId, errorId].filter(Boolean).join(" ") || undefined,
        "aria-invalid": error ? true : childProps["aria-invalid"],
      })
    : children;

  return (
    <Field>
      <FieldLabel className="grid gap-2">
        <span>{label}{required ? <span className="ml-1 text-destructive">*</span> : null}</span>
        {control}
      </FieldLabel>
      {helper ? <FieldDescription id={descriptionId}>{helper}</FieldDescription> : null}
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  );
}

export function TextInput(props: React.ComponentProps<typeof Input>) {
  return <Input {...props} />;
}

export function SelectInput(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    options: Array<{ value: string; label: string }>;
  },
) {
  const { options, ...rest } = props;
  return (
    <NativeSelect {...rest}>
      {options.map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

export function AreaInput(props: React.ComponentProps<typeof Textarea>) {
  return <Textarea {...props} />;
}

export function SubmitRow({
  label,
  pendingLabel,
  busy,
  feedback,
  onRefresh,
  variant = "default",
}: {
  label: string;
  pendingLabel: string;
  busy: boolean;
  feedback: Feedback;
  onRefresh?: () => void;
  variant?: "default" | "outline" | "ghost";
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled={busy} type="submit" variant={variant}>
        {busy ? pendingLabel : label}
      </Button>
      <FeedbackMessage feedback={feedback} onRefresh={onRefresh} />
    </div>
  );
}
