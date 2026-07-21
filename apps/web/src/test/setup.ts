import { afterEach, mock } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

if (typeof document === "undefined") {
  GlobalRegistrator.register({ url: "http://localhost:3001" });
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame ??= (callback) =>
  window.setTimeout(() => callback(performance.now()), 0);
globalThis.cancelAnimationFrame ??= (handle) => window.clearTimeout(handle);

const testDoubles = await import("./test-doubles");

mock.module("@/utils/trpc", () => testDoubles.trpcModuleMock);
mock.module("@/lib/auth-client", () => testDoubles.authClientModuleMock);
mock.module("next/navigation", () => testDoubles.nextNavigationModuleMock);
mock.module("next/link", () => testDoubles.nextLinkModuleMock);
mock.module("sonner", () => testDoubles.sonnerModuleMock);

const { cleanup } = await import("@testing-library/react");

afterEach(() => {
  cleanup();
  testDoubles.resetFrontendTestDoubles();
  document.body.style.overflow = "";
});
