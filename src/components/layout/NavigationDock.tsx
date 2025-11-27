import { LayoutDashboard, Users, Phone, MessageSquare, Settings, FileText } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Dock, DockIcon, DockItem, DockLabel } from "@/components/ui/dock";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Chamadas", url: "/calls", icon: Phone },
  { title: "Interações", url: "/interactions", icon: MessageSquare },
  { title: "Configurações", url: "/settings", icon: Settings },
  { title: "Logs", url: "/logs", icon: FileText },
];

export function NavigationDock() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <Dock className="items-end pb-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.url);
          
          return (
            <DockItem
              key={item.title}
              className={`aspect-square rounded-full transition-colors cursor-pointer ${
                active 
                  ? 'bg-primary' 
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <div onClick={() => navigate(item.url)} className="w-full h-full">
                <DockLabel>{item.title}</DockLabel>
                <DockIcon>
                  <Icon className={`h-full w-full ${
                    active 
                      ? 'text-primary-foreground' 
                      : 'text-muted-foreground'
                  }`} />
                </DockIcon>
              </div>
            </DockItem>
          );
        })}
      </Dock>
    </div>
  );
}
