"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Shield,
  ClipboardList,
  Settings,
  CreditCard,
  ChevronDown,
  Check,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/members", label: "Members", icon: Users },
  { href: "/dashboard/roles", label: "Roles", icon: Shield },
  { href: "/dashboard/audit", label: "Audit Log", icon: ClipboardList },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
];

const workspaces = [
  { id: "1", name: "Acme Corp", plan: "Pro" as const },
  { id: "2", name: "Startup Inc", plan: "Indie" as const },
  { id: "3", name: "Side Project", plan: "Free" as const },
];

const planColors = {
  Free: "bg-slate-700 text-slate-300",
  Indie: "bg-violet-900 text-violet-300",
  Pro: "bg-violet-600 text-white",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [activeWorkspace, setActiveWorkspace] = useState(workspaces[0]);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-300 lg:static lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Workspace Switcher */}
        <div className="relative border-b border-slate-800 p-4">
          <button
            onClick={() => setWorkspaceOpen((v) => !v)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-800 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-600 text-sm font-bold text-white">
              {activeWorkspace.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-slate-100">
                {activeWorkspace.name}
              </p>
              <span
                className={cn(
                  "inline-block rounded px-1.5 py-0.5 text-xs font-medium",
                  planColors[activeWorkspace.plan]
                )}
              >
                {activeWorkspace.plan}
              </span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-slate-400 transition-transform",
                workspaceOpen && "rotate-180"
              )}
            />
          </button>

          {workspaceOpen && (
            <div className="absolute left-4 right-4 top-full z-10 mt-1 rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    setActiveWorkspace(ws);
                    setWorkspaceOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-700 transition-colors"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded bg-violet-600 text-xs font-bold text-white">
                    {ws.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm text-slate-200">{ws.name}</p>
                    <span
                      className={cn(
                        "inline-block rounded px-1.5 py-0.5 text-xs",
                        planColors[ws.plan]
                      )}
                    >
                      {ws.plan}
                    </span>
                  </div>
                  {activeWorkspace.id === ws.id && (
                    <Check className="h-4 w-4 text-violet-400" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1 p-4">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-violet-600/20 text-violet-400"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-medium text-slate-300">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-slate-200">
                Jane Doe
              </p>
              <p className="truncate text-xs text-slate-500">jane@example.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="flex items-center gap-4 border-b border-slate-800 bg-slate-900 px-4 py-3 lg:hidden">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="text-slate-400 hover:text-slate-200"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-slate-200">TeamKit</span>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
