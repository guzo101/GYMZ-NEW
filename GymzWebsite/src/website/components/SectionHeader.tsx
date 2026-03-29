import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  eyebrow: string;
  title?: string;
  description?: string;
  align?: "left" | "center";
  actions?: ReactNode;
}

export function SectionHeader({ eyebrow, title, description, actions, align = "left" }: SectionHeaderProps) {
  const isCenter = align === "center";
  const hasTitle = Boolean(title?.trim());
  const hasDescription = Boolean(description?.trim());
  const hasBody = hasTitle || hasDescription || Boolean(actions);

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        isCenter ? "text-center items-center" : ""
      )}
    >
      <span className="text-section-eyebrow uppercase">{eyebrow}</span>
      {hasBody ? (
        <div
          className={cn(
            "w-full flex flex-col gap-3",
            isCenter ? "items-center" : "md:flex-row md:items-end md:justify-between"
          )}
        >
          <div className={cn("space-y-2", isCenter ? "text-center" : "")}>
            {hasTitle ? (
              <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-[0.08em]">{title}</h2>
            ) : null}
            {hasDescription ? (
              <p className={cn("text-muted-foreground text-sm md:text-base", isCenter ? "max-w-3xl mx-auto" : "max-w-2xl")}>
                {description}
              </p>
            ) : null}
          </div>
          {actions && <div className={cn("flex-shrink-0", isCenter ? "mt-2" : "")}>{actions}</div>}
        </div>
      ) : null}
    </div>
  );
}


