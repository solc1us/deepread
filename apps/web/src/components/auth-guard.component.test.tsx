import { describe, expect, test } from "bun:test";

import {
  routerReplaceCalls,
  sessionRefetchCalls,
  setFrontendPathname,
  setFrontendSession,
  setFrontendSessionError,
  setFrontendSessionPending,
} from "@/test/test-doubles";
import {
  renderWithProviders,
  screen,
  waitFor,
} from "@/test/render";

import AppShell from "./app-shell";
import AuthGuard from "./auth-guard";

describe("authentication guards", () => {
  test("pending sessions show a bounded loading state without redirecting", () => {
    setFrontendSessionPending();
    renderWithProviders(
      <AuthGuard>
        <p>Protected profile</p>
      </AuthGuard>,
    );

    expect(screen.getByRole("status").textContent).toContain(
      "Checking your session",
    );
    expect(screen.queryByText("Protected profile")).toBeNull();
    expect(routerReplaceCalls).toEqual([]);
  });

  test("session request failures remain errors and can be retried", async () => {
    setFrontendSessionError();
    const { user } = renderWithProviders(
      <AuthGuard>
        <p>Protected profile</p>
      </AuthGuard>,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "We could not verify your session.",
    );
    expect(routerReplaceCalls).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Retry session check" }));
    expect(sessionRefetchCalls).toHaveLength(1);
  });

  test("confirmed unauthenticated sessions redirect with the requested path", async () => {
    setFrontendPathname("/profile");
    renderWithProviders(
      <AuthGuard>
        <p>Protected profile</p>
      </AuthGuard>,
    );

    await waitFor(() =>
      expect(routerReplaceCalls).toEqual(["/login?next=%2Fprofile"]),
    );
    expect(screen.queryByText("Protected profile")).toBeNull();
  });

  test("authenticated readers can open profile content but not admin content", async () => {
    setFrontendSession("reader-id");
    const profile = renderWithProviders(
      <AuthGuard>
        <p>Protected profile</p>
      </AuthGuard>,
    );
    expect(screen.getByText("Protected profile")).toBeTruthy();
    profile.unmount();

    renderWithProviders(
      <AuthGuard requireAdmin>
        <p>Protected admin</p>
      </AuthGuard>,
    );
    await waitFor(() => expect(routerReplaceCalls).toEqual(["/papers"]));
    expect(screen.queryByText("Protected admin")).toBeNull();
  });

  test("admin sidebar and route guard use the same current session", () => {
    setFrontendSession("admin-id", "admin");
    renderWithProviders(
      <AppShell>
        <AuthGuard requireAdmin>
          <p>Protected admin</p>
        </AuthGuard>
      </AppShell>,
    );

    expect(screen.getByText("Protected admin")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Data Quality" }).length).toBeGreaterThan(0);
    expect(routerReplaceCalls).toEqual([]);
  });
});
