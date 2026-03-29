interface GymzLogoProps {
  className?: string;
}

export function GymzLogo({ className = "" }: GymzLogoProps) {
  return (
    <div className={`flex items-center ${className}`}>
      <img
        src="/gymzLogo.svg"
        alt="Gymz Logo"
        className="h-full w-full object-contain hover:scale-105 transition-transform cursor-pointer"
      />
    </div>
  );
}
