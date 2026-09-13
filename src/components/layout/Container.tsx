import type { HTMLAttributes } from "react";
import { cn } from "../../shared/lib/cn.ts";

type ContainerProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "main";
  size?: "narrow" | "site" | "wide";
};

const widths = {
  narrow: "max-w-narrow",
  site: "max-w-site",
  wide: "max-w-wide",
} as const;

export function Container({ as: Component = "div", size = "wide", className, ...props }: ContainerProps) {
  return <Component className={cn("mx-auto w-full px-container sm:px-container-wide", widths[size], className)} {...props} />;
}
