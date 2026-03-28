import { Plus_Jakarta_Sans } from "next/font/google";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";

const authFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
});

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${authFont.className} relative min-h-svh overflow-hidden bg-zinc-950 text-zinc-100`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(45,212,191,0.12),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_40%,transparent)]"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-svh flex-col">
        <header className="flex shrink-0 justify-center px-6 pt-10 md:pt-14">
          <Link
            href="/auth/login"
            className="text-sm font-semibold tracking-tight text-teal-400/90 transition-colors hover:text-teal-300"
          >
            Hackathon
          </Link>
        </header>

        {!hasEnvVars ? (
          <div className="mx-auto mt-6 w-full max-w-md px-6">
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100/90">
              Set{" "}
              <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">
                NEXT_PUBLIC_SUPABASE_URL
              </code>{" "}
              and{" "}
              <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">
                NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
              </code>{" "}
              in <code className="font-mono text-xs">.env.local</code>.
            </p>
          </div>
        ) : null}

        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-8 md:pb-20">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
