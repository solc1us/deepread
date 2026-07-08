import { publicProcedure } from "../index";

export const healthCheckProcedure = publicProcedure.query(() => {
  return {
    status: "ok",
  };
});
