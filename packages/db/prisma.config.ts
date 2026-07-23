import path from "node:path";

import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({
	path: "../../apps/server/.env",
});

export default defineConfig({
	schema: path.join("prisma", "schema"),
	migrations: {
		path: path.join("prisma", "migrations"),
		seed: "bun prisma/seed.ts",
	},
	datasource: {
		// Client generation and schema validation do not connect to PostgreSQL.
		// Guarded migration commands always provide the real DIRECT_URL explicitly.
		url:
			process.env.DIRECT_URL?.trim() ||
			"postgresql://schema_only:schema_only@127.0.0.1:5432/deepread_schema_only",
	},
});
