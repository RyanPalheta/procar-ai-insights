import { ReactNode } from "react";
import { NavigationDock } from "./NavigationDock";
import logo from "@/assets/logo.png";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
        <div className="flex items-center gap-3">
          <img 
            src={logo} 
            alt="PROCAR Logo" 
            className="h-8 w-8"
          />
          <h1 className="text-lg font-semibold">PROCAR Dashboard</h1>
        </div>
      </header>
      <main className="flex-1 overflow-auto pb-32">
        <div className="p-6">{children}</div>
      </main>
      <NavigationDock />
    </div>
  );
}
