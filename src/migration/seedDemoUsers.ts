import mongoose from "mongoose";
import { env } from "../config/env.js";
import { UserModel } from "../models/user.js";

const DEMO_VERTICALS = [
  "M/S Birendra Kumar Tripathi",
  "BKT Minetech Solutions",
  "BKT Tactical Solutions",
  "BKT Infratech",
  "Samridhi Informatics",
  "Others (JV / Partnerships)",
] as const;

const DEMO_USERS: Array<{
  email: string;
  name: string;
  role: "USER" | "L1_ADMIN" | "L2_ADMIN" | "L3_ADMIN" | "L4_ADMIN" | "ROLE_MANAGER";
  status: "active" | "inactive";
  verticals?: string[];
}> = [
  {
    email: "rahul.sharma@company.com",
    name: "Rahul Sharma",
    role: "USER",
    status: "active",
  },
  {
    email: "sneha.reddy@company.com",
    name: "Sneha Reddy",
    role: "L3_ADMIN",
    status: "active",
  },
  {
    email: "role.manager@demo.company.com",
    name: "Demo Role Manager",
    role: "ROLE_MANAGER",
    status: "active",
  },
  {
    email: "l1.admin@demo.company.com",
    name: "Demo L1 Admin",
    role: "L1_ADMIN",
    status: "active",
    verticals: [...DEMO_VERTICALS],
  },
  {
    email: "l2.admin@demo.company.com",
    name: "Demo L2 Admin",
    role: "L2_ADMIN",
    status: "active",
    verticals: [...DEMO_VERTICALS],
  },
  {
    email: "l4.finance@demo.company.com",
    name: "Demo L4 Finance",
    role: "L4_ADMIN",
    status: "active",
  },
];

async function run() {
  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
  });

  try {
    let inserted = 0;
    let updated = 0;

    for (const user of DEMO_USERS) {
      const existing = await UserModel.findOne({ email: user.email }).lean();
      await UserModel.updateOne(
        { email: user.email },
        {
          $set: {
            name: user.name,
            role: user.role,
            status: user.status,
            verticals: user.verticals || [],
          },
          $setOnInsert: {
            assignedBy: "seed-demo-users",
            assignedAt: Date.now(),
          },
        },
        { upsert: true }
      );
      if (existing) updated += 1;
      else inserted += 1;
    }

    console.log(
      `[seed-demo-users] completed inserted=${inserted} updated=${updated} total=${DEMO_USERS.length}`
    );
  } finally {
    await mongoose.disconnect();
  }
}

void run().catch((error) => {
  console.error("[seed-demo-users] failed", error);
  process.exitCode = 1;
});

