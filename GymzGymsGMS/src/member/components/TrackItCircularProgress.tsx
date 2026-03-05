import { cn } from "@/lib/utils";

interface TrackItCircularProgressProps {
  value: number;
  label?: string;
}

export function TrackItCircularProgress({
  value,
  label,
}: TrackItCircularProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative h-24 w-24">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle
            className="text-muted stroke-current"
            strokeWidth="8"
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx="50"
            cy="50"
          />
          <circle
            className={cn(
              "text-primary stroke-current transition-all duration-300 ease-out"
            )}
            strokeWidth="8"
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx="50"
            cy="50"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold">{Math.round(clamped)}%</span>
        </div>
      </div>
      {label && (
        <p className="mt-2 text-xs font-medium text-muted-foreground">{label}</p>
      )}
    </div>
  );
}


