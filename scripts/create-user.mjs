#!/usr/bin/env node
/**
 * Create a new user in the database.
 * Usage: node scripts/create-user.mjs
 */

import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually
try {
  const envPath = resolve(__dirname, "../.env");
  const envFile = readFileSync(envPath, "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env not found — rely on environment variables already set
}

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const rl = createInterface({ input: process.stdin, output: process.stdout });

function prompt(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function promptHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    let input = "";
    process.stdin.on("data", function handler(ch) {
      if (ch === "\r" || ch === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", handler);
        process.stdout.write("\n");
        resolve(input);
      } else if (ch === "\u0003") {
        process.stdout.write("\n");
        process.exit();
      } else if (ch === "\u007f") {
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(question + "*".repeat(input.length));
        }
      } else {
        input += ch;
        process.stdout.write("*");
      }
    });
  });
}

async function main() {
  console.log("Create New User\n");

  const fullName = (await prompt("Full name:     ")).trim();
  if (!fullName) { console.error("Full name is required."); process.exit(1); }

  const username = (await prompt("Username:      ")).trim();
  if (!username) { console.error("Username is required."); process.exit(1); }

  const password = await promptHidden("Password:      ");
  if (!password) { console.error("Password is required."); process.exit(1); }

  const confirm = await promptHidden("Confirm:       ");
  if (password !== confirm) { console.error("Passwords do not match."); process.exit(1); }

  process.stdin.resume();
  const roleInput = (await prompt("Role [user/admin] (default: user): ")).trim().toLowerCase();
  const role = roleInput === "admin" ? "admin" : "user";

  rl.close();

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.error(`\nError: Username "${username}" already exists.`);
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, password: hashedPassword, fullName, role },
  });

  console.log(`\nUser created successfully:`);
  console.log(`  ID:       ${user.id}`);
  console.log(`  Username: ${user.username}`);
  console.log(`  Name:     ${user.fullName}`);
  console.log(`  Role:     ${user.role}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
