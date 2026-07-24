"use client";

import { useState } from "react";

import AuthLayout from "@/components/auth-layout";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export default function LoginPanel({
  returnPath,
}: {
  returnPath?: string;
}) {
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <AuthLayout>
      {showSignIn ? (
        <SignInForm
          onSwitchToSignUp={() => setShowSignIn(false)}
          returnPath={returnPath}
        />
      ) : (
        <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
      )}
    </AuthLayout>
  );
}
