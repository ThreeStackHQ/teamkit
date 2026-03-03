"use client";

import { useState } from "react";
import * as Select from "@radix-ui/react-select";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ChevronDown, Check, Download, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type EventCategory = "member" | "role" | "invite";
type EventSentiment = "added" | "removed" | "changed";

interface AuditEvent {
  id: string;
  category: EventCategory;
  sentiment: EventSentiment;
  action: string;
  actor: string;
  actorInitials: string;
  resource: string;
  relativeTime: string;
  absoluteTime: string;
  ipAddress?: string;
}

const categoryIcon: Record<EventCategory, string> = {
  member: "👤",
  role: "🔑",
  invite: "📧",
};

const sentimentBorder: Record<EventSentiment, string> = {
  added: "border-l-green-500",
  removed: "border-l-red-500",
  changed: "border-l-yellow-500",
};

const sentimentBg: Record<EventSentiment, string> = {
  added: "bg-green-500/5",
  removed: "bg-red-500/5",
  changed: "bg-yellow-500/5",
};

const mockEvents: AuditEvent[] = [
  {
    id: "1",
    category: "member",
    sentiment: "added",
    action: "Added member to workspace",
    actor: "Jane Doe",
    actorInitials: "JD",
    resource: "alice@example.com",
    relativeTime: "2 mins ago",
    absoluteTime: "Mar 3, 2024 at 20:47 UTC",
    ipAddress: "192.168.1.1",
  },
  {
    id: "2",
    category: "role",
    sentiment: "changed",
    action: "Changed role from member → admin",
    actor: "Jane Doe",
    actorInitials: "JD",
    resource: "alice@example.com",
    relativeTime: "15 mins ago",
    absoluteTime: "Mar 3, 2024 at 20:34 UTC",
    ipAddress: "192.168.1.1",
  },
  {
    id: "3",
    category: "invite",
    sentiment: "added",
    action: "Sent invite",
    actor: "Alice Smith",
    actorInitials: "AS",
    resource: "charlie@example.com",
    relativeTime: "1 hour ago",
    absoluteTime: "Mar 3, 2024 at 19:49 UTC",
    ipAddress: "10.0.0.2",
  },
  {
    id: "4",
    category: "member",
    sentiment: "removed",
    action: "Removed member from workspace",
    actor: "Jane Doe",
    actorInitials: "JD",
    resource: "dave@example.com",
    relativeTime: "3 hours ago",
    absoluteTime: "Mar 3, 2024 at 17:49 UTC",
    ipAddress: "192.168.1.1",
  },
  {
    id: "5",
    category: "invite",
    sentiment: "removed",
    action: "Cancelled invite",
    actor: "Alice Smith",
    actorInitials: "AS",
    resource: "eve@example.com",
    relativeTime: "Yesterday",
    absoluteTime: "Mar 2, 2024 at 14:20 UTC",
    ipAddress: "10.0.0.2",
  },
];

const ACTION_TYPES = ["All", "member", "role", "invite"];
const ACTORS = ["All", "Jane Doe", "Alice Smith", "Bob Johnson"];
const PAGE_SIZE = 10;

// Simulated plan — change to "pro" to unlock IP / CSV
const plan: "free" | "indie" | "pro" = "indie";

export default function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState("All");
  const [actorFilter, setActorFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const filtered = mockEvents.filter((e) => {
    const matchesAction =
      actionFilter === "All" || e.category === actionFilter;
    const matchesActor =
      actorFilter === "All" || e.actor === actorFilter;
    return matchesAction && matchesActor;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExportCSV = () => {
    if (plan !== "pro") {
      setShowUpgradePrompt(true);
      return;
    }
    const header = "timestamp,actor,action,resource,ip\n";
    const rows = filtered
      .map(
        (e) =>
          `"${e.absoluteTime}","${e.actor}","${e.action}","${e.resource}","${e.ipAddress ?? ""}"`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-log.csv";
    a.click();
  };

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Audit Log</h1>
            <p className="mt-1 text-sm text-slate-400">
              Immutable record of all workspace activity.
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              plan === "pro"
                ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                : "border border-slate-700 text-slate-500 cursor-pointer hover:bg-slate-800/50"
            )}
          >
            {plan !== "pro" && <Lock className="h-3.5 w-3.5" />}
            <Download className="h-4 w-4" />
            Export CSV
            {plan !== "pro" && (
              <span className="ml-1 rounded bg-violet-600/20 px-1.5 py-0.5 text-xs text-violet-400">
                Pro
              </span>
            )}
          </button>
        </div>

        {/* Upgrade Prompt */}
        {showUpgradePrompt && (
          <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-4 flex items-center justify-between">
            <p className="text-sm text-violet-300">
              CSV export is available on the <strong>Pro plan</strong>. Upgrade
              to unlock it.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowUpgradePrompt(false)}
                className="text-xs text-slate-400 hover:text-slate-300"
              >
                Dismiss
              </button>
              <a
                href="/dashboard/billing"
                className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 transition-colors"
              >
                Upgrade to Pro
              </a>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Action:</span>
            <SelectFilter
              value={actionFilter}
              options={ACTION_TYPES}
              onChange={(v) => { setActionFilter(v); setPage(1); }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Actor:</span>
            <SelectFilter
              value={actorFilter}
              options={ACTORS}
              onChange={(v) => { setActorFilter(v); setPage(1); }}
            />
          </div>
        </div>

        {/* Event Feed */}
        <div className="space-y-2">
          {paginated.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-12 text-center">
              <p className="text-sm text-slate-500">
                No events match your filters.
              </p>
            </div>
          ) : (
            paginated.map((event) => (
              <div
                key={event.id}
                className={cn(
                  "rounded-lg border border-slate-800 border-l-4 pl-4 pr-5 py-4 transition-colors hover:bg-slate-900/60",
                  sentimentBorder[event.sentiment],
                  sentimentBg[event.sentiment]
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Actor Avatar */}
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white">
                    {event.actorInitials}
                  </div>

                  {/* Event Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base leading-none">
                        {categoryIcon[event.category]}
                      </span>
                      <span className="text-sm font-medium text-slate-200">
                        {event.actor}
                      </span>
                      <span className="text-sm text-slate-400">
                        {event.action}
                      </span>
                      <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-slate-400">
                        {event.resource}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <span className="cursor-default text-xs text-slate-500 hover:text-slate-400 transition-colors">
                            {event.relativeTime}
                          </span>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            className="z-50 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 shadow-lg"
                            sideOffset={4}
                          >
                            {event.absoluteTime}
                            <Tooltip.Arrow className="fill-slate-800" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                      {event.ipAddress && (
                        plan === "pro" ? (
                          <span className="text-xs text-slate-600 font-mono">
                            {event.ipAddress}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-slate-600">
                            <Lock className="h-2.5 w-2.5" />
                            <span className="blur-sm select-none">
                              {event.ipAddress}
                            </span>
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  {/* Sentiment pill */}
                  <span
                    className={cn(
                      "flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      event.sentiment === "added" &&
                        "bg-green-500/20 text-green-400",
                      event.sentiment === "removed" &&
                        "bg-red-500/20 text-red-400",
                      event.sentiment === "changed" &&
                        "bg-yellow-500/20 text-yellow-400"
                    )}
                  >
                    {event.sentiment}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length} events
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-slate-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
}

function SelectFilter({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-violet-500 capitalize">
        <Select.Value />
        <Select.Icon>
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 overflow-hidden rounded-lg border border-slate-700 bg-slate-800 shadow-xl">
          <Select.Viewport className="p-1">
            {options.map((opt) => (
              <Select.Item
                key={opt}
                value={opt}
                className="flex cursor-pointer items-center justify-between rounded-md px-3 py-1.5 text-xs text-slate-300 outline-none hover:bg-slate-700 data-[state=checked]:text-violet-400 capitalize"
              >
                <Select.ItemText>{opt}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check className="h-3 w-3" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
