import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  align?: "left" | "center";
  actions?: ReactNode;
}

export function SectionHeader({ eyebrow, title, description, actions, align = "left" }: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" ? "text-center items-center" : ""
      )}
    >
      <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">{eyebrow}</span>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between w-full">
        <div className={cn("space-y-2", align === "center" ? "md:text-center" : "")}>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>
          <p className="text-muted-foreground text-sm md:text-base max-w-2xl">
            {description}
          </p>
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}


