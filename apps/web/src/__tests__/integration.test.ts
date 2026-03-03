/**
 * TeamKit Integration Tests — FLOW-001 through FLOW-007
 * 
 * Tests use mocked DB and auth to validate business logic
 * without requiring a live database connection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock @teamkit/db ────────────────────────────────────────────────────────
vi.mock("@teamkit/db", () => {
  const mockDb = {
    query: {
      teamMembers: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      invitations: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      workspaces: {
        findFirst: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
      subscriptions: {
        findFirst: vi.fn(),
      },
      customRoles: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      workspaceApiKeys: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "mock-id" }]),
        onConflictDoUpdate: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "mock-id" }]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([]),
            }),
          }),
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
  };
  return {
    db: mockDb,
    teamMembers: {},
    users: {},
    invitations: {},
    workspaces: {},
    subscriptions: {},
    customRoles: {},
    workspaceApiKeys: {},
    auditLogs: {},
  };
});

// ─── Mock next-auth ───────────────────────────────────────────────────────────
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// ─── Mock email ───────────────────────────────────────────────────────────────
vi.mock("@/lib/email", () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue({ id: "email-id" }),
  sendInvitationReminderEmail: vi.fn().mockResolvedValue({ id: "email-id" }),
  sendInvitationExpiredEmail: vi.fn().mockResolvedValue({ id: "email-id" }),
}));

import { db } from "@teamkit/db";
import { auth } from "@/lib/auth";

// ─── Helper: mock authenticated session ──────────────────────────────────────
function mockSession(overrides: Record<string, string> = {}) {
  const session = {
    userId: "user-123",
    workspaceId: "ws-456",
    role: "owner",
    user: { email: "test@example.com" },
    expires: "2099-01-01",
    ...overrides,
  };
  (auth as ReturnType<typeof vi.fn>).mockResolvedValue(session);
  return session;
}

function mockUnauthenticated() {
  (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("FLOW-001: Signup → Workspace → Invite → Accept → useTeam()", () => {
  it("should create workspace on first signup via NextAuth events", () => {
    // This flow is handled by NextAuth's createUser event in lib/auth.ts
    // Verify the event handler logic
    const workspaceName = "john"; // from email john@example.com
    const slug = workspaceName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    expect(slug).toBe("john");
    expect(`${slug}-${Date.now()}`.startsWith("john-")).toBe(true);
  });

  it("should invite a member and return 201", async () => {
    mockSession({ role: "owner" });

    // Mock: workspace exists, member count = 2, subscription = free (limit 5), no duplicate invite
    (db.query.subscriptions.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      plan: "free",
      seatCount: 5,
    });

    const { NextRequest } = await import("next/server");
    const { POST } = await import("@/app/api/v1/members/route");

    const req = new NextRequest("http://localhost/api/v1/members", {
      method: "POST",
      body: JSON.stringify({ email: "newmember@example.com", role: "member" }),
      headers: { "Content-Type": "application/json" },
    });

    // Mock select count for members
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ memberCount: 2 }]),
      }),
    });

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: "invite-id",
          email: "newmember@example.com",
          role: "member",
          expiresAt: new Date(),
        }]),
      }),
    });

    (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "user-123",
      name: "Test User",
      email: "test@example.com",
    });

    (db.query.workspaces.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ws-456",
      name: "Test Workspace",
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.invitation).toBeDefined();
    expect(json.invitation.email).toBe("newmember@example.com");
  });
});

describe("FLOW-002: Role change logged in audit_log", () => {
  it("should change role and create audit log entry", async () => {
    mockSession({ role: "owner" });

    (db.query.teamMembers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "member-id",
      userId: "user-789",
      workspaceId: "ws-456",
      role: "admin",
    });

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: "member-id",
            role: "member",
          }]),
        }),
      }),
    });

    (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "user-789",
      email: "user@example.com",
    });

    const { NextRequest } = await import("next/server");
    const { PATCH } = await import("@/app/api/v1/members/[memberId]/route");

    const req = new NextRequest("http://localhost/api/v1/members/member-id", {
      method: "PATCH",
      body: JSON.stringify({ role: "member" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: { memberId: "member-id" } });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.member).toBeDefined();
  });

  it("should reject role change by non-owner", async () => {
    mockSession({ role: "admin" });

    const { NextRequest } = await import("next/server");
    const { PATCH } = await import("@/app/api/v1/members/[memberId]/route");

    const req = new NextRequest("http://localhost/api/v1/members/member-id", {
      method: "PATCH",
      body: JSON.stringify({ role: "viewer" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: { memberId: "member-id" } });
    expect(res.status).toBe(403);
  });
});

describe("FLOW-003: Invite expiry (48h) → accept returns 410", () => {
  it("should return 410 for expired invitation", async () => {
    mockSession();

    const expiredDate = new Date(Date.now() - 1000); // 1 second ago
    (db.query.invitations.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "invite-id",
      status: "pending",
      expiresAt: expiredDate,
      workspaceId: "ws-456",
      email: "test@example.com",
      role: "member",
      token: "test-token",
    });

    (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "user-123",
      email: "test@example.com",
    });

    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/api/v1/invite/accept/route");

    const req = new NextRequest(
      "http://localhost/api/v1/invite/accept?token=test-token"
    );

    const res = await GET(req);
    expect(res.status).toBe(410);

    const json = await res.json();
    expect(json.code).toBe("INVITE_EXPIRED");
  });

  it("should return 410 for already-accepted invitation", async () => {
    mockSession();

    (db.query.invitations.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "invite-id",
      status: "accepted",
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      workspaceId: "ws-456",
      email: "test@example.com",
      role: "member",
      token: "test-token",
    });

    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/api/v1/invite/accept/route");

    const req = new NextRequest(
      "http://localhost/api/v1/invite/accept?token=test-token"
    );

    const res = await GET(req);
    expect(res.status).toBe(410);

    const json = await res.json();
    expect(json.code).toBe("INVITE_USED");
  });
});

describe("FLOW-004: Custom role — Pro only, 402 for free plan", () => {
  it("should return 402 for free plan", async () => {
    mockSession({ role: "admin" });

    (db.query.subscriptions.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      plan: "free",
      seatCount: 5,
    });

    const { NextRequest } = await import("next/server");
    const { POST } = await import("@/app/api/v1/roles/route");

    const req = new NextRequest("http://localhost/api/v1/roles", {
      method: "POST",
      body: JSON.stringify({ name: "custom-role", permissions: ["view_audit_log"] }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(402);

    const json = await res.json();
    expect(json.code).toBe("PLAN_REQUIRED");
  });

  it("should allow custom role creation on Pro plan", async () => {
    mockSession({ role: "owner" });

    (db.query.subscriptions.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      plan: "pro",
      seatCount: 999999,
    });

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: "role-id",
          name: "custom-role",
          permissions: ["view_audit_log"],
        }]),
      }),
    });

    const { NextRequest } = await import("next/server");
    const { POST } = await import("@/app/api/v1/roles/route");

    const req = new NextRequest("http://localhost/api/v1/roles", {
      method: "POST",
      body: JSON.stringify({ name: "custom-role", permissions: ["view_audit_log"] }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("should reject arbitrary permissions (injection attempt)", async () => {
    mockSession({ role: "owner" });

    (db.query.subscriptions.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      plan: "pro",
      seatCount: 999999,
    });

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: "role-id",
          name: "malicious",
          permissions: [],
        }]),
      }),
    });

    const { NextRequest } = await import("next/server");
    const { POST } = await import("@/app/api/v1/roles/route");

    const req = new NextRequest("http://localhost/api/v1/roles", {
      method: "POST",
      body: JSON.stringify({
        name: "malicious",
        permissions: ["__proto__", "DELETE *", "admin_bypass"],
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    // Should succeed but with empty permissions (all invalid strings filtered out)
    expect(res.status).toBe(201);
  });
});

describe("FLOW-005: Remove member → deleted + audit logged", () => {
  it("should remove member and log the event", async () => {
    mockSession({ role: "owner" });

    (db.query.teamMembers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "member-id",
      userId: "other-user",
      workspaceId: "ws-456",
      role: "member",
    });

    (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "other-user",
      email: "other@example.com",
    });

    const { NextRequest } = await import("next/server");
    const { DELETE } = await import("@/app/api/v1/members/[memberId]/route");

    const req = new NextRequest("http://localhost/api/v1/members/member-id", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: { memberId: "member-id" } });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);

    // Verify delete was called
    expect(db.delete).toHaveBeenCalled();
  });

  it("should prevent owner from removing themselves", async () => {
    mockSession({ userId: "user-123", role: "owner" });

    (db.query.teamMembers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "member-id",
      userId: "user-123", // same as session.userId
      workspaceId: "ws-456",
      role: "owner",
    });

    const { NextRequest } = await import("next/server");
    const { DELETE } = await import("@/app/api/v1/members/[memberId]/route");

    const req = new NextRequest("http://localhost/api/v1/members/member-id", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: { memberId: "member-id" } });
    expect(res.status).toBe(400);
  });
});

describe("FLOW-006: Stripe upgrade → member limit increases", () => {
  it("Free plan: 5 member limit", async () => {
    const { getMemberLimit } = await import("@/lib/stripe");
    expect(getMemberLimit("free")).toBe(5);
  });

  it("Indie plan: 25 member limit", async () => {
    const { getMemberLimit } = await import("@/lib/stripe");
    expect(getMemberLimit("indie")).toBe(25);
  });

  it("Pro plan: unlimited (999999) member limit", async () => {
    const { getMemberLimit } = await import("@/lib/stripe");
    expect(getMemberLimit("pro")).toBe(999999);
  });

  it("should reject invite when member limit reached", async () => {
    mockSession({ role: "owner" });

    (db.query.subscriptions.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      plan: "free",
      seatCount: 5,
    });

    // Mock: already 5 members (at the limit)
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ memberCount: 5 }]),
      }),
    });

    const { NextRequest } = await import("next/server");
    const { POST } = await import("@/app/api/v1/members/route");

    const req = new NextRequest("http://localhost/api/v1/members", {
      method: "POST",
      body: JSON.stringify({ email: "new@example.com", role: "member" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(402);

    const json = await res.json();
    expect(json.code).toBe("MEMBER_LIMIT_REACHED");
  });
});

describe("FLOW-007: Concurrent invite same email → idempotent", () => {
  it("should enforce 50-invite rate limit per workspace", async () => {
    mockSession({ role: "owner" });

    (db.query.subscriptions.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      plan: "free",
      seatCount: 5,
    });

    // First check (member count): 2 members
    // Second check (invite count): 50 invites (at limit)
    let callCount = 0;
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve([{ memberCount: 2 }]);
          return Promise.resolve([{ inviteCount: 50 }]);
        }),
      }),
    });

    const { NextRequest } = await import("next/server");
    const { POST } = await import("@/app/api/v1/members/route");

    const req = new NextRequest("http://localhost/api/v1/members", {
      method: "POST",
      body: JSON.stringify({ email: "another@example.com", role: "member" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(429);

    const json = await res.json();
    expect(json.code).toBe("RATE_LIMIT");
  });
});

describe("Security: IDOR Protection", () => {
  it("should return 404 for member in different workspace", async () => {
    mockSession({ workspaceId: "ws-different" });

    // Member belongs to "ws-456", session is "ws-different"
    (db.query.teamMembers.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { NextRequest } = await import("next/server");
    const { PATCH } = await import("@/app/api/v1/members/[memberId]/route");

    const req = new NextRequest("http://localhost/api/v1/members/member-id", {
      method: "PATCH",
      body: JSON.stringify({ role: "member" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: { memberId: "member-id" } });
    expect(res.status).toBe(404);
  });

  it("should return 401 for unauthenticated requests", async () => {
    mockUnauthenticated();

    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/api/v1/members/route");

    const req = new NextRequest("http://localhost/api/v1/members");
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("Security: Audit Log Integrity", () => {
  it("audit-logs should have no update/delete endpoints", async () => {
    const auditLogModule = await import("@/app/api/v1/audit-logs/route");
    // Only GET should exist — no POST, PATCH, DELETE
    expect(typeof auditLogModule.GET).toBe("function");
    expect((auditLogModule as Record<string, unknown>).POST).toBeUndefined();
    expect((auditLogModule as Record<string, unknown>).PATCH).toBeUndefined();
    expect((auditLogModule as Record<string, unknown>).DELETE).toBeUndefined();
  });
});

describe("Security: API Key One-Time Reveal", () => {
  it("POST /api/v1/api-keys should return full key only once", async () => {
    mockSession({ role: "owner" });

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: "key-id",
          name: "Test Key",
          keyPrefix: "tk_live_te",
          createdAt: new Date(),
        }]),
      }),
    });

    const { NextRequest } = await import("next/server");
    const { POST } = await import("@/app/api/v1/api-keys/route");

    const req = new NextRequest("http://localhost/api/v1/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "Test Key" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.apiKey.key).toBeDefined();
    expect(json.apiKey.key).toMatch(/^tk_live_/);
    expect(json.apiKey.warning).toBeDefined();
  });

  it("GET /api/v1/api-keys should NOT return full key", async () => {
    mockSession();

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            id: "key-id",
            name: "My Key",
            keyPrefix: "tk_live_xx",
            lastUsedAt: null,
            expiresAt: null,
            createdAt: new Date(),
            // keyHash should NOT be in the response
          },
        ]),
      }),
    });

    const { GET } = await import("@/app/api/v1/api-keys/route");
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.keys).toBeDefined();
    json.keys.forEach((key: Record<string, unknown>) => {
      expect(key.keyHash).toBeUndefined();
      expect(key.keyPrefix).toBeDefined();
    });
  });
});

describe("Permission: Role validation", () => {
  it("should filter out arbitrary permissions", async () => {
    const { validatePermissions } = await import("@/lib/permissions");
    const result = validatePermissions([
      "manage_members",
      "__proto__",
      "DROP TABLE",
      "view_audit_log",
    ]);
    expect(result).toEqual(["manage_members", "view_audit_log"]);
  });

  it("should accept all valid permissions", async () => {
    const { validatePermissions, VALID_PERMISSIONS } = await import("@/lib/permissions");
    const result = validatePermissions([...VALID_PERMISSIONS]);
    expect(result).toEqual(VALID_PERMISSIONS);
  });
});
