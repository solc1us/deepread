import { getScriptErrorMessage, loadServerEnv } from "./load-server-env";

const envStatus = loadServerEnv();

if (!envStatus.ok) {
  console.error("DEV ONLY: OpenAlex ingestion skipped. Database environment is not ready.");
  console.error(`Loaded env file: ${envStatus.envPath}`);
  console.error(`Missing required value(s): ${envStatus.missing.join(", ")}`);
  if (envStatus.error) {
    console.error(`dotenv error: ${envStatus.error.message}`);
  }
  process.exit(1);
}

console.log(`DEV ONLY: Loaded server env from ${envStatus.envPath}`);
console.log(
  envStatus.hasDirectUrl
    ? "DIRECT_URL is present for Prisma CLI/migration workflows. Runtime Prisma uses DATABASE_URL."
    : "DIRECT_URL is not set. Runtime Prisma uses DATABASE_URL; DIRECT_URL is only needed for Prisma CLI/migration workflows.",
);

const { default: prisma } = await import("@deepread/db");

try {
  const category =
    (await prisma.category.findFirst({
      where: {
        name: "Education",
      },
      select: {
        id: true,
        name: true,
      },
    })) ??
    (await prisma.category.findFirst({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }));

  if (!category) {
    console.error("DEV ONLY: OpenAlex ingestion skipped. No categories exist in the database.");
    console.error("Run the seed script first: bun run db:seed");
    process.exitCode = 1;
  } else {
    const { runOpenAlexIngestion } = await import("@deepread/api/services/openalex-ingestion");

    console.log("DEV ONLY: Running OpenAlex ingestion. This writes pending papers and ingestion logs to the database.");
    console.log(`Using category: ${category.name} (${category.id})`);

    const result = await runOpenAlexIngestion({
      categoryId: category.id,
      query: "student learning",
      limit: 5,
    });

    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error("DEV ONLY: OpenAlex ingestion failed before completion.");
  console.error("Check apps/server/.env DATABASE_URL and database connectivity.");
  console.error(getScriptErrorMessage(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
