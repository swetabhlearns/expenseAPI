import { readFile } from "node:fs/promises";

export async function readSnapshotRecords(filePath: string): Promise<Record<string, unknown>[]> {
  const content = await readFile(filePath, "utf8");
  const trimmed = content.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      throw new Error(`Expected JSON array in snapshot file: ${filePath}`);
    }
    return parsed.filter((row): row is Record<string, unknown> => row && typeof row === "object");
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        const parsed = JSON.parse(line);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Record is not an object");
        }
        return parsed as Record<string, unknown>;
      } catch (error) {
        throw new Error(`Invalid JSON at ${filePath}:${index + 1} (${String(error)})`);
      }
    });
}
