import { Button } from "@deepread/ui/components/button";
import { Input } from "@deepread/ui/components/input";
import { Label } from "@deepread/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

export default function SignUpForm({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const router = useRouter();
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      name: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
        },
        {
          onSuccess: () => {
            router.push("/profile" as Route);
            toast.success("Sign up successful");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="w-full">
      <div className="mb-7 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Create your account</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Start discovering papers matched to your reading level.
        </p>
      </div>

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.Field name="name">
          {(field) => {
            const hasErrors = field.state.meta.errors.length > 0;
            const errorId = `${field.name}-error`;

            return (
              <div className="space-y-2">
                <Label className="text-sm" htmlFor={field.name}>
                  Name
                </Label>
                <Input
                  aria-describedby={hasErrors ? errorId : undefined}
                  aria-invalid={hasErrors}
                  autoComplete="name"
                  className="h-10 px-3 text-sm md:text-sm"
                  id={field.name}
                  name={field.name}
                  placeholder="Your name"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {hasErrors ? (
                  <div className="rounded-md bg-destructive/10 px-3 py-2" id={errorId} role="alert">
                    {field.state.meta.errors.map((error) => (
                      <p className="text-xs text-destructive" key={error?.message}>
                        {error?.message}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          }}
        </form.Field>

        <form.Field name="email">
          {(field) => {
            const hasErrors = field.state.meta.errors.length > 0;
            const errorId = `${field.name}-error`;

            return (
              <div className="space-y-2">
                <Label className="text-sm" htmlFor={field.name}>
                  Email
                </Label>
                <Input
                  aria-describedby={hasErrors ? errorId : undefined}
                  aria-invalid={hasErrors}
                  autoComplete="email"
                  className="h-10 px-3 text-sm md:text-sm"
                  id={field.name}
                  name={field.name}
                  placeholder="you@example.com"
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {hasErrors ? (
                  <div className="rounded-md bg-destructive/10 px-3 py-2" id={errorId} role="alert">
                    {field.state.meta.errors.map((error) => (
                      <p className="text-xs text-destructive" key={error?.message}>
                        {error?.message}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          }}
        </form.Field>

        <form.Field name="password">
          {(field) => {
            const hasErrors = field.state.meta.errors.length > 0;
            const errorId = `${field.name}-error`;

            return (
              <div className="space-y-2">
                <Label className="text-sm" htmlFor={field.name}>
                  Password
                </Label>
                <Input
                  aria-describedby={hasErrors ? errorId : undefined}
                  aria-invalid={hasErrors}
                  autoComplete="new-password"
                  className="h-10 px-3 text-sm md:text-sm"
                  id={field.name}
                  name={field.name}
                  placeholder="At least 8 characters"
                  type="password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {hasErrors ? (
                  <div className="rounded-md bg-destructive/10 px-3 py-2" id={errorId} role="alert">
                    {field.state.meta.errors.map((error) => (
                      <p className="text-xs text-destructive" key={error?.message}>
                        {error?.message}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          }}
        </form.Field>

        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button
              aria-busy={isSubmitting}
              className="h-10 w-full text-sm"
              disabled={!canSubmit || isSubmitting}
              type="submit"
            >
              {isSubmitting ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-6 border-t pt-5 text-center">
        <span className="text-sm text-muted-foreground">Already have an account?</span>
        <Button
          className="ml-1 h-auto px-1 py-0 text-sm"
          onClick={onSwitchToSignIn}
          type="button"
          variant="link"
        >
          Sign in
        </Button>
      </div>
    </div>
  );
}
