import { UserModel } from "../models/user.js";
import type { UserSnapshot } from "../../../shared/contracts/domain.js";

function normalizeEmail(email: string | undefined): string {
  return (email || "").trim().toLowerCase();
}

export async function getCurrentUserByEmail(email: string): Promise<UserSnapshot | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const user = await UserModel.findOne({ email: normalizedEmail }).lean();
  if (!user) return null;

  return {
    id: String(user._id),
    legacyId: user.convexId || undefined,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    verticals: user.verticals,
  };
}
