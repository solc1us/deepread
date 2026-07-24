import { DeepReadWordmark } from "./deepread-brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-[calc(100svh-8rem)] place-items-center bg-background px-4 py-8 sm:px-6 sm:py-12 lg:min-h-[calc(100svh-4.5rem)]">
      <section className="w-full max-w-md">
        <div className="rounded-lg border bg-card p-5 shadow-sm sm:p-8">
          <DeepReadWordmark
            className="mx-auto w-48 max-w-full object-contain sm:w-52"
            priority
          />
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
