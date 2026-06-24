import { getScriptErrorMessage, loadServerEnv } from "./load-server-env";

const envStatus = loadServerEnv();

if (!envStatus.ok) {
  console.error("DEV ONLY: Pending paper classification skipped. Database environment is not ready.");
  console.error(`Loaded env file: ${envStatus.envPath}`);
  console.error(`Missing required value(s): ${envStatus.missing.join(", ")}`);
  if (envStatus.error) {
    console.error(`dotenv error: ${envStatus.error.message}`);
  }
  process.exit(1);
}

console.log(`DEV ONLY: Loaded server env from ${envStatus.envPath}`);
console.log("DEV ONLY: Classifying pending papers. This writes paper_classifications and updates paper status.");

try {
  const { classifyPendingPapers } = await import("@deepread/api/services/paper-classification");
  const { default: prisma } = await import("@deepread/db");

  try {
    const result = await classifyPendingPapers({
      limit: 5,
    });

    console.log(JSON.stringify(result, null, 2));

    if (result.totalFound === 0) {
      console.log("No pending papers found. Run OpenAlex ingestion first if you need pending papers to classify.");
    }
  } finally {
    await prisma.$disconnect();
  }
} catch (error) {
  console.error("DEV ONLY: Pending paper classification failed before completion.");
  console.error("Check apps/server/.env DATABASE_URL and database connectivity.");
  console.error(getScriptErrorMessage(error));
  process.exitCode = 1;
}
