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
import { useState } from "react";

const authCardClass =
  "border-zinc-800 bg-zinc-900/40 shadow-xl shadow-black/20 backdrop-blur-sm";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/update-password`,
        },
      );
      if (resetError) throw resetError;
      setSuccess(true);
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
          Reset password
        </h1>
        <p className="text-sm text-zinc-400">
          We will email you a link if an account exists
        </p>
      </div>

      {success ? (
        <Card className={authCardClass}>
          <CardHeader>
            <CardTitle className="text-lg text-zinc-50">Check your email</CardTitle>
            <CardDescription className="text-zinc-400">
              Reset instructions sent
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-400">
              If this email is registered, you will receive a reset link shortly.
            </p>
            <Button
              asChild
              variant="outline"
              className="mt-6 w-full border-zinc-700 bg-zinc-950/50 text-zinc-100"
            >
              <Link href="/auth/login">Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className={authCardClass}>
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg text-zinc-50">Forgot password</CardTitle>
            <CardDescription className="text-zinc-400">
              Enter your account email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
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
                {isLoading ? "Sending…" : "Send reset email"}
              </Button>
              <p className="text-center text-sm text-zinc-500">
                <Link
                  href="/auth/login"
                  className="font-medium text-teal-400/90 underline-offset-4 hover:text-teal-300 hover:underline"
                >
                  Back to sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
