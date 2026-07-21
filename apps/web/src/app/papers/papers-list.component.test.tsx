import { describe, expect, test } from "bun:test";

import {
  getFrontendOperationCalls,
  routerPushCalls,
  setFrontendOperationHandler,
} from "@/test/test-doubles";
import { renderWithProviders, screen, waitFor } from "@/test/render";

import PapersList from "./papers-list";

function paperResult(page: number, title = `Paper on page ${page}`) {
  return {
    papers: [
      {
        id: `paper-${page}`,
        title,
        abstract: "A concise published abstract for component testing.",
        authors: ["Ada Author", "Ben Scholar"],
        publicationYear: 2025,
        category: { id: "category-2", name: "Computer Science" },
        difficultyLevel: "moderate",
        beginnerScore: 74,
        estimatedReadingTime: 8,
        sourceName: "OpenAlex",
        isBookmarked: false,
        userProgress: null,
      },
    ],
    pagination: { page, limit: 10, total: 21, totalPages: 3 },
  };
}

function configurePaperQueries() {
  setFrontendOperationHandler("categories.list", () => [
    { id: "category-1", name: "Education" },
    { id: "category-2", name: "Computer Science" },
  ]);
  setFrontendOperationHandler("papers.list", (input) =>
    paperResult(typeof input?.page === "number" ? input.page : 1),
  );
}

describe("paper library filters", () => {
  test("applies combined filters and preserves them through pagination", async () => {
    configurePaperQueries();
    const { user } = renderWithProviders(
      <PapersList
        initialFilters={{
          q: "initial query",
          categoryId: "category-1",
          difficulty: "moderate",
          sort: "title",
          page: "2",
        }}
      />,
    );

    await screen.findByText("Paper on page 2");
    const search = screen.getByRole("textbox", { name: "Search" });
    await user.clear(search);
    await user.type(search, "  neural learning  ");
    await user.selectOptions(screen.getByRole("combobox", { name: "Category" }), "category-2");
    await user.selectOptions(screen.getByRole("combobox", { name: "Difficulty" }), "expert");
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort" }), "beginner_score");
    await user.click(screen.getByRole("button", { name: "Filter" }));

    await screen.findByText("Paper on page 1");
    expect(getFrontendOperationCalls("papers.list").at(-1)).toEqual({
      q: "neural learning",
      categoryId: "category-2",
      difficulty: "expert",
      sort: "beginner_score",
      page: 1,
      limit: 10,
    });
    expect(search).toHaveProperty("value", "  neural learning  ");

    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Paper on page 2");
    expect(getFrontendOperationCalls("papers.list").at(-1)).toMatchObject({
      q: "neural learning",
      categoryId: "category-2",
      difficulty: "expert",
      sort: "beginner_score",
      page: 2,
    });
    expect(routerPushCalls).toEqual([]);
  });

  test("keeps filters and previous results mounted during a results-only refresh", async () => {
    configurePaperQueries();
    let resolveSlowQuery: ((value: ReturnType<typeof paperResult>) => void) | undefined;
    const slowQuery = new Promise<ReturnType<typeof paperResult>>((resolve) => {
      resolveSlowQuery = resolve;
    });
    setFrontendOperationHandler("papers.list", (input) =>
      input?.q === "slow query" ? slowQuery : paperResult(1, "Existing paper"),
    );
    const { user } = renderWithProviders(<PapersList initialFilters={{}} />);

    await screen.findByText("Existing paper");
    const search = screen.getByRole("textbox", { name: "Search" });
    await user.type(search, "slow query");
    await user.click(screen.getByRole("button", { name: "Filter" }));

    expect(await screen.findByText("Updating paper results...")).toBeTruthy();
    expect(screen.getByText("Existing paper")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveProperty("value", "slow query");
    expect(screen.getByRole("button", { name: "Filter" })).toBeTruthy();

    resolveSlowQuery?.(paperResult(1, "Updated paper"));
    await waitFor(() => expect(screen.getByText("Updated paper")).toBeTruthy());
    expect(screen.queryByText("Updating paper results...")).toBeNull();
  });
});
