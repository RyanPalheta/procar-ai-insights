import { LayoutDashboard, Users, Phone, Settings, FileText, Monitor, LogOut, UserCog, UserCheck, Megaphone, BarChart3 } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const VIEWED_LEADS_KEY = "procar_viewed_leads";

// Navigation structure organized by sections
const navigationSections = [
  {
    label: "PRINCIPAL",
    items: [
      { title: "Visão Geral", url: "/", icon: LayoutDashboard },
      { title: "Leads", url: "/leads", icon: Users, showUnviewedCount: true },
      { title: "Vendedores", url: "/sellers", icon: UserCheck },
      { title: "Painel 360°", url: "/tv", icon: Monitor },
    ],
  },
  {
    label: "ANÁLISES",
    items: [
      { title: "Chamadas", url: "/calls", icon: Phone },
      { title: "Meta Ads", url: "/meta-ads", icon: Megaphone },
      { title: "Google Ads", url: "/google-ads", icon: BarChart3 },
    ],
  },
  {
    label: "CONFIGURAÇÕES",
    items: [
      { title: "Usuários", url: "/users", icon: UserCog },
      { title: "Configurações", url: "/settings", icon: Settings },
      { title: "Logs", url: "/logs", icon: FileText },
    ],
  },
];

function SidebarInner() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { state } = useSidebar();
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
    <>
      <SidebarHeader className={cn("px-4 py-4", collapsed && "px-2 py-3")}>
        {collapsed ? (
          <div className="flex justify-center">
            <SidebarTrigger className="text-sidebar-foreground/50 hover:text-sidebar-foreground" />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="PROCAR Logo"
                className="h-8 w-8 flex-shrink-0 object-contain"
              />
              <div>
                <h2 className="font-semibold text-sm tracking-tight text-sidebar-foreground leading-none">PROCAR</h2>
                <p className="text-[10px] text-sidebar-foreground/50 font-medium mt-0.5">Dashboard</p>
              </div>
            </div>
            <SidebarTrigger className="text-sidebar-foreground/50 hover:text-sidebar-foreground" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {navigationSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-[0.1em] px-4 mb-1">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent className={cn("px-2", collapsed && "px-1")}>
              <SidebarMenu className="space-y-0.5">
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className={cn(
                        "rounded-lg transition-all duration-150",
                        isActive(item.url)
                          ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <NavLink
                        to={item.url}
                        end
                        className={cn(
                          "flex items-center gap-3 px-3 py-2",
                          !collapsed && "justify-between"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="h-[18px] w-[18px] shrink-0" />
                          {!collapsed && <span className="text-[13px]">{item.title}</span>}
                        </div>
                        {!collapsed && item.showUnviewedCount && unviewedCount > 0 && (
                          <Badge
                            variant="destructive"
                            className="text-[10px] px-1.5 py-0 h-[18px] min-w-[24px] justify-center rounded-full font-medium"
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
      <SidebarFooter className={cn("border-t border-sidebar-border p-4", collapsed && "p-2")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={async () => { await signOut(); navigate("/login"); }}
                className="flex justify-center w-full"
                title="Sair"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-xs font-semibold">
                    {user?.email?.substring(0, 2).toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{user?.email?.split("@")[0] ?? "Usuário"}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src="" />
              <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary text-xs font-semibold">
                {user?.email?.substring(0, 2).toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-sidebar-foreground truncate">{user?.email?.split("@")[0] ?? "Usuário"}</p>
              <p className="text-[11px] text-sidebar-foreground/50 truncate">{user?.email ?? ""}</p>
            </div>
            <button
              onClick={async () => { await signOut(); navigate("/login"); }}
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              title="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </>
  );
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/60">
      <SidebarInner />
    </Sidebar>
  );
}
