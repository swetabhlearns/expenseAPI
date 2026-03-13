import { RoleAuditLogModel } from "../models/roleAuditLog.js";
import { UserModel } from "../models/user.js";
import type { UserSnapshot } from "../contracts/domain.js";

const ROLE_NAMES = new Set(["USER", "L1_ADMIN", "L2_ADMIN", "L3_ADMIN", "L4_ADMIN", "ROLE_MANAGER"]);

function requireRoleManager(actor: UserSnapshot) {
  if (actor.role !== "ROLE_MANAGER" && actor.role !== "L3_ADMIN") {
    const error = new Error("FORBIDDEN");
    (error as any).statusCode = 403;
    throw error;
  }
}

export async function listAllUsersForRoleManagement(args: {
  actor: UserSnapshot;
  searchQuery?: string;
  roleFilter?: string;
  statusFilter?: string;
  verticalFilter?: string;
  page: number;
  pageSize: number;
}) {
  requireRoleManager(args.actor);

  const filter: Record<string, unknown> = {};
  if (args.roleFilter && args.roleFilter !== "ALL") filter.role = args.roleFilter;
  if (args.statusFilter && args.statusFilter !== "ALL") filter.status = args.statusFilter;
  if (args.verticalFilter && args.verticalFilter !== "ALL") filter.verticals = args.verticalFilter;

  let users = await UserModel.find(filter).lean();
  if (args.searchQuery) {
    const query = args.searchQuery.toLowerCase();
    users = users.filter((u) => u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query));
  }

  users.sort((a, b) => a.name.localeCompare(b.name));

  const page = Math.max(1, args.page);
  const pageSize = Math.min(100, Math.max(1, args.pageSize));
  const start = (page - 1) * pageSize;

  return {
    items: users.slice(start, start + pageSize).map((u) => ({
      _id: u.convexId || String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status || "active",
      verticals: u.verticals || [],
      assignedBy: u.assignedBy,
      assignedAt: u.assignedAt,
    })),
    total: users.length,
    page,
    pageSize,
  };
}

export async function createUserForRoleManagement(args: {
  actor: UserSnapshot;
  name: string;
  email: string;
  role: string;
  verticals?: string[];
}) {
  requireRoleManager(args.actor);
  if (!ROLE_NAMES.has(args.role)) throw new Error("Invalid role");

  const normalizedEmail = args.email.trim().toLowerCase();
  const existing = await UserModel.findOne({ email: normalizedEmail }).lean();
  if (existing) throw new Error("User with this email already exists");

  const user = await UserModel.create({
    name: args.name,
    email: normalizedEmail,
    role: args.role,
    status: "active",
    verticals: args.verticals,
    assignedBy: args.actor.name,
    assignedAt: Date.now(),
  });

  await RoleAuditLogModel.create({
    userEmail: normalizedEmail,
    userName: args.name,
    previousRole: "NONE",
    newRole: args.role,
    changedBy: args.actor.name,
    changedByEmail: args.actor.email,
    reason: "New user created",
    timestamp: Date.now(),
  });

  return {
    success: true,
    userId: user.convexId || String(user._id),
  };
}

export async function assignRoleForRoleManagement(args: {
  actor: UserSnapshot;
  userEmail: string;
  newRole: string;
  verticals?: string[];
  reason?: string;
}) {
  requireRoleManager(args.actor);
  if (!ROLE_NAMES.has(args.newRole)) throw new Error("Invalid role");

  const normalizedEmail = args.userEmail.trim().toLowerCase();
  const targetUser = await UserModel.findOne({ email: normalizedEmail });
  if (!targetUser) throw new Error("Target user not found");

  const previousRole = targetUser.role;
  targetUser.role = args.newRole as any;
  targetUser.verticals = args.verticals || [];
  targetUser.assignedBy = args.actor.email;
  targetUser.assignedAt = Date.now();
  targetUser.status = targetUser.status || "active";
  await targetUser.save();

  await RoleAuditLogModel.create({
    userEmail: normalizedEmail,
    userName: targetUser.name,
    previousRole,
    newRole: args.newRole,
    changedBy: args.actor.name,
    changedByEmail: args.actor.email,
    reason: args.reason,
    timestamp: Date.now(),
  });

  return { success: true, previousRole, newRole: args.newRole };
}

export async function deleteUserForRoleManagement(args: { actor: UserSnapshot; userEmail: string }) {
  requireRoleManager(args.actor);

  const normalizedEmail = args.userEmail.trim().toLowerCase();
  if (normalizedEmail === args.actor.email.trim().toLowerCase()) {
    throw new Error("Cannot delete your own account");
  }

  const deleted = await UserModel.findOneAndDelete({ email: normalizedEmail }).lean();
  if (!deleted) throw new Error("User not found");

  return { success: true };
}
