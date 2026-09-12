"use client";

import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "../ui/button.tsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet.tsx";

export function MobileFilterSheet({ children, title = "Фильтры" }: { children: ReactNode; title?: string }) {
  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger render={<Button type="button" variant="outline" className="w-full"><SlidersHorizontal aria-hidden />{title}</Button>} />
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription>Настройте список и примените выбранные значения.</SheetDescription></SheetHeader>
          <div className="mt-6">{children}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
