import { Link, useLocation } from "wouter";
import { Activity, BrainCircuit, Database, MessageSquare, LayoutDashboard, Globe, Settings } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Chat", icon: MessageSquare },
    { href: "/search", label: "Search", icon: Globe },
    { href: "/memories", label: "Memories", icon: BrainCircuit },
    { href: "/documents", label: "Documents", icon: Database },
    { href: "/events", label: "Events", icon: Activity },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col">
        <div className="h-14 flex items-center px-4 border-b border-border">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center mr-3">
            <BrainCircuit className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-sm tracking-wide">NEXUS AGENT</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => {
              const active = location === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      active 
                        ? "bg-sidebar-primary/10 text-sidebar-primary" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <item.icon className="w-4 h-4 mr-3" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
