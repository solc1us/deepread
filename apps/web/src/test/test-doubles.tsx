import { QueryClient } from "@tanstack/react-query";
import type { ComponentProps, ReactNode } from "react";

type OperationInput = Record<string, unknown> | undefined;
type OperationHandler = (input: OperationInput) => unknown | Promise<unknown>;

const handlers = new Map<string, OperationHandler>();
const calls = new Map<string, OperationInput[]>();

function recordCall(operation: string, input: OperationInput) {
  const operationCalls = calls.get(operation) ?? [];
  operationCalls.push(input);
  calls.set(operation, operationCalls);
}

function handlerFor(operation: string): OperationHandler {
  return handlers.get(operation) ?? (() => {
    throw new Error(`No frontend test handler configured for ${operation}.`);
  });
}

function queryEndpoint(operation: string) {
  return {
    queryKey: (input?: OperationInput) =>
      input === undefined ? [operation] as const : [operation, input] as const,
    queryOptions: (input?: OperationInput) => ({
      queryKey: [operation, input] as const,
      queryFn: async () => {
        recordCall(operation, input);
        return handlerFor(operation)(input);
      },
    }),
  };
}

function mutationEndpoint(operation: string) {
  return {
    mutationOptions: (options: Record<string, unknown> = {}) => ({
      ...options,
      mutationKey: [operation],
      mutationFn: async (input: OperationInput) => {
        recordCall(operation, input);
        return handlerFor(operation)(input);
      },
    }),
  };
}

const categoriesList = queryEndpoint("categories.list");
const papersList = queryEndpoint("papers.list");
const papersDetail = queryEndpoint("papers.detail");
const profileOverview = queryEndpoint("profile.getOverview");
const adminDataQualityOverview = queryEndpoint("admin.dataQuality.getOverview");
const adminDataQualityDetails = queryEndpoint("admin.dataQuality.getDetails");
const adminDashboardOverview = queryEndpoint("admin.dashboard.getOverview");
const adminPapersList = queryEndpoint("admin.papers.list");
const adminPapersDetail = queryEndpoint("admin.papers.detail");

export const trpc = {
  categories: { list: categoriesList },
  papers: { list: papersList, detail: papersDetail },
  profile: { getOverview: profileOverview },
  bookmark: {
    add: mutationEndpoint("bookmark.add"),
    remove: mutationEndpoint("bookmark.remove"),
  },
  admin: {
    dashboard: { getOverview: adminDashboardOverview },
    dataQuality: {
      getOverview: adminDataQualityOverview,
      getDetails: adminDataQualityDetails,
      resolveDuplicateGroup: mutationEndpoint("admin.dataQuality.resolveDuplicateGroup"),
    },
    papers: {
      list: adminPapersList,
      detail: adminPapersDetail,
      updateMetadata: mutationEndpoint("admin.papers.updateMetadata"),
      reclassify: mutationEndpoint("admin.papers.reclassify"),
      manualClassifyAndPublish: mutationEndpoint("admin.papers.manualClassifyAndPublish"),
      reject: mutationEndpoint("admin.papers.reject"),
      deactivate: mutationEndpoint("admin.papers.deactivate"),
    },
  },
};

export const queryClient = new QueryClient({
  defaultOptions: {
    mutations: { retry: false },
    queries: { retry: false, staleTime: 0 },
  },
});

export const routerPushCalls: string[] = [];
export const toastCalls: Array<{ type: string; message: string }> = [];

let sessionState: {
  data: { user?: { id: string } } | null;
  isPending: boolean;
} = { data: null, isPending: false };

export function setFrontendOperationHandler(operation: string, handler: OperationHandler) {
  handlers.set(operation, handler);
}

export function getFrontendOperationCalls(operation: string) {
  return calls.get(operation) ?? [];
}

export function setFrontendSession(userId?: string) {
  sessionState = userId
    ? { data: { user: { id: userId } }, isPending: false }
    : { data: null, isPending: false };
}

export function resetFrontendTestDoubles() {
  handlers.clear();
  calls.clear();
  routerPushCalls.length = 0;
  toastCalls.length = 0;
  sessionState = { data: null, isPending: false };
  queryClient.clear();
}

export const trpcModuleMock = {
  trpc,
  queryClient,
  markProfileOverviewStale: async () => undefined,
  markNotesOverviewStale: async () => undefined,
};

export const authClientModuleMock = {
  authClient: {
    useSession: () => sessionState,
  },
};

export const nextNavigationModuleMock = {
  useRouter: () => ({
    push: (href: string) => routerPushCalls.push(href),
    replace: () => undefined,
    refresh: () => undefined,
    back: () => undefined,
    forward: () => undefined,
    prefetch: async () => undefined,
  }),
};

function MockLink({ href, children, ...props }: ComponentProps<"a"> & { href: string; children?: ReactNode }) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

export const nextLinkModuleMock = {
  default: MockLink,
};

function recordToast(type: string) {
  return (message: string) => {
    toastCalls.push({ type, message });
  };
}

export const sonnerModuleMock = {
  toast: {
    success: recordToast("success"),
    error: recordToast("error"),
    warning: recordToast("warning"),
    info: recordToast("info"),
  },
};
