export interface E2EState {
  runId: string;
  password: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  admin: {
    id: string;
    email: string;
    name: string;
  };
  category: {
    id: string;
    name: string;
  };
  secondaryCategory: {
    id: string;
    name: string;
  };
  publishedPaperIds: string[];
  primaryPaper: {
    id: string;
    title: string;
  };
  unpublishedPaper: {
    id: string;
    title: string;
  };
  needsReviewPaper: {
    id: string;
    title: string;
  };
  duplicateTitle: string;
}
