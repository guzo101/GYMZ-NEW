import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GymzLogo } from "@/components/GymzLogo";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Globe, Phone, Mail } from "lucide-react";
import { contactChannels } from "../data/content";
import { Card, CardContent } from "@/components/ui/card";

type NavItem = {
  label: string;
  href: string;
  /** Apps: subtle “coming soon” toast instead of navigation */
  isComingSoon?: boolean;
};

/** Anchors: home sections in `website/pages/Home.tsx`; `#contact` is on the layout footer. */
const navItems: NavItem[] = [
  { label: "Platform", href: "#about" },
  { label: "What you get", href: "#proof" },
  { label: "Waitlist", href: "#waitlist" },
  { label: "Contact us", href: "#contact" },
  { label: "Apps", href: "#app", isComingSoon: true },
];

interface WebsiteLayoutProps {
  children: ReactNode;
}

const APPS_HINT_VISIBLE_MS = 2000;
const APPS_HINT_FADE_MS = 280;

export function WebsiteLayout({ children }: WebsiteLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [appsHint, setAppsHint] = useState<{
    top: number;
    left: number;
    leaving: boolean;
  } | null>(null);
  const appsHintFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appsHintRemoveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const clearAppsHintTimers = () => {
    if (appsHintFadeTimeoutRef.current) {
      clearTimeout(appsHintFadeTimeoutRef.current);
      appsHintFadeTimeoutRef.current = null;
    }
    if (appsHintRemoveTimeoutRef.current) {
      clearTimeout(appsHintRemoveTimeoutRef.current);
      appsHintRemoveTimeoutRef.current = null;
    }
  };

  const showAppsComingSoonNear = (target: HTMLElement) => {
    clearAppsHintTimers();
    const r = target.getBoundingClientRect();
    setAppsHint({
      top: r.bottom + 8,
      left: r.left + r.width / 2,
      leaving: false,
    });
    appsHintFadeTimeoutRef.current = setTimeout(() => {
      setAppsHint((prev) => (prev ? { ...prev, leaving: true } : null));
      appsHintRemoveTimeoutRef.current = setTimeout(() => {
        setAppsHint(null);
        appsHintRemoveTimeoutRef.current = null;
      }, APPS_HINT_FADE_MS);
      appsHintFadeTimeoutRef.current = null;
    }, APPS_HINT_VISIBLE_MS);
  };

  useEffect(() => {
    return () => clearAppsHintTimers();
  }, []);

  const handleNavClick = (href: string, e?: React.MouseEvent, closeMenu = false) => {
    if (href.startsWith("#")) {
      e?.preventDefault();
      const element = document.querySelector(href);
      if (element) {
        // Calculate offset for sticky header (approximately 80px)
        const headerOffset = 80;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
      }
      if (closeMenu) {
        setMobileMenuOpen(false);
      }
    } else {
      navigate(href);
      if (closeMenu) {
        setMobileMenuOpen(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-white to-cream/30 text-foreground">
      {appsHint &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className={`pointer-events-none fixed z-[200] transition-opacity duration-300 ease-out ${
              appsHint.leaving ? "opacity-0" : "animate-in fade-in zoom-in-95 duration-200 opacity-100"
            }`}
            style={{
              top: appsHint.top,
              left: appsHint.left,
              transform: "translateX(-50%)",
            }}
          >
            <div className="whitespace-nowrap rounded-md border border-border/35 bg-background/92 px-3 py-1.5 text-[13px] font-normal tracking-wide text-muted-foreground shadow-sm backdrop-blur-sm">
              Coming soon
            </div>
          </div>,
          document.body,
        )}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md" aria-label="Gymz home">
              <GymzLogo className="h-14 w-auto" />
            </Link>
          </div>

          {/* Main Navigation - Desktop */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium">
            {navItems.map((item) => (
              item.isComingSoon ? (
                <button
                  key={item.label}
                  type="button"
                  onClick={(e) => showAppsComingSoonNear(e.currentTarget)}
                  className="text-foreground hover:text-[hsl(var(--primary))] transition-colors py-2 px-1 min-h-[44px] flex items-center"
                >
                  {item.label}
                </button>
              ) : (
                <button
                  key={item.label}
                  onClick={(e) => handleNavClick(item.href, e)}
                  className="text-foreground hover:text-[hsl(var(--primary))] transition-colors cursor-pointer py-2 px-1 min-h-[44px] flex items-center"
                >
                  {item.label}
                </button>
              )
            ))}
          </nav>

          {/* Mobile Menu Button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle className="flex items-center">
                  <Link to="/" onClick={() => setMobileMenuOpen(false)} className="inline-flex" aria-label="Gymz home">
                    <GymzLogo className="h-12 w-auto" />
                  </Link>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 mt-8">
                {navItems.map((item) => (
                  item.isComingSoon ? (
                    <button
                      key={item.label}
                      type="button"
                      onClick={(e) => {
                        showAppsComingSoonNear(e.currentTarget);
                        setMobileMenuOpen(false);
                      }}
                      className="text-left text-foreground hover:text-[hsl(var(--primary))] transition-colors py-3 px-4 rounded-lg hover:bg-gray-100 min-h-[44px] flex items-center font-medium"
                    >
                      {item.label}
                    </button>
                  ) : (
                    <button
                      key={item.label}
                      onClick={(e) => handleNavClick(item.href, e, true)}
                      className="text-left text-foreground hover:text-[hsl(var(--primary))] transition-colors py-3 px-4 rounded-lg hover:bg-gray-100 min-h-[44px] flex items-center font-medium"
                    >
                      {item.label}
                    </button>
                  )
                ))}
                <div className="border-t border-gray-200 my-4" />
                <Button
                  className="bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))] w-full min-h-[44px]"
                  onClick={(e) => {
                    handleNavClick("#waitlist", e, true);
                  }}
                >
                  Join waitlist
                </Button>
              </nav>
            </SheetContent>
          </Sheet>

          {/* Primary CTA — waitlist only; proof & contact live in the nav */}
          <div className="hidden lg:flex items-center gap-3">
            <Button
              variant="outline"
              className="min-h-[44px] bg-white text-[hsl(var(--primary))] border-[hsl(var(--primary))/0.35] hover:bg-[hsl(var(--primary))/0.08] hover:text-[hsl(var(--primary))]"
              onClick={(e) => handleNavClick("#waitlist", e)}
            >
              Join waitlist
            </Button>
          </div>
        </div>
      </header>
      <main className="w-full overflow-x-hidden">
        {children}
      </main>
      <footer id="contact" className="scroll-mt-20 bg-gradient-to-br from-muted to-cream/35 border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <p className="mb-10 text-center text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground/90">
            Contact us
          </p>
          {/* Contact Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {contactChannels.map((channel) => (
              <Card key={channel.label} className="border-gray-200/60 bg-white/50 backdrop-blur-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6 space-y-2">
                  <div className="flex items-center gap-3 text-[hsl(var(--primary))] mb-2">
                    {channel.label === "Website" && <Globe className="h-5 w-5" />}
                    {channel.label === "Call" && <Phone className="h-5 w-5" />}
                    {channel.label === "Email" && <Mail className="h-5 w-5" />}
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{channel.label}</p>
                  </div>
                  <p className="font-bold text-lg">{channel.detail}</p>
                  <p className="text-sm text-muted-foreground">{channel.helper}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center mb-4">
                <GymzLogo className="h-12 w-auto" />
              </div>
              <p className="text-sm text-muted-foreground">
                One ecosystem for gym operations, coaching, member engagement, and smart machine data.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <button
                    onClick={(e) => handleNavClick("#about", e)}
                    className="hover:text-foreground transition-colors text-left min-h-[32px] flex items-center"
                  >
                    Platform overview
                  </button>
                </li>
                <li>
                  <button
                    onClick={(e) => handleNavClick("#proof", e)}
                    className="hover:text-foreground transition-colors text-left min-h-[32px] flex items-center"
                  >
                    What you get
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-4">Operators</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <button
                    onClick={(e) => handleNavClick("#about", e)}
                    className="hover:text-foreground transition-colors text-left min-h-[32px] flex items-center"
                  >
                    How we work
                  </button>
                </li>
                <li>
                  <button
                    onClick={(e) => handleNavClick("#proof", e)}
                    className="hover:text-foreground transition-colors text-left min-h-[32px] flex items-center"
                  >
                    What you get
                  </button>
                </li>
                <li>
                  <button
                    onClick={(e) => handleNavClick("#waitlist", e)}
                    className="hover:text-foreground transition-colors text-left min-h-[32px] flex items-center"
                  >
                    Join waitlist
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <button
                    onClick={(e) => handleNavClick("#contact", e)}
                    className="hover:text-foreground transition-colors text-left min-h-[32px] flex items-center"
                  >
                    Contact us
                  </button>
                </li>
                <li>
                  <button
                    onClick={(e) => handleNavClick("#waitlist", e)}
                    className="hover:text-foreground transition-colors text-left min-h-[32px] flex items-center"
                  >
                    Join waitlist
                  </button>
                </li>
                <li>
                  <button
                    onClick={(e) => handleNavClick("#proof", e)}
                    className="hover:text-foreground transition-colors text-left min-h-[32px] flex items-center"
                  >
                    What you get
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Gymz. All rights reserved.
            </p>
            <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm" aria-label="Legal">
              <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline">
                Privacy Policy
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

