interface GymzLogoProps {
  className?: string;
}

export function GymzLogo({ className = "" }: GymzLogoProps) {
  const base = typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/";
  const logoSrc = `${base}gymzLogo.png`;
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src={logoSrc}
        alt="Gymz Logo"
        className="max-h-full w-auto object-contain hover:scale-105 transition-transform cursor-pointer"
      />
    </div>
  );
}
