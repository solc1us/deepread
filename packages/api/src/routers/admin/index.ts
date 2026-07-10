import { router } from "../../index";

import { adminClassificationRouter } from "./classification";
import { adminDashboardRouter } from "./dashboard";
import { adminIngestionRouter } from "./ingestion";
import { adminLogsRouter } from "./logs";
import { adminPapersRouter } from "./papers";

export const adminRouter = router({
  dashboard: adminDashboardRouter,
  ingestion: adminIngestionRouter,
  classification: adminClassificationRouter,
  logs: adminLogsRouter,
  papers: adminPapersRouter,
});
