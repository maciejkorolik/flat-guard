"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const authCardClass =
  "border-zinc-800 bg-zinc-900/40 shadow-xl shadow-black/20 backdrop-blur-sm";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const { error: signError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (signError) throw signError;
      router.push("/auth/sign-up-success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="space-y-1 text-center md:text-left">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Create account
        </h1>
        <p className="text-sm text-zinc-400">Sign up with email and password</p>
      </div>

      <Card className={authCardClass}>
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-lg text-zinc-50">Sign up</CardTitle>
          <CardDescription className="text-zinc-400">
            You will confirm via email if required by your project settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-zinc-700 bg-zinc-950/50 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-zinc-700 bg-zinc-950/50 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repeat-password" className="text-zinc-300">
                Repeat password
              </Label>
              <Input
                id="repeat-password"
                type="password"
                required
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                className="border-zinc-700 bg-zinc-950/50 text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            {error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              className="h-11 w-full bg-teal-600 text-white hover:bg-teal-500"
              disabled={isLoading}
            >
              {isLoading ? "Creating account…" : "Sign up"}
            </Button>
            <p className="text-center text-sm text-zinc-500">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="font-medium text-teal-400/90 underline-offset-4 hover:text-teal-300 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
