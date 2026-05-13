import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSupabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

function ResetPasswordPage() {
  const [mode, setMode] = useState<"request" | "set">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash.includes("type=recovery")) setMode("set");
  }, []);

  const requestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const sb = await getSupabase();
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Check your email for the reset link");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const setNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      const sb = await getSupabase();
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated — you can sign in now");
      window.location.assign("/login");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm border-border bg-card p-6">
        <h1 className="mb-1 text-base font-semibold">
          {mode === "request" ? "Reset password" : "Set new password"}
        </h1>
        <p className="mb-4 text-xs text-muted-foreground">
          {mode === "request"
            ? "Enter your email — we'll send you a reset link."
            : "Enter a new password for your account."}
        </p>

        {mode === "request" ? (
          <form onSubmit={requestEmail} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        ) : (
          <form onSubmit={setNew} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-xs">New password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}

        <div className="mt-4 text-xs text-muted-foreground">
          <Link to="/login" className="hover:text-foreground">Back to sign in</Link>
        </div>
      </Card>
    </div>
  );
}
