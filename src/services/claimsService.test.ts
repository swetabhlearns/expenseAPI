import test from "node:test";
import assert from "node:assert/strict";
import { deriveEmployeeBucket } from "./claimsService.js";

test("deriveEmployeeBucket marks rejected correctly", () => {
  const bucket = deriveEmployeeBucket({
    _id: "1",
    userId: "u1",
    userName: "User",
    amount: 100,
    date: "2026-01-01",
    status: "REJECTED",
  });

  assert.equal(bucket, "rejected");
});

test("deriveEmployeeBucket marks action required for disbursed without receipt", () => {
  const bucket = deriveEmployeeBucket({
    _id: "1",
    userId: "u1",
    userName: "User",
    amount: 100,
    date: "2026-01-01",
    status: "DISBURSED",
    employeeReceivedAt: undefined,
  });

  assert.equal(bucket, "action_required");
});

test("deriveEmployeeBucket marks accepted for completed", () => {
  const bucket = deriveEmployeeBucket({
    _id: "1",
    userId: "u1",
    userName: "User",
    amount: 100,
    date: "2026-01-01",
    status: "COMPLETED",
  });

  assert.equal(bucket, "accepted");
});
