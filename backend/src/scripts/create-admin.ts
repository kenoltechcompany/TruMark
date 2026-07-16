import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";

function parseArgs(args: string[]): { username: string; password: string } {
  let username = "";
  let password = "";

  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--username" || args[i] === "-u") {
      username = args[++i] ?? "";
    } else if (args[i] === "--password" || args[i] === "-p") {
      password = args[++i] ?? "";
    }
  }

  if (!username || username.length < 3) {
    console.error("Error: --username/-u is required (min 3 characters)");
    process.exit(1);
  }
  if (!password || password.length < 6) {
    console.error("Error: --password/-p is required (min 6 characters)");
    process.exit(1);
  }

  return { username, password };
}

async function main() {
  const { username, password } = parseArgs(process.argv);

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const existing = await prisma.admin.findUnique({
      where: { username },
    });
    if (existing) {
      console.error(`Error: admin "${username}" already exists`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await prisma.admin.create({
      data: { username, passwordHash },
      select: { id: true, username: true, createdAt: true },
    });

    console.log(`Admin created successfully:`);
    console.log(`  ID:       ${admin.id}`);
    console.log(`  Username: ${admin.username}`);
    console.log(`  Created:  ${admin.createdAt.toISOString()}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Failed to create admin:", err.message);
  process.exit(1);
});
