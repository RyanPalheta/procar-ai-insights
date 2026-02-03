import { LayoutDashboard, Users, Phone, Settings, FileText, ChevronLeft } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useMemo } from "react";
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

const VIEWED_LEADS_KEY = "procar_viewed_leads";

// Navigation structure organized by sections
const navigationSections = [
  {
    label: "PRINCIPAL",
    items: [
      { title: "Visão Geral", url: "/", icon: LayoutDashboard },
      { title: "Leads", url: "/leads", icon: Users, showUnviewedCount: true },
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
  
  // Track viewed leads in localStorage
  const [viewedLeads, setViewedLeads] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(VIEWED_LEADS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Fetch all lead session_ids
  const { data: leads } = useQuery({
    queryKey: ["leads-for-badge"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_db")
        .select("session_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Calculate unviewed leads count
  const unviewedCount = useMemo(() => {
    if (!leads) return 0;
    const allSessionIds = leads.map(l => l.session_id);
    const unviewed = allSessionIds.filter(id => !viewedLeads.includes(id));
    return unviewed.length;
  }, [leads, viewedLeads]);

  // Mark all leads as viewed when navigating to /leads
  useEffect(() => {
    if (location.pathname === "/leads" && leads && leads.length > 0) {
      const allSessionIds = leads.map(l => l.session_id);
      const newViewedLeads = [...new Set([...viewedLeads, ...allSessionIds])];
      
      // Only update if there are new leads to mark as viewed
      if (newViewedLeads.length > viewedLeads.length) {
        setViewedLeads(newViewedLeads);
        localStorage.setItem(VIEWED_LEADS_KEY, JSON.stringify(newViewedLeads));
      }
    }
  }, [location.pathname, leads]);

  // Clean up old viewed leads (keep only existing ones)
  useEffect(() => {
    if (leads && viewedLeads.length > 0) {
      const existingIds = new Set(leads.map(l => l.session_id));
      const validViewedLeads = viewedLeads.filter(id => existingIds.has(id));
      
      if (validViewedLeads.length !== viewedLeads.length) {
        setViewedLeads(validViewedLeads);
        localStorage.setItem(VIEWED_LEADS_KEY, JSON.stringify(validViewedLeads));
      }
    }
  }, [leads]);

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
                        {/* Unviewed leads count badge */}
                        {!collapsed && item.showUnviewedCount && unviewedCount > 0 && (
                          <Badge 
                            variant="destructive"
                            className="text-xs px-2 py-0.5 h-5 min-w-[28px] justify-center animate-pulse"
                          >
                            {unviewedCount > 99 ? "99+" : unviewedCount}
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
