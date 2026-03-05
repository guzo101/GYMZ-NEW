import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
  subtitle?: string;
}

export function StatsCard({
  title,
  value,
  change,
  trend = "neutral",
  icon: Icon,
  iconColor = "bg-primary",
  subtitle
}: StatsCardProps) {
  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return "text-green-600";
      case "down":
        return "text-red-600";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <Card
      className="group hover:shadow-modern-lg transition-all duration-500 overflow-hidden border-border/40 hover:border-primary/20 hover:-translate-y-1.5 glass-card relative"
      style={{ minHeight: '140px', borderRadius: '16px' }}
    >
      {/* Absolute icon container - direct child of Card for TRUE corner positioning */}
      <div
        className="absolute top-2 right-2 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 bg-gradient-to-br from-primary to-primary-foreground/20 z-50 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)))'
        }}
      >
        <Icon className="text-white w-3.5 h-3.5" />
      </div>

      <CardContent className="p-5 flex flex-col justify-between h-full min-h-[140px]">
        <div className="w-full relative">
          <div className="flex-1 min-w-0 pr-16">
            {/* Title - align with calmer sidebar typography */}
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              {title}
            </p>
            <div className="flex items-baseline gap-2 flex-wrap">
              {/* Value - consistent size & weight for all cards */}
              <p className="text-2xl md:text-3xl font-medium text-foreground tracking-tight tabular-nums">
                {value}
              </p>
              {change && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${trend === "up" ? "bg-primary/10 text-primary" : trend === "down" ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"}`}>
                  {trend === "up" ? "+" : trend === "down" ? "-" : ""}{change}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="mt-2 text-[11px] font-normal text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Subtle background glow effect on hover */}
        <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors pointer-events-none" />
      </CardContent>
    </Card>
  );
}

