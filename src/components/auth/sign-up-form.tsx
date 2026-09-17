"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { PASSWORD_RULES, isPasswordValid } from "@/lib/password";
import { cn } from "cn";
import { GoogleButton } from "./google-button";
import { PasswordInput } from "./password-input";

export function SignUpForm() {
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const passwordValid = isPasswordValid(password);
  const passwordsMatch = password === repeatPassword;
  const canSubmit = passwordValid && passwordsMatch;

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!passwordValid) {
      setError("Password doesn't meet the requirements below");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/app`,
        // Stored as JSON on the login record itself (auth.users.raw_user_meta_data) —
        // no separate profiles table needed for a simple display name + phone.
        data: {
          display_name: displayName.trim(),
          phone: phone.trim() || null,
        },
      },
    });
    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }
    router.push("/auth/sign-up-success");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>You&apos;ll set up your restaurant right after</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignUp} className="flex flex-col gap-6">
          <div className="grid gap-2">
            <Label htmlFor="display-name">Your name</Label>
            <Input
              id="display-name"
              autoComplete="name"
              required
              placeholder="Jane Smith"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+1 555 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(password);
                return (
                  <li
                    key={rule.key}
                    className={cn(
                      "flex items-center gap-1.5",
                      met ? "text-emerald-600 dark:text-emerald-500" : "text-muted-foreground"
                    )}
                  >
                    {met ? (
                      <Check size={12} className="shrink-0" />
                    ) : (
                      <span className="size-3 shrink-0 rounded-full border border-current" />
                    )}
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="repeat-password">Repeat password</Label>
            <PasswordInput
              id="repeat-password"
              autoComplete="new-password"
              required
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
            />
            {repeatPassword.length > 0 && (
              <p
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  passwordsMatch ? "text-emerald-600 dark:text-emerald-500" : "text-destructive"
                )}
              >
                {passwordsMatch ? (
                  <Check size={12} className="shrink-0" />
                ) : (
                  <span className="size-3 shrink-0 rounded-full border border-current" />
                )}
                {passwordsMatch ? "Passwords match" : "Passwords do not match"}
              </p>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={isLoading || !canSubmit}>
            {isLoading ? "Creating account..." : "Sign up"}
          </Button>
          <GoogleButton />
          <p className="text-center text-sm">
            Already have an account?{" "}
            <Link href="/auth/login" className="underline underline-offset-4">
              Log in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
