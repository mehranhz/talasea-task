import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function diffMessageKeyTrees(left, right, path = "", problems = []) {
  const leftRecord = isRecord(left);
  const rightRecord = isRecord(right);
  if (leftRecord !== rightRecord) {
    const where = path || "<root>";
    problems.push(`${where}: ${leftRecord ? "object" : "leaf"} in en, ${rightRecord ? "object" : "leaf"} in fa`);
    return problems;
  }
  if (!leftRecord) return problems;

  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of [...keys].sort()) {
    const next = path ? `${path}.${key}` : key;
    if (!Object.hasOwn(left, key)) problems.push(`${next}: missing in en`);
    else if (!Object.hasOwn(right, key)) problems.push(`${next}: missing in fa`);
    else diffMessageKeyTrees(left[key], right[key], next, problems);
  }
  return problems;
}

function main() {
  const messagesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "messages");
  const en = JSON.parse(readFileSync(join(messagesDir, "en.json"), "utf8"));
  const fa = JSON.parse(readFileSync(join(messagesDir, "fa.json"), "utf8"));
  const problems = diffMessageKeyTrees(en, fa);
  if (problems.length === 0) return;
  console.error("fa.json and en.json key trees differ:");
  for (const problem of problems) console.error(`  ${problem}`);
  process.exitCode = 1;
}

const invoked = process.argv[1];
if (invoked && import.meta.url === pathToFileURL(resolve(invoked)).href) main();
