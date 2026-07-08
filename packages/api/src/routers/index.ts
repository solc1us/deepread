import { router } from "../index";

import { adminRouter } from "./admin";
import { bookmarkRouter } from "./bookmark";
import { categoriesRouter } from "./categories";
import { healthCheckProcedure } from "./health";
import { notesRouter } from "./notes";
import { papersRouter } from "./papers";
import { privateDataProcedure } from "./private-data";
import { profileRouter } from "./profile";
import { readingRouter } from "./reading";
import { statisticsRouter } from "./statistics";

export const appRouter = router({
  healthCheck: healthCheckProcedure,
  categories: categoriesRouter,
  papers: papersRouter,
  profile: profileRouter,
  reading: readingRouter,
  bookmark: bookmarkRouter,
  notes: notesRouter,
  statistics: statisticsRouter,
  admin: adminRouter,
  privateData: privateDataProcedure,
});

export type AppRouter = typeof appRouter;
