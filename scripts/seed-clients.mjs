import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  const envFile = readFileSync(resolve(__dirname, "../.env"), "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch { }

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const clients = [
  { name: "Seadrill" },
  { name: "Equinor" },
  { name: "Harbour Energy" },
  { name: "Valaris" },
  { name: "Transocean" },
  { name: "SLB" },
  { name: "TotalEnergies" },
];

for (const c of clients) {
  const existing = await prisma.client.findUnique({ where: { name: c.name } });
  if (existing) {
    console.log(`  skip  ${c.name} (already exists)`);
  } else {
    await prisma.client.create({ data: c });
    console.log(`  ✓     ${c.name}`);
  }
}

await prisma.$disconnect();
