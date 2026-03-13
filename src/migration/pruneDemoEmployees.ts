import mongoose from "mongoose";
import { env } from "../config/env.js";
import { UserModel } from "../models/user.js";

const KEEP_EMPLOYEE_EMAIL = "rahul.sharma@company.com";

async function run() {
  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
  });

  try {
    const beforeUsers = await UserModel.countDocuments({ role: "USER" });

    const result = await UserModel.deleteMany({
      role: "USER",
      email: { $ne: KEEP_EMPLOYEE_EMAIL },
    });

    const afterUsers = await UserModel.countDocuments({ role: "USER" });
    const keptRahul = await UserModel.findOne({
      role: "USER",
      email: KEEP_EMPLOYEE_EMAIL,
    }).lean();

    console.log(
      `[prune-demo-employees] deleted=${result.deletedCount ?? 0} userBefore=${beforeUsers} userAfter=${afterUsers} keepRahul=${Boolean(keptRahul)}`
    );
  } finally {
    await mongoose.disconnect();
  }
}

void run().catch((error) => {
  console.error("[prune-demo-employees] failed", error);
  process.exitCode = 1;
});

