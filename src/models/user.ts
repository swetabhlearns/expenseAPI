import { Schema, model, type InferSchemaType } from "mongoose";

const UserSchema = new Schema(
  {
    convexId: { type: String, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    role: {
      type: String,
      required: true,
      enum: ["USER", "L1_ADMIN", "L2_ADMIN", "L3_ADMIN", "L4_ADMIN", "ROLE_MANAGER"],
      index: true,
    },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    verticals: { type: [String], default: [] },
    assignedBy: { type: String },
    assignedAt: { type: Number },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export type UserDocument = InferSchemaType<typeof UserSchema>;
export const UserModel = model("User", UserSchema, "users");
