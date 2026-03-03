"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Select from "@radix-ui/react-select";
import {
  UserPlus,
  MoreHorizontal,
  X,
  ChevronDown,
  Check,
  Copy,
  Link2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "owner" | "admin" | "member" | "viewer";

interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  joinedDate: string;
  lastActive: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: Role;
  sentDate: string;
  expiresDate: string;
}

const roleBadge: Record<Role, string> = {
  owner: "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30",
  admin: "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30",
  member: "bg-slate-700 text-slate-300 ring-1 ring-slate-600",
  viewer: "bg-slate-800 text-slate-400 ring-1 ring-slate-700",
};

const mockMembers: Member[] = [
  {
    id: "1",
    name: "Jane Doe",
    email: "jane@example.com",
    role: "owner",
    initials: "JD",
    joinedDate: "Jan 1, 2024",
    lastActive: "2 hours ago",
  },
  {
    id: "2",
    name: "Alice Smith",
    email: "alice@example.com",
    role: "admin",
    initials: "AS",
    joinedDate: "Feb 14, 2024",
    lastActive: "Yesterday",
  },
  {
    id: "3",
    name: "Bob Johnson",
    email: "bob@example.com",
    role: "member",
    initials: "BJ",
    joinedDate: "Mar 5, 2024",
    lastActive: "3 days ago",
  },
];

const mockInvites: PendingInvite[] = [
  {
    id: "i1",
    email: "charlie@example.com",
    role: "member",
    sentDate: "Mar 1, 2024",
    expiresDate: "Mar 8, 2024",
  },
];

const roles: Role[] = ["owner", "admin", "member", "viewer"];

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        roleBadge[role]
      )}
    >
      {role}
    </span>
  );
}

function MemberAvatar({ initials }: { initials: string }) {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white flex-shrink-0">
      {initials}
    </div>
  );
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>(mockMembers);
  const [invites, setInvites] = useState<PendingInvite[]>(mockInvites);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setSending(true);
    // POST /api/v1/teams/:id/invites
    await new Promise((r) => setTimeout(r, 600));
    const newInvite: PendingInvite = {
      id: `i${Date.now()}`,
      email: inviteEmail,
      role: inviteRole,
      sentDate: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      expiresDate: new Date(Date.now() + 7 * 86400000).toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" }
      ),
    };
    setInvites((prev) => [...prev, newInvite]);
    setInviteEmail("");
    setInviteRole("member");
    setSending(false);
    setInviteOpen(false);
  };

  const handleRoleChange = async (memberId: string, newRole: Role) => {
    // PATCH /api/v1/teams/:id/members/:memberId
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
  };

  const handleRemoveMember = (memberId: string) => {
    // DELETE /api/v1/teams/:id/members/:memberId
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    setRemovingMemberId(null);
  };

  const handleCancelInvite = (inviteId: string) => {
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  };

  const handleCopyLink = (inviteId: string) => {
    navigator.clipboard.writeText(
      `https://app.teamkit.io/invite/${inviteId}`
    );
    setCopied(inviteId);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Members</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage your workspace members and permissions.
          </p>
        </div>
        <Dialog.Root open={inviteOpen} onOpenChange={setInviteOpen}>
          <Dialog.Trigger asChild>
            <button className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors">
              <UserPlus className="h-4 w-4" />
              Invite Member
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl focus:outline-none">
              <div className="flex items-center justify-between mb-5">
                <Dialog.Title className="text-lg font-semibold text-slate-100">
                  Invite a member
                </Dialog.Title>
                <Dialog.Close className="text-slate-500 hover:text-slate-300 transition-colors">
                  <X className="h-5 w-5" />
                </Dialog.Close>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Role
                  </label>
                  <Select.Root
                    value={inviteRole}
                    onValueChange={(v) => setInviteRole(v as Role)}
                  >
                    <Select.Trigger className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500">
                      <Select.Value />
                      <Select.Icon>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className="z-50 overflow-hidden rounded-lg border border-slate-700 bg-slate-800 shadow-xl">
                        <Select.Viewport className="p-1">
                          {roles.map((r) => (
                            <Select.Item
                              key={r}
                              value={r}
                              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-200 capitalize outline-none hover:bg-slate-700 data-[state=checked]:text-violet-400"
                            >
                              <Select.ItemText>{r}</Select.ItemText>
                              <Select.ItemIndicator className="ml-auto">
                                <Check className="h-4 w-4" />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>
                <button
                  onClick={handleInvite}
                  disabled={!inviteEmail || sending}
                  className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? "Sending…" : "Send Invite"}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {/* Members Table */}
      {members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/10">
            <Users className="h-8 w-8 text-violet-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-200">
            No members yet
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Invite your first team member to get started.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-200">
              Team Members ({members.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Member
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Role
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                    Joined
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">
                    Last Active
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <MemberAvatar initials={member.initials} />
                        <div>
                          <p className="text-sm font-medium text-slate-200">
                            {member.name}
                          </p>
                          <p className="text-xs text-slate-500">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Popover.Root>
                        <Popover.Trigger asChild>
                          <button className="flex items-center gap-1 group">
                            <RoleBadge role={member.role} />
                            <ChevronDown className="h-3 w-3 text-slate-600 group-hover:text-slate-400 transition-colors" />
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content
                            className="z-50 w-36 rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl"
                            sideOffset={4}
                          >
                            {roles.map((r) => (
                              <button
                                key={r}
                                onClick={() => handleRoleChange(member.id, r)}
                                className="flex w-full items-center justify-between px-3 py-2 text-sm text-slate-300 capitalize hover:bg-slate-700 transition-colors"
                              >
                                {r}
                                {member.role === r && (
                                  <Check className="h-3.5 w-3.5 text-violet-400" />
                                )}
                              </button>
                            ))}
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-400 hidden sm:table-cell">
                      {member.joinedDate}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500 hidden md:table-cell">
                      {member.lastActive}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <AlertDialog.Root
                        open={removingMemberId === member.id}
                        onOpenChange={(open) =>
                          setRemovingMemberId(open ? member.id : null)
                        }
                      >
                        <AlertDialog.Trigger asChild>
                          <button
                            disabled={member.role === "owner"}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </AlertDialog.Trigger>
                        <AlertDialog.Portal>
                          <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
                          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl focus:outline-none">
                            <AlertDialog.Title className="text-lg font-semibold text-slate-100">
                              Remove member?
                            </AlertDialog.Title>
                            <AlertDialog.Description className="mt-2 text-sm text-slate-400">
                              <strong className="text-slate-300">
                                {member.name}
                              </strong>{" "}
                              will lose access to this workspace immediately.
                              This action cannot be undone.
                            </AlertDialog.Description>
                            <div className="mt-5 flex gap-3 justify-end">
                              <AlertDialog.Cancel asChild>
                                <button className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors">
                                  Cancel
                                </button>
                              </AlertDialog.Cancel>
                              <AlertDialog.Action asChild>
                                <button
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                                >
                                  Remove
                                </button>
                              </AlertDialog.Action>
                            </div>
                          </AlertDialog.Content>
                        </AlertDialog.Portal>
                      </AlertDialog.Root>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-200">
              Pending Invites ({invites.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Email
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Role
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                    Sent
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">
                    Expires
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {invites.map((invite) => (
                  <tr
                    key={invite.id}
                    className="hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-5 py-4 text-sm text-slate-300">
                      {invite.email}
                    </td>
                    <td className="px-5 py-4">
                      <RoleBadge role={invite.role} />
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-400 hidden sm:table-cell">
                      {invite.sentDate}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500 hidden md:table-cell">
                      {invite.expiresDate}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleCopyLink(invite.id)}
                          className="flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                        >
                          {copied === invite.id ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          {copied === invite.id ? "Copied!" : "Copy Link"}
                        </button>
                        <button
                          onClick={() => handleCancelInvite(invite.id)}
                          className="flex items-center gap-1.5 rounded-md border border-red-900/50 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-950/50 transition-colors"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Missing import fix
function Users({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
