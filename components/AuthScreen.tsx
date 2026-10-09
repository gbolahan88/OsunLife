"use client";

import { useActionState, useEffect, useState } from "react";
import {
  ArrowRight,
  CircleAlert,
  Compass,
  Eye,
  EyeOff,
  KeyRound,
  UserRound,
  X,
} from "lucide-react";
import { signIn, signUp } from "@/app/auth-actions";
import OsogboWorld from "@/components/OsogboWorld";

type AuthMode = "welcome" | "sign-in" | "create";

export default function AuthScreen({
  configured,
}: {
  configured: boolean;
}) {
  const [mode, setMode] = useState<AuthMode>("welcome");
  const [signInState, signInAction, signInPending] =
    useActionState(signIn, undefined);
  const [signUpState, signUpAction, signUpPending] =
    useActionState(signUp, undefined);

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false);

  const isCreate = mode !== "sign-in";
  const isDialogOpen = mode !== "welcome";
  const state = isCreate ? signUpState : signInState;
  const pending = isCreate ? signUpPending : signInPending;

  useEffect(() => {
    if (!isDialogOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMode("welcome");
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isDialogOpen]);

  return (
    <main className="relative h-dvh min-h-[560px] overflow-hidden bg-[#276b7c] text-[#18382d]">
      <OsogboWorld
        active
        interactive={false}
        onEnterBuilding={() => undefined}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-[#153d38]/20 via-transparent to-[#173c32]/25"
      />

      <header className="absolute inset-x-0 top-0 z-20 px-3 pt-[calc(env(safe-area-inset-top)+12px)] sm:px-5">
        <div className="mx-auto flex max-w-[1060px] items-center justify-between gap-3 rounded-full border border-white/75 bg-white/95 px-3 py-2 shadow-[0_8px_28px_rgba(24,50,39,.2)] backdrop-blur-md sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eaf1e9] text-[#b58825]">
              <Compass size={19} />
            </span>

            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-extrabold tracking-[0.08em] sm:text-sm">
                OSUN LIFE
              </p>
              <p className="mt-0.5 text-[9px] font-semibold tracking-[0.1em] text-[#78857b] sm:text-[10px]">
                OSOGBO · OSUN STATE
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setMode("create")}
              className="h-9 rounded-full bg-[#20ad70] px-3.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-[#168e5b] sm:px-5 sm:text-xs"
            >
              Create account
            </button>

            <button
              type="button"
              onClick={() => setMode("sign-in")}
              className="h-9 rounded-full bg-[#f1f4f0] px-3.5 text-[11px] font-bold text-[#24382d] transition-colors hover:bg-[#e5ece4] sm:px-5 sm:text-xs"
            >
              Sign in
            </button>
          </div>
        </div>
      </header>

      <section className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom)+18px)] sm:px-5 sm:pb-7">
        <div className="mx-auto max-w-[440px] rounded-[10px] border border-white/80 bg-white/95 p-4 shadow-[0_16px_46px_rgba(18,43,34,.28)] backdrop-blur-md sm:p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex -space-x-2" aria-hidden="true">
              {(["#dca35d", "#a95e43", "#547e66"] as const).map(
                (color, index) => (
                  <span
                    key={color}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-white"
                    style={{ backgroundColor: color }}
                  >
                    <UserRound size={14 + (index % 2)} />
                  </span>
                ),
              )}
            </div>

            <p className="text-[11px] font-semibold leading-4 text-[#56675a]">
              Your own username. Your own Osun story.
            </p>
          </div>

          <h1 className="text-lg font-extrabold leading-tight text-[#1d3428] sm:text-xl">
            Find your place in Osogbo.
          </h1>

          <p className="mt-1 text-xs leading-5 text-[#68776b]">
            Register with your email, then use your username and password to
            play.
          </p>

          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              onClick={() => setMode("create")}
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#20ad70] px-4 text-sm font-bold text-white shadow-[0_5px_14px_rgba(20,145,90,.23)] transition-colors hover:bg-[#168e5b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e5b]"
            >
              Create account <ArrowRight size={16} />
            </button>

            <button
              type="button"
              onClick={() => setMode("sign-in")}
              className="h-11 rounded-full border border-[#dce4dc] bg-white px-5 text-sm font-bold text-[#293c30] transition-colors hover:bg-[#f3f6f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e5b]"
            >
              Log in
            </button>
          </div>
        </div>
      </section>

      {isDialogOpen && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-[#11261f]/42 p-3 backdrop-blur-[3px] sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setMode("welcome");
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            className="relative max-h-[calc(100dvh-24px)] w-full max-w-[430px] overflow-y-auto rounded-[10px] border border-white/80 bg-[#f9fbf6] px-5 py-6 shadow-[0_24px_80px_rgba(13,37,27,.35)] sm:px-8 sm:py-7"
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setMode("welcome")}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-[#68776b] transition-colors hover:bg-[#eaf0e8] hover:text-[#1b3329] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26724f]"
            >
              <X size={18} />
            </button>

            <div className="mb-5 pr-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#718276]">
                Player account
              </p>

              <h2
                id="auth-title"
                className="mt-1.5 text-[24px] font-bold leading-tight text-[#1b3329]"
              >
                {isCreate ? "Create your username" : "Welcome back"}
              </h2>

              <p className="mt-1.5 text-sm leading-5 text-[#68776b]">
                {isCreate
                  ? "Add your email and choose your login details to get started."
                  : "Sign in with the username and password you chose."}
              </p>
            </div>

            <div
              className="mb-5 grid grid-cols-2 rounded-md bg-[#eaf0e8] p-1"
              role="tablist"
              aria-label="Account action"
            >
              <button
                type="button"
                role="tab"
                aria-selected={isCreate}
                onClick={() => setMode("create")}
                className={`h-9 rounded-sm text-sm font-semibold transition-colors ${
                  isCreate
                    ? "bg-white text-[#214c3a] shadow-sm"
                    : "text-[#708074] hover:text-[#214c3a]"
                }`}
              >
                Create account
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={!isCreate}
                onClick={() => setMode("sign-in")}
                className={`h-9 rounded-sm text-sm font-semibold transition-colors ${
                  !isCreate
                    ? "bg-white text-[#214c3a] shadow-sm"
                    : "text-[#708074] hover:text-[#214c3a]"
                }`}
              >
                Sign in
              </button>
            </div>

            <form
              action={isCreate ? signUpAction : signInAction}
              className="space-y-3.5"
            >
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#334a3c]">
                  Username
                </span>

                <span className="flex h-11 items-center gap-3 rounded-md border border-[#d7e0d4] bg-white px-3.5 transition focus-within:border-[#438263] focus-within:ring-2 focus-within:ring-[#438263]/15">
                  <UserRound
                    size={17}
                    className="shrink-0 text-[#819084]"
                  />

                  <input
                    name="username"
                    type="text"
                    required
                    minLength={3}
                    maxLength={20}
                    pattern="[A-Za-z0-9_]{3,20}"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    placeholder="e.g. tobi_ade"
                    disabled={!configured || pending}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#1c3529] outline-none placeholder:text-[#a1aca1] disabled:cursor-not-allowed"
                  />
                </span>

                {isCreate && (
                  <span className="mt-1 block text-[11px] text-[#849084]">
                    3–20 letters, numbers, or underscores
                  </span>
                )}
              </label>

              {isCreate && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-[#334a3c]">
                    Email
                  </span>

                  <span className="flex h-11 items-center gap-3 rounded-md border border-[#d7e0d4] bg-white px-3.5 transition focus-within:border-[#438263] focus-within:ring-2 focus-within:ring-[#438263]/15">
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-sm font-bold text-[#819084]"
                    >
                      @
                    </span>

                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      autoCapitalize="none"
                      placeholder="you@example.com"
                      disabled={!configured || pending}
                      className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#1c3529] outline-none placeholder:text-[#a1aca1] disabled:cursor-not-allowed"
                    />
                  </span>
                </label>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#334a3c]">
                  Password
                </span>

                <span className="flex h-11 items-center gap-3 rounded-md border border-[#d7e0d4] bg-white px-3.5 transition focus-within:border-[#438263] focus-within:ring-2 focus-within:ring-[#438263]/15">
                  <KeyRound
                    size={17}
                    className="shrink-0 text-[#819084]"
                  />

                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete={
                      isCreate ? "new-password" : "current-password"
                    }
                    placeholder="At least 8 characters"
                    disabled={!configured || pending}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#1c3529] outline-none placeholder:text-[#a1aca1] disabled:cursor-not-allowed"
                  />

                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                    disabled={!configured || pending}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#718276] transition-colors hover:bg-[#eaf0e8] hover:text-[#214c3a] disabled:cursor-not-allowed"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>

              {isCreate && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-[#334a3c]">
                    Confirm password
                  </span>

                  <span className="flex h-11 items-center gap-3 rounded-md border border-[#d7e0d4] bg-white px-3.5 transition focus-within:border-[#438263] focus-within:ring-2 focus-within:ring-[#438263]/15">
                    <KeyRound
                      size={17}
                      className="shrink-0 text-[#819084]"
                    />

                    <input
                      name="passwordConfirmation"
                      type={
                        showPasswordConfirmation ? "text" : "password"
                      }
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Enter your password again"
                      disabled={!configured || pending}
                      className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#1c3529] outline-none placeholder:text-[#a1aca1] disabled:cursor-not-allowed"
                    />

                    <button
                      type="button"
                      aria-label={
                        showPasswordConfirmation
                          ? "Hide confirmation password"
                          : "Show confirmation password"
                      }
                      aria-pressed={showPasswordConfirmation}
                      onClick={() =>
                        setShowPasswordConfirmation((visible) => !visible)
                      }
                      disabled={!configured || pending}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#718276] transition-colors hover:bg-[#eaf0e8] hover:text-[#214c3a] disabled:cursor-not-allowed"
                    >
                      {showPasswordConfirmation ? (
                        <EyeOff size={17} />
                      ) : (
                        <Eye size={17} />
                      )}
                    </button>
                  </span>
                </label>
              )}

              {state?.error && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-[#e6c9bc] bg-[#fff5ef] px-3 py-2.5 text-xs leading-5 text-[#8e4934]"
                >
                  <CircleAlert
                    size={15}
                    className="mt-0.5 shrink-0"
                  />
                  {state.error}
                </p>
              )}

              {state?.success && (
                <p
                  role="status"
                  className="rounded-md border border-[#bddbc8] bg-[#eef8f0] px-3 py-2.5 text-xs leading-5 text-[#286342]"
                >
                  {state.success}
                </p>
              )}

              {!configured && (
                <p
                  role="status"
                  className="rounded-md border border-[#e2d7b6] bg-[#fbf7e9] px-3 py-2.5 text-xs leading-5 text-[#75643a]"
                >
                  Add the Supabase URL and publishable key, a server-only
                  secret key, and apply the profile migration.
                </p>
              )}

              <button
                type="submit"
                disabled={!configured || pending}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#26724f] px-4 text-sm font-bold text-white shadow-[0_5px_12px_rgba(29,91,61,.18)] transition-colors hover:bg-[#1e6041] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26724f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending
                  ? "Please wait…"
                  : isCreate
                    ? "Create account"
                    : "Sign in"}

                {!pending && <ArrowRight size={17} />}
              </button>
            </form>

            <p className="mt-4 text-center text-[11px] leading-5 text-[#819084]">
              Your username is used to log in. Email confirmation is disabled.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
