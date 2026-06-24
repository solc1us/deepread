import { getScriptErrorMessage, loadServerEnv } from "./load-server-env";

const envStatus = loadServerEnv();

if (!envStatus.ok) {
  console.error("DEV DB health check failed. Database environment is not ready.");
  console.error(`Loaded env file: ${envStatus.envPath}`);
  console.error(`Missing required value(s): ${envStatus.missing.join(", ")}`);
  if (envStatus.error) {
    console.error(`dotenv error: ${envStatus.error.message}`);
  }
  process.exit(1);
}

console.log(`Loaded server env from ${envStatus.envPath}`);
console.log(
  envStatus.hasDirectUrl
    ? "DIRECT_URL is present for Prisma CLI/migration workflows. Runtime Prisma uses DATABASE_URL."
    : "DIRECT_URL is not set. Runtime Prisma uses DATABASE_URL; DIRECT_URL is only needed for Prisma CLI/migration workflows.",
);

const { default: prisma } = await import("@deepread/db");

try {
  const categories = await prisma.category.findMany({
    take: 3,
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
    },
  });

  console.log(`DEV DB health check passed. Found ${categories.length} categor${categories.length === 1 ? "y" : "ies"}.`);

  if (categories.length === 0) {
    console.log("No categories found. Run the seed script first: bun run db:seed");
  } else {
    console.log(JSON.stringify(categories, null, 2));
  }
} catch (error) {
  console.error("DEV DB health check failed. Check apps/server/.env DATABASE_URL and database connectivity.");
  console.error(getScriptErrorMessage(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
