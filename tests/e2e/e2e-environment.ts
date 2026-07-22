import { loadTestDatabaseEnvironment } from "../../packages/db/src/test-database-environment";

const WEB_ORIGIN = "http://127.0.0.1:3001";
const SERVER_ORIGIN = "http://127.0.0.1:3002";
const TEST_AUTH_SECRET = "deepread-e2e-only-secret-32-characters";

export function getE2EEnvironment() {
  const database = loadTestDatabaseEnvironment({ requireDirectUrl: true });

  return {
    database,
    webOrigin: WEB_ORIGIN,
    serverOrigin: SERVER_ORIGIN,
    serverEnvironment: {
      NODE_ENV: "test",
      DATABASE_URL: database.databaseUrl,
      BETTER_AUTH_SECRET: TEST_AUTH_SECRET,
      BETTER_AUTH_URL: SERVER_ORIGIN,
      CORS_ORIGIN: WEB_ORIGIN,
      PORT: "3002",
      CLASSIFICATION_PROFILING: "false",
      OPENALEX_INGESTION_PROFILING: "false",
    },
    webEnvironment: {
      NEXT_PUBLIC_SERVER_URL: SERVER_ORIGIN,
    },
  };
}
