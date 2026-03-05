import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarHeader,
  SidebarFooter,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
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
  Bot,
  ShieldAlert,
  Mail,
  Bell,
  Ticket,
  BarChart3,
  Award,
  Globe,
  Settings2,
  ChevronDown,
  CheckCircle2,
  UserX
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { GymzLogo } from "@/components/GymzLogo";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton } from "@/components/ui/sidebar";

const menuItems = [
  // Core operations
  { group: "core", title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { group: "core", title: "Members", url: "/members", icon: Users },
  { group: "core", title: "Deleted Accounts", url: "/admin/deleted-accounts", icon: UserX },
  { group: "core", title: "Finances", url: "/finances", icon: DollarSign },
  { group: "core", title: "Check-In & Verification", url: "/admin/checkin", icon: ScanLine },
  { group: "core", title: "Rooms Management", url: "/admin/rooms", icon: Users },
  { group: "core", title: "Staff", url: "/staff", icon: UserCheck },

  // Growth & communication
  { group: "growth", title: "Community Chat Room", url: "/notice-board", icon: MessageSquare },
  {
    group: "growth",
    title: "Events & Sponsors",
    icon: Ticket,
    subItems: [
      { title: "Gym Calendar", url: "/admin/gym-calendar", icon: Calendar },
      { title: "Outdoor CRM", url: "/admin/outdoor-crm", icon: Users },
      { title: "Event Management", url: "/admin/events", icon: Ticket },
      { title: "Sign-up Management", url: "/admin/event-rsvps", icon: CheckCircle2 },
      { title: "Event Analytics", url: "/admin/event-analytics", icon: BarChart3 },
      { title: "Sponsors & Ads", url: "/admin/sponsors", icon: Award },
      { title: "Sponsor Reports", url: "/admin/sponsor-reports", icon: ClipboardList },
    ]
  },

  // System & AI
  {
    group: "system",
    title: "AI Tools",
    icon: Bot,
    subItems: [
      { title: "AI Chat", url: "/admin/ai-chat", icon: MessageSquare },
      { title: "AI Settings", url: "/admin/ai-settings", icon: Webhook },
      { title: "AI & Notifications", url: "/admin/ai-notifications", icon: Bell },
      { title: "Sent Notifications", url: "/admin/sent-notifications", icon: Mail },
      { title: "Outreach Queue", url: "/admin/growth-queue", icon: Bot },
    ]
  },
  { group: "system", title: "Limited Access", url: "/admin/limited-access", icon: ShieldAlert },
  { group: "system", title: "Support Inquiries", url: "/admin/inquiries", icon: Mail },
  { group: "system", title: "Platform Admin", url: "/admin/platform", icon: Globe },
  { group: "system", title: "Settings", url: "/settings", icon: Settings },
];

const staffMenuItems = [
  { title: "Dashboard", url: "/staff/dashboard", icon: LayoutDashboard },
  { title: "Members", url: "/staff/members", icon: Users },
  { title: "Deleted Accounts", url: "/staff/deleted-accounts", icon: UserX },
  { title: "Finances", url: "/staff/finances", icon: DollarSign },
  { title: "Check-In & Verification", url: "/staff/checkin", icon: ScanLine },
  { title: "Rooms Management", url: "/staff/rooms", icon: Users },
  { title: "Community Chat Room", url: "/staff/notice-board", icon: MessageSquare },
  { title: "Profile", url: "/staff/profile", icon: UserCheck },
  { title: "Settings", url: "/staff/settings", icon: Settings },
];

interface AppSidebarProps {
  className?: string;
}

export function AppSidebar({ className }: AppSidebarProps) {
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
    <Sidebar className="border-none" collapsible="icon">
      <div className="flex-1 flex flex-col bg-transparent backdrop-blur-md border-r border-sidebar-border/30 h-full overflow-hidden transition-all duration-300">
        {/* Logo and Brand */}
        <SidebarHeader className={`border-b border-sidebar-border/50 flex items-center justify-center transition-all ${collapsed ? "p-4" : "p-6"}`}>
          <div className={`flex items-center gap-3 transition-all overflow-hidden justify-center w-full`}>
            <GymzLogo className={`${collapsed ? "h-10 w-auto" : "h-12 w-auto"} transition-all duration-300 flex-shrink-0`} />
          </div>
        </SidebarHeader>

        {/* Navigation Menu */}
        <SidebarContent className="bg-transparent flex-1">
          <SidebarGroup className={collapsed ? "p-0 py-4" : "p-2"}>
            <SidebarGroupContent>
              <SidebarMenu>
                {(user?.role === "staff" ? staffMenuItems : menuItems).map((item, index, arr) => {
                  const isItemActive = item.url ? isActive(item.url) : item.subItems?.some(sub => isActive(sub.url));
                  // Small visual separation between logical groups for admins,
                  // while keeping staff layout unchanged.
                  const isFirstOfGroup = index === 0 || (item.group && item.group !== arr[index - 1]?.group);

                  if (item.subItems) {
                    return (
                      <Collapsible
                        key={item.title}
                        asChild
                        defaultOpen={item.subItems.some(sub => isActive(sub.url))}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem className={`px-2 py-0.5 ${isFirstOfGroup ? "mt-2" : ""}`}>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              tooltip={collapsed ? item.title : undefined}
                              className={`transition-all duration-200 ${collapsed ? "justify-center !p-0 aspect-square h-9 w-9 rounded-xl" : ""}`}
                            >
                              <div className={`${collapsed ? "justify-center px-0" : "gap-3 px-3"} flex items-center py-2.5 rounded-xl w-full transition-all duration-200 ${isItemActive && collapsed ? "bg-primary text-white" : ""}`}>
                                <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                                {!collapsed && (
                                  <>
                                    <span className="truncate text-sm font-medium flex-1 text-left">{item.title}</span>
                                    <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                                  </>
                                )}
                              </div>
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            {!collapsed && (
                              <SidebarMenuSub className="ml-9 border-l border-sidebar-border/50 mt-1">
                                {item.subItems.map((subItem) => (
                                  <SidebarMenuSubItem key={subItem.title}>
                                    <SidebarMenuSubButton asChild isActive={isActive(subItem.url)}>
                                      <NavLink
                                        to={subItem.url}
                                        className={({ isActive }) =>
                                          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${isActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"}`
                                        }
                                      >
                                        <subItem.icon className="h-4 w-4" />
                                        <span>{subItem.title}</span>
                                      </NavLink>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))}
                              </SidebarMenuSub>
                            )}
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }

                  return (
                    <SidebarMenuItem
                      key={item.title}
                      className={`flex justify-center px-2 py-0.5 ${isFirstOfGroup ? "mt-2" : ""}`}
                    >
                      <SidebarMenuButton
                        asChild
                        tooltip={collapsed ? item.title : undefined}
                        className={`transition-all duration-200 ${collapsed ? "justify-center !p-0 aspect-square h-9 w-9 rounded-xl" : ""}`}
                      >
                        <NavLink
                          to={item.url}
                          end
                          className={`${collapsed ? "justify-center px-0" : "gap-3 px-3"} flex items-center py-2.5 rounded-xl w-full transition-all duration-200 ${isItemActive
                            ? "bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary))] text-white shadow-modern-md font-medium"
                            : "text-foreground hover:bg-sidebar-accent hover:translate-x-0.5"
                            }`}
                        >
                          <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                          {!collapsed && (
                            <span className="truncate animate-in fade-in slide-in-from-left-1 duration-300 text-sm font-medium">
                              {item.title}
                            </span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>


      </div>
    </Sidebar>
  );
}
