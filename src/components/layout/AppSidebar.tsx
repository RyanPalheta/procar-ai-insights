import { LayoutDashboard, Users, Phone, MessageSquare, Settings, FileText, ChevronLeft, BarChart3, HelpCircle } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

// Navigation structure organized by sections
const navigationSections = [
  {
    label: "PRINCIPAL",
    items: [
      { title: "Visão Geral", url: "/", icon: LayoutDashboard },
      { title: "Leads", url: "/leads", icon: Users, showCount: true },
      { title: "Conversas", url: "/interactions", icon: MessageSquare },
    ],
  },
  {
    label: "ANÁLISES",
    items: [
      { title: "Chamadas", url: "/calls", icon: Phone },
    ],
  },
  {
    label: "CONFIGURAÇÕES",
    items: [
      { title: "Configurações", url: "/settings", icon: Settings },
      { title: "Logs", url: "/logs", icon: FileText },
    ],
  },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";

  // Fetch leads count
  const { data: leadsCount } = useQuery({
    queryKey: ["leads-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("lead_db")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={logo} 
              alt="PROCAR Logo" 
              className="h-10 w-10 flex-shrink-0 object-contain"
            />
            {!collapsed && (
              <div className="flex-shrink-0">
                <h2 className="font-bold text-lg">PROCAR</h2>
                <p className="text-xs text-muted-foreground">Dashboard</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              aria-label="Colapsar menu"
            >
              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navigationSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent className="px-2">
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      className={cn(
                        "rounded-xl transition-all",
                        isActive(item.url)
                          ? "bg-primary text-primary-foreground font-medium shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <NavLink
                        to={item.url}
                        end
                        className="flex items-center justify-between gap-3 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="h-5 w-5" />
                          {!collapsed && <span>{item.title}</span>}
                        </div>
                        {/* Count badge for Leads */}
                        {!collapsed && item.showCount && leadsCount !== undefined && (
                          <Badge 
                            variant={isActive(item.url) ? "secondary" : "outline"} 
                            className={cn(
                              "text-xs px-2 py-0.5 h-5 min-w-[28px] justify-center",
                              isActive(item.url) && "bg-primary-foreground/20 text-primary-foreground border-0"
                            )}
                          >
                            {leadsCount > 999 ? "999+" : leadsCount}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* User Profile Footer */}
      {!collapsed && (
        <SidebarFooter className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                AD
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Administrador</p>
              <p className="text-xs text-muted-foreground truncate">admin@procar.com</p>
            </div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
