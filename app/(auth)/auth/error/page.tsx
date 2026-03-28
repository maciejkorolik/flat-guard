import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <p className="text-sm text-zinc-400">
      {params?.error ? params.error : "Something went wrong."}
    </p>
  );
}

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/40 shadow-xl shadow-black/20 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl text-zinc-50">Auth error</CardTitle>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
          <ErrorContent searchParams={searchParams} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
