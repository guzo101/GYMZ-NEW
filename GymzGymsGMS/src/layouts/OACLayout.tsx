import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { BarChart3, LayoutDashboard, LogOut } from "lucide-react";

/**
 * Minimal shell for Owner Admin Console (platform / super admin only).
 * Not the gym-scoped GMS sidebar.
 */
export default function OACLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold tracking-tight text-primary">
              Owner Admin Console
            </span>
            <nav className="flex items-center gap-1 text-sm">
              <NavLink
                to="/oac/website-traffic"
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 rounded-md px-3 py-2 font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`
                }
              >
                <BarChart3 className="h-4 w-4" />
                Website traffic
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === "super_admin" && (
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
                <LayoutDashboard className="h-4 w-4 mr-1.5" />
                Gym dashboard
              </Button>
            )}
            <span className="hidden text-xs text-muted-foreground sm:inline max-w-[200px] truncate">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1.5" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
