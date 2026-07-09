"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

  async function handleEmailSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setMessage("Account created. Check your email to confirm, or sign in if confirmation is off.");
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
      options: mode === "signup" && name ? { data: { name } } : undefined,
    });

    if (otpError) {
      setError(otpError.message);
    } else {
      setOtpSent(true);
      setMessage("We sent a code to your phone. Enter it below.");
    }

    setLoading(false);
  }

  async function handleVerifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

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
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-700">
          EFDAA
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Sign in with email or phone to start sharing tokens.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-zinc-100 p-1">
        <button
          type="button"
          onClick={() => {
            setMethod("email");
            setOtpSent(false);
            setError(null);
            setMessage(null);
          }}
          className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            method === "email"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-600"
          }`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => {
            setMethod("phone");
            setOtpSent(false);
            setError(null);
            setMessage(null);
          }}
          className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            method === "phone"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-600"
          }`}
        >
          Phone
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        {method === "email" ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Your name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mahadevann"
                  className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
            >
              {loading
                ? "Please wait..."
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>
        ) : !otpSent ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label htmlFor="phone-name" className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Your name
                </label>
                <input
                  id="phone-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mahadevann"
                  className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            )}

            <div>
              <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-zinc-700">
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <p className="mt-1.5 text-xs text-zinc-500">
                Include country code, e.g. +91 for India.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label htmlFor="otp" className="mb-1.5 block text-sm font-medium text-zinc-700">
                Verification code
              </label>
              <input
                id="otp"
                type="text"
                required
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify and sign in"}
            </button>

            <button
              type="button"
              onClick={() => setOtpSent(false)}
              className="w-full text-sm text-zinc-600 underline"
            >
              Use a different number
            </button>
          </form>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {message && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-zinc-600">
        {mode === "signup" ? "Already have an account?" : "New to EFDAA?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError(null);
            setMessage(null);
          }}
          className="font-medium text-emerald-700 underline"
        >
          {mode === "signup" ? "Sign in" : "Create account"}
        </button>
      </p>
    </div>
  );
}
