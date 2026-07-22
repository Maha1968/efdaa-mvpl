"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MojodaaLogo } from "@/components/brand/mojodaa-logo";
import { cn } from "@/lib/utils/cn";

type AuthMode = "signin" | "signup";
type AuthMethod = "email" | "phone";

type LoginFormProps = {
  nextUrl?: string;
};

export function LoginForm({ nextUrl = "/" }: LoginFormProps) {
  const [method, setMethod] = useState<AuthMethod>("email");
  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fromShareLink = nextUrl.startsWith("/t/");

  async function handleEmailSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const callbackWithNext = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`;

    if (mode === "signup") {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: callbackWithNext,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
      } else if (signUpData.session) {
        window.location.href = nextUrl;
      } else {
        setMessage(
          "Account created. Check your email to confirm — you’ll return to the same offer after confirming.",
        );
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        window.location.href = nextUrl;
      }
    }

    setLoading(false);
  }

  async function handleSendOtp(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const formattedPhone = phone.startsWith("+") ? phone : `+${phone}`;

    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
      options: {
        data: mode === "signup" ? { name } : undefined,
      },
    });

    if (otpError) {
      setError(otpError.message);
    } else {
      setOtpSent(true);
      setMessage("Code sent. Enter it below to continue.");
    }
    setLoading(false);
  }

  async function handleVerifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const formattedPhone = phone.startsWith("+") ? phone : `+${phone}`;

    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token: otp,
      type: "sms",
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    window.location.href = nextUrl;
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-5 flex justify-center">
          <MojodaaLogo height={56} priority />
        </div>
        <h1 className="text-page-title text-text-primary">
          {mode === "signup" ? "Join MOJODAA" : "Welcome back"}
        </h1>
        <p className="text-supporting mt-2">
          {fromShareLink
            ? "Sign in to see what your friend shared — you’ll land right back on their find."
            : "Share discoveries you love. Friends earn points when they buy."}
        </p>
      </div>

      <div
        className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1"
        role="tablist"
        aria-label="Sign-in method"
      >
        {(["email", "phone"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={method === m}
            onClick={() => {
              setMethod(m);
              setOtpSent(false);
              setError(null);
              setMessage(null);
            }}
            className={cn(
              "rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
              method === m
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {m === "email" ? "Email" : "Phone"}
          </button>
        ))}
      </div>

      <Card className="p-5 sm:p-6">
        {method === "email" ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Priya"
                  autoComplete="name"
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <Button type="submit" fullWidth loading={loading}>
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>
        ) : !otpSent ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="phone-name">Your name</Label>
                <Input
                  id="phone-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Priya"
                  autoComplete="name"
                />
              </div>
            )}
            <div>
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                autoComplete="tel"
              />
              <p className="text-caption mt-1.5">
                Include country code, e.g. +91 for India.
              </p>
            </div>
            <Button type="submit" fullWidth loading={loading}>
              Send code
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <Label htmlFor="otp">Verification code</Label>
              <Input
                id="otp"
                type="text"
                required
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                autoComplete="one-time-code"
              />
            </div>
            <Button type="submit" fullWidth loading={loading}>
              Verify and continue
            </Button>
            <Button
              type="button"
              variant="tertiary"
              fullWidth
              size="md"
              onClick={() => setOtpSent(false)}
            >
              Use a different number
            </Button>
          </form>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-error-soft px-4 py-3 text-sm text-error"
          >
            {error}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="mt-4 rounded-lg bg-success-soft px-4 py-3 text-sm text-success"
          >
            {message}
          </p>
        )}
      </Card>

      <p className="mt-6 text-center text-sm text-text-secondary">
        {mode === "signup" ? "Already have an account?" : "New to MOJODAA?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError(null);
            setMessage(null);
          }}
          className="font-semibold text-primary underline-offset-2 hover:underline"
        >
          {mode === "signup" ? "Sign in" : "Create account"}
        </button>
      </p>
    </div>
  );
}
