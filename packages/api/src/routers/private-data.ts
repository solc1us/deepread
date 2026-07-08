import { protectedProcedure } from "../index";

export const privateDataProcedure = protectedProcedure.query(({ ctx }) => {
  return {
    message: "This is private",
    user: ctx.session.user,
  };
});
