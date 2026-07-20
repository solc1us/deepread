import { formatTestDatabaseSummary, loadTestDatabaseEnvironment } from "@deepread/db/test-database-environment";

const environment = loadTestDatabaseEnvironment();

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = environment.databaseUrl;
delete process.env.DIRECT_URL;
process.env.BETTER_AUTH_SECRET = "deepread-integration-test-secret-only";
process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
process.env.CORS_ORIGIN = "http://127.0.0.1:3001";
process.env.CLASSIFICATION_PROFILING = "false";
process.env.OPENALEX_INGESTION_PROFILING = "false";

console.log(`[Integration Test Database] ${formatTestDatabaseSummary(environment)}`);
