"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import {
  createSeoProjectAccessInputSchema,
  productRoleSchema,
  removeSeoProjectAccessInputSchema,
  updateSeoProjectAccessInputSchema,
  type CreateSeoProjectAccessInput,
  type IdentityAdminFormOptions,
  type RemoveSeoProjectAccessInput,
  type SeoProjectAccessListItem,
  type UpdateSeoProjectAccessInput,
} from "../../../modules/identity-access/contracts.ts";
import {
  createSeoProjectAccessAction,
  removeSeoProjectAccessAction,
  updateSeoProjectAccessAction,
} from "../_actions/identity.ts";
import {
  applyFieldErrors,
  feedbackFrom,
  FormField,
  SectionCard,
  SelectInput,
  SubmitRow,
  type Feedback,
} from "./platform-admin-form-primitives.tsx";

const roleLabels = {
  VIEWER: "Просмотр",
  OPERATOR: "Работа с проектом",
  ANALYST: "Аналитик",
} as const;
const roleOptions = productRoleSchema.options.map((value) => ({ value, label: roleLabels[value] }));

function AccessEditCard({ item }: { item: SeoProjectAccessListItem }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [removeFeedback, setRemoveFeedback] = useState<Feedback>(null);
  const form = useForm<UpdateSeoProjectAccessInput>({
    resolver: zodResolver(updateSeoProjectAccessInputSchema) as Resolver<UpdateSeoProjectAccessInput>,
    defaultValues: {
      accessId: item.id,
      membershipId: item.membershipId,
      organizationId: item.organizationId,
      projectId: item.projectId,
      role: item.role,
      version: item.version,
    },
  });
  const removeForm = useForm<RemoveSeoProjectAccessInput>({
    resolver: zodResolver(removeSeoProjectAccessInputSchema) as Resolver<RemoveSeoProjectAccessInput>,
    defaultValues: { accessId: item.id, organizationId: item.organizationId, version: item.version },
  });

  const submit = form.handleSubmit(async (values) => {
    const result = await updateSeoProjectAccessAction(values);
    if (!result.ok) {
      applyFieldErrors(result.error.fieldErrors, form.setError);
      setFeedback(feedbackFrom(result));
      return;
    }
    setFeedback({ kind: "success", message: "Роль проекта обновлена, сеансы отозваны" });
    router.refresh();
  });
  const remove = removeForm.handleSubmit(async (values) => {
    const result = await removeSeoProjectAccessAction(values);
    if (!result.ok) {
      applyFieldErrors(result.error.fieldErrors, removeForm.setError);
      setRemoveFeedback(feedbackFrom(result));
      return;
    }
    setRemoveFeedback({ kind: "success", message: "Доступ к проекту отозван" });
    router.refresh();
  });

  return (
    <SectionCard title={item.userName} description={`${item.userEmail} · SEO Монитор · ${item.organizationName} · ${item.projectName}`}>
      <div className="space-y-4">
        <form className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={submit}>
          {(["accessId", "membershipId", "organizationId", "projectId", "version"] as const).map((field) => (
            <input key={field} type="hidden" {...form.register(field, field === "version" ? { valueAsNumber: true } : undefined)} />
          ))}
          <FormField error={form.formState.errors.role?.message} label="Роль в проекте" required>
            <SelectInput options={roleOptions} {...form.register("role")} />
          </FormField>
          <div className="self-end"><SubmitRow busy={form.formState.isSubmitting} feedback={feedback} label="Сохранить" onRefresh={() => router.refresh()} pendingLabel="Сохраняем…" variant="outline" /></div>
        </form>
        <form className="border-t border-border pt-4" onSubmit={remove}>
          <input type="hidden" {...removeForm.register("accessId")} />
          <input type="hidden" {...removeForm.register("organizationId")} />
          <input type="hidden" {...removeForm.register("version", { valueAsNumber: true })} />
          <SubmitRow busy={removeForm.formState.isSubmitting} feedback={removeFeedback} label="Отозвать доступ к проекту" onRefresh={() => router.refresh()} pendingLabel="Отзываем…" variant="ghost" />
        </form>
      </div>
    </SectionCard>
  );
}

export function SeoProjectAccessAdminForms({ items, options }: { items: SeoProjectAccessListItem[]; options: IdentityAdminFormOptions }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const firstMembership = options.memberships[0];
  const availableProjects = useMemo(() => options.projects.filter((project) => project.organizationId === firstMembership?.organizationId), [firstMembership?.organizationId, options.projects]);
  const form = useForm<CreateSeoProjectAccessInput>({
    resolver: zodResolver(createSeoProjectAccessInputSchema) as Resolver<CreateSeoProjectAccessInput>,
    defaultValues: {
      membershipId: firstMembership?.id ?? "",
      organizationId: firstMembership?.organizationId ?? "",
      projectId: availableProjects[0]?.id ?? "",
      role: "VIEWER",
    },
  });
  const selectedMembershipId = useWatch({ control: form.control, name: "membershipId" });
  const selectedMembership = options.memberships.find((membership) => membership.id === selectedMembershipId);
  const projects = options.projects.filter((project) => project.organizationId === selectedMembership?.organizationId);

  const submit = form.handleSubmit(async (values) => {
    const result = await createSeoProjectAccessAction(values);
    if (!result.ok) {
      applyFieldErrors(result.error.fieldErrors, form.setError);
      setFeedback(feedbackFrom(result));
      return;
    }
    setFeedback({ kind: "success", message: "Доступ к SEO-проекту выдан, прежние сеансы отозваны" });
    router.refresh();
  });

  return (
    <div className="space-y-4">
      <SectionCard title="Матрица доступа к SEO-проектам" description="Членство в организации не открывает проекты. Назначьте каждый проект явно.">
        <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" onSubmit={submit}>
          <FormField error={form.formState.errors.membershipId?.message} label="Пользователь и организация" required>
            <SelectInput options={options.memberships.map((option) => ({ value: option.id, label: option.label }))} {...form.register("membershipId", { onChange: (event) => {
              const membership = options.memberships.find((option) => option.id === event.target.value);
              const project = options.projects.find((option) => option.organizationId === membership?.organizationId);
              form.setValue("organizationId", membership?.organizationId ?? "");
              form.setValue("projectId", project?.id ?? "");
            } })} />
          </FormField>
          <FormField error={form.formState.errors.projectId?.message} label="Проект" required>
            <SelectInput options={projects.map((option) => ({ value: option.id, label: option.label }))} {...form.register("projectId")} />
          </FormField>
          <FormField error={form.formState.errors.role?.message} label="Роль" required>
            <SelectInput options={roleOptions} {...form.register("role")} />
          </FormField>
          <input type="hidden" {...form.register("organizationId")} />
          <div className="self-end"><SubmitRow busy={form.formState.isSubmitting} feedback={feedback} label="Выдать доступ" onRefresh={() => router.refresh()} pendingLabel="Сохраняем…" /></div>
        </form>
      </SectionCard>
      <div className="grid gap-4 xl:grid-cols-2">{items.map((item) => <AccessEditCard item={item} key={item.id} />)}</div>
    </div>
  );
}
