import { router } from "../../index";

import { adminClassificationRouter } from "./classification";
import { adminIngestionRouter } from "./ingestion";

export const adminRouter = router({
  ingestion: adminIngestionRouter,
  classification: adminClassificationRouter,
});
