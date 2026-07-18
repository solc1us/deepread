import { z } from "zod";

import { MAX_PAPER_SEARCH_LENGTH } from "./paper-search-limits";

export const paperSearchQuerySchema = z
  .string()
  .trim()
  .max(MAX_PAPER_SEARCH_LENGTH, `Search query must be at most ${MAX_PAPER_SEARCH_LENGTH} characters.`)
  .optional();
