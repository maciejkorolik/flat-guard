import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignUpSuccessPage() {
  return (
    <Card className="border-zinc-800 bg-zinc-900/40 shadow-xl shadow-black/20 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl text-zinc-50">Check your email</CardTitle>
        <CardDescription className="text-zinc-400">
          Confirm your account to sign in
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-zinc-400">
          We sent a confirmation link. Open it, then return here to log in.
        </p>
      </CardContent>
    </Card>
  );
}
