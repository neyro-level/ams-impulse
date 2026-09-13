"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import type { NavigationSection } from "../../platform/navigation/types.ts";
import { Button } from "../ui/button.tsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet.tsx";
import { ShellNav } from "./ShellNav.tsx";
import { InstallAppButton } from "../pwa/InstallAppButton.tsx";

type MobileDrawerProps = {
  sections: NavigationSection[];
  currentPath: string;
};

export function MobileDrawer({ sections, currentPath }: MobileDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-expanded={open}
        aria-controls="mobile-report-nav"
        aria-label="Открыть навигацию"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" strokeWidth={1.8} aria-hidden />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          id="mobile-report-nav"
          className="left-0 top-0 flex h-dvh w-[min(86vw,320px)] translate-x-0 translate-y-0 flex-col rounded-none border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground data-ending-style:-translate-x-full data-starting-style:-translate-x-full lg:hidden"
        >
          <SheetHeader className="mb-4 flex flex-row items-center gap-2.5 rounded-panel border border-sidebar-border bg-sidebar-surface p-2 pr-12">
            <span className="grid size-10 shrink-0 place-items-center rounded bg-sidebar-ring text-brand-mark font-bold text-sidebar-foreground">АМС</span>
            <SheetTitle className="text-brand-name font-semibold text-sidebar-foreground">ИМПУЛЬС</SheetTitle>
            <SheetDescription className="sr-only">Навигация по отчётам и разделам кабинета</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto"><ShellNav sections={sections} currentPath={currentPath} onNavigate={() => setOpen(false)} /></div>
          <div className="border-t border-sidebar-border pt-3"><InstallAppButton /></div>
        </SheetContent>
      </Sheet>
    </>
  );
}
