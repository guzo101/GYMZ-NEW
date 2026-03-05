interface AppShowcaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Minimal placeholder to keep layout working.
export function AppShowcase({ open, onOpenChange }: AppShowcaseProps) {
  // Currently no UI; can be expanded later.
  if (!open) return null;
  onOpenChange(false);
  return null;
}
