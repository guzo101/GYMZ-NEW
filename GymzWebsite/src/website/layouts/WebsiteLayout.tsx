import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GymzLogo } from "@/components/GymzLogo";
import { AppShowcase } from "../components/AppShowcase";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, MapPin, Phone, Mail } from "lucide-react";
import { contactChannels } from "../data/content";
import { Card, CardContent } from "@/components/ui/card";

type NavItem =
  | { label: string; href: string; isModal?: false }
  | { label: string; href: string; isModal: true };

const navItems: NavItem[] = [
  { label: "Programs", href: "#programs" },
  { label: "Results", href: "#results" },
  { label: "Pricing", href: "#pricing" },
  { label: "About", href: "#about" },
  { label: "App", href: "#app", isModal: true },
];

interface WebsiteLayoutProps {
  children: ReactNode;
}

export function WebsiteLayout({ children }: WebsiteLayoutProps) {
  const [appShowcaseOpen, setAppShowcaseOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary/30 text-foreground">
      <AppShowcase open={appShowcaseOpen} onOpenChange={setAppShowcaseOpen} />
      <header className="sticky top-0 z-50 bg-gradient-to-r from-white/90 via-white/95 to-white/90 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          {/* Logo */}
          <div className="flex items-center">
            <GymzLogo className="h-14 w-auto" />
          </div>

          {/* Main Navigation - Desktop */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium">
            {navItems.map((item) => (
              item.isModal ? (
                <button
                  key={item.label}
                  onClick={() => setAppShowcaseOpen(true)}
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
                  <GymzLogo className="h-12 w-auto" />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 mt-8">
                {navItems.map((item) => (
                  item.isModal ? (
                    <button
                      key={item.label}
                      onClick={() => {
                        setAppShowcaseOpen(true);
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
                  variant="ghost"
                  className="justify-start w-full min-h-[44px]"
                  onClick={() => {
                    navigate("/contact");
                    setMobileMenuOpen(false);
                  }}
                >
                  Contact
                </Button>
                <Button
                  className="bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))] w-full min-h-[44px]"
                  onClick={() => {
                    navigate("/contact?type=booking");
                    setMobileMenuOpen(false);
                  }}
                >
                  Get Started
                </Button>
              </nav>
            </SheetContent>
          </Sheet>

          {/* CTA Buttons - Desktop */}
          <div className="hidden lg:flex items-center gap-3">
            <Button
              variant="ghost"
              className="min-h-[44px]"
              onClick={() => navigate("/contact")}
            >
              Contact
            </Button>
            <Button
              className="bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))] shadow-lg hover:shadow-xl transition-all min-h-[44px]"
              onClick={() => navigate("/contact?type=booking")}
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>
      <main className="w-full overflow-x-hidden">
        {children}
      </main>
      <footer className="bg-gradient-to-br from-gray-50 to-primary/50 border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-6 py-12">
          {/* Contact Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {contactChannels.map((channel) => (
              <Card key={channel.label} className="border-gray-200/60 bg-white/50 backdrop-blur-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6 space-y-2">
                  <div className="flex items-center gap-3 text-[hsl(var(--primary))] mb-2">
                    {channel.label === "Visit" && <MapPin className="h-5 w-5" />}
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
                The gym that gets you results. Period.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-4">Programs</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <button
                    onClick={(e) => handleNavClick("#programs", e)}
                    className="hover:text-foreground transition-colors text-left min-h-[32px] flex items-center"
                  >
                    Training Programs
                  </button>
                </li>
                <li>
                  <button
                    onClick={(e) => handleNavClick("#programs", e)}
                    className="hover:text-foreground transition-colors text-left min-h-[32px] flex items-center"
                  >
                    Group Classes
                  </button>
                </li>
                <li>
                  <button
                    onClick={(e) => handleNavClick("#programs", e)}
                    className="hover:text-foreground transition-colors text-left min-h-[32px] flex items-center"
                  >
                    1-on-1 Coaching
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <button
                    onClick={(e) => handleNavClick("#about", e)}
                    className="hover:text-foreground transition-colors text-left min-h-[32px] flex items-center"
                  >
                    About Us
                  </button>
                </li>
                <li>
                  <button
                    onClick={(e) => handleNavClick("#results", e)}
                    className="hover:text-foreground transition-colors text-left min-h-[32px] flex items-center"
                  >
                    Success Stories
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate("/contact")}
                    className="hover:text-foreground transition-colors text-left min-h-[32px] flex items-center"
                  >
                    Contact
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <button
                    onClick={(e) => handleNavClick("#pricing", e)}
                    className="hover:text-foreground transition-colors text-left min-h-[32px] flex items-center"
                  >
                    Pricing
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate("/contact")}
                    className="hover:text-foreground transition-colors text-left min-h-[32px] flex items-center"
                  >
                    Get Help
                  </button>
                </li>
                <li>
                  <button
                    onClick={(e) => handleNavClick("#contact", e)}
                    className="hover:text-foreground transition-colors text-left min-h-[32px] flex items-center"
                  >
                    Contact Form
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Gymz. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

