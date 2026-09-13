"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import type { ToolsProjectOption } from "../../../modules/tools-workspace/index.ts";
import { Button } from "../../../components/ui/button.tsx";
import { NativeSelect, NativeSelectOption } from "../../../components/ui/native-select.tsx";

export function WorkspacePicker({ options, organizationId, projectId }: { options: ToolsProjectOption[]; organizationId: string; projectId: string }) {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(organizationId);
  const projects = options.filter((item) => item.organizationId === selectedOrganizationId);
  const selectedProjectId = projects.some((item) => item.id === projectId) ? projectId : projects[0]?.id;
  return <form className="grid gap-3 border-b border-border pb-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
    <NativeSelect name="organizationId" value={selectedOrganizationId} onChange={(event) => setSelectedOrganizationId(event.target.value)} aria-label="Организация">
      {[...new Map(options.map((item) => [item.organizationId, item])).values()].map((item) => <NativeSelectOption key={item.organizationId} value={item.organizationId}>{item.organizationName}</NativeSelectOption>)}
    </NativeSelect>
    <NativeSelect name="projectId" key={selectedOrganizationId} defaultValue={selectedProjectId} aria-label="Проект">
      {projects.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}
    </NativeSelect>
    <Button type="submit" variant="outline"><Search aria-hidden />Открыть</Button>
  </form>;
}
