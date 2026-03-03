export type Permission =
  | "manage_members"
  | "manage_billing"
  | "manage_roles"
  | "view_audit_log"
  | "manage_settings";

export const VALID_PERMISSIONS: Permission[] = [
  "manage_members",
  "manage_billing",
  "manage_roles",
  "view_audit_log",
  "manage_settings",
];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: [
    "manage_members",
    "manage_billing",
    "manage_roles",
    "view_audit_log",
    "manage_settings",
  ],
  admin: ["manage_members", "view_audit_log", "manage_settings"],
  member: ["view_audit_log"],
  viewer: [],
};

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = DEFAULT_ROLE_PERMISSIONS[role];
  if (perms) return perms.includes(permission);
  return false;
}

export function validatePermissions(permissions: unknown[]): Permission[] {
  return permissions.filter((p): p is Permission =>
    VALID_PERMISSIONS.includes(p as Permission)
  );
}

export const DEFAULT_ROLES = ["owner", "admin", "member", "viewer"] as const;
export type DefaultRole = (typeof DEFAULT_ROLES)[number];
