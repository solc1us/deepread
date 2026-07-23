import AuthGuard from "@/components/auth-guard";

import ProfileOverview from "./profile-overview";

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileOverview />
    </AuthGuard>
  );
}
