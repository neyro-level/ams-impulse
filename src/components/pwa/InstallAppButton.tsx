"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip.tsx";
import styles from "../shell/SidebarControls.module.css";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallAppButton({ collapsed = false }: { collapsed?: boolean }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (standalone) return;
    let active = true;
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) queueMicrotask(() => { if (active) setIos(true); });
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    const installed = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => { active = false; window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", installed); };
  }, []);

  if (!prompt && !ios) return null;
  async function install() {
    if (!prompt) { setShowIosHelp(true); return; }
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }
  const button = <Button type="button" variant="ghost" size={collapsed ? "icon" : "sm"} className={collapsed ? `${styles.action} size-8 min-h-8` : `${styles.action} w-full justify-start`} onClick={install} aria-label="Установить приложение"><Download aria-hidden />{collapsed ? null : "Установить"}</Button>;
  return <>
    {collapsed ? <Tooltip><TooltipTrigger render={button} /><TooltipContent>Установить приложение</TooltipContent></Tooltip> : button}
    <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}><DialogContent><DialogHeader><DialogTitle>Установка на iPhone или iPad</DialogTitle><DialogDescription>Откройте меню «Поделиться» в Safari и выберите «На экран Домой».</DialogDescription></DialogHeader></DialogContent></Dialog>
  </>;
}
