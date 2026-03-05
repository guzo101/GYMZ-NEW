import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Calendar,
  UserCheck,
  Activity,
  ScanLine,
  Settings,
  MessageSquare,
  Webhook,
  ClipboardList,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { GymzLogo } from "@/components/GymzLogo";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Community Chat Room", url: "/notice-board", icon: MessageSquare },
  { title: "Members", url: "/members", icon: Users },
  { title: "Finances", url: "/finances", icon: DollarSign },
  { title: "Private Classes", url: "/private-classes", icon: Calendar },
  { title: "Gym Calendar", url: "/admin/gym-calendar", icon: Calendar },
  { title: "Check-In & Verification", url: "/admin/checkin", icon: ScanLine },
  { title: "Staff", url: "/staff", icon: UserCheck },
  { title: "AI Chat", url: "/admin/ai-chat", icon: MessageSquare },
  { title: "AI Settings", url: "/admin/ai-settings", icon: Webhook },
  { title: "Settings", url: "/settings", icon: Settings },
];

const staffMenuItems = [
  { title: "Profile", url: "/staff/profile", icon: UserCheck },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const { user } = useAuth();

  const isActive = (path: string) => currentPath === path;
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <Sidebar className={collapsed ? "w-16" : "w-64"} collapsible="icon">
      <SidebarContent className="bg-[#ffffff] border-r border-sidebar-border shadow-modern-md" style={{ backgroundColor: '#ffffff' }}>
        {/* Logo and Brand */}
        <div className="p-6 border-b border-sidebar-border/50">
          <div className="flex items-center">
            <GymzLogo className="h-10 w-auto" />
          </div>
        </div>
        {/* User Profile */}
        <div className="p-6 border-b border-sidebar-border/50">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 ring-2 ring-primary/20">
              <AvatarFallback className="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))] text-primary-foreground font-semibold shadow-modern">{initials}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate" style={{ color: '#1a1a1a', fontSize: '14px', fontWeight: 500 }}>{user?.name || 'Guest'}</div>
                <div className="text-xs font-medium" style={{ color: '#1a1a1a', opacity: 0.7 }}>{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ''}</div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Menu */}
        <SidebarGroup>
          <SidebarGroupContent className="px-3 py-4">
            <SidebarMenu>
              {(user?.role === "staff" ? staffMenuItems : menuItems).map((item) => {
                const isItemActive = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className={isItemActive
                          ? "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary))] text-white shadow-modern-md font-medium"
                          : "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-[#1a1a1a] hover:bg-sidebar-accent hover:translate-x-1"
                        }
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: isItemActive ? '#ffffff' : '#1a1a1a'
                        }}
                      >
                        <item.icon className="h-5 w-5" style={{ color: isItemActive ? '#ffffff' : '#1a1a1a' }} />
                        {!collapsed && <span style={{ color: isItemActive ? '#ffffff' : '#1a1a1a', fontSize: '14px', fontWeight: 500 }}>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
