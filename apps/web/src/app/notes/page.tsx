import AuthGuard from "@/components/auth-guard";

import NotesOverview from "./notes-overview";

export default function NotesPage() {
  return (
    <AuthGuard>
      <NotesOverview />
    </AuthGuard>
  );
}
