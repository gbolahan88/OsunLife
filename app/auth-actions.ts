"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase-admin";
import { isUsernameAuthConfigured } from "@/lib/supabase-config";
import { normalizeUsername, USERNAME_PATTERN } from "@/lib/username";

type AuthState = { error?: string; success?: string } | undefined;

function readCredentials(formData: FormData) {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!USERNAME_PATTERN.test(username)) {
    return {
      error: "Use 3–20 letters, numbers, or underscores for your username.",
    };
  }

  if (password.length < 8) {
    return { error: "Your password must be at least 8 characters." };
  }

  return { username, password };
}

export async function signIn(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isUsernameAuthConfigured()) {
    return { error: "Account sign-in is not fully configured yet." };
  }

  const credentials = readCredentials(formData);
  if ("error" in credentials) return credentials;

  try {
    const admin = createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("username", credentials.username)
      .maybeSingle();

    if (profileError || !profile) {
      return { error: "That username and password do not match." };
    }

    const { data: account, error: accountError } =
      await admin.auth.admin.getUserById(profile.id);

    const email = account.user?.email;

    if (accountError || !email) {
      return { error: "That username and password do not match." };
    }

    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: credentials.password,
    });

    if (error) {
      return { error: "That username and password do not match." };
    }
  } catch (error) {
    console.error(
      "[signIn] Unexpected authentication error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return {
      error: "Could not reach the account service. Try again shortly.",
    };
  }

  redirect("/");
}

export async function signUp(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isUsernameAuthConfigured()) {
    return { error: "Account sign-up is not fully configured yet." };
  }

  const credentials = readCredentials(formData);
  if ("error" in credentials) return credentials;

  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );

  if (credentials.password !== passwordConfirmation) {
    return { error: "Those passwords do not match." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  try {
    const admin = createAdminClient();

    const {
      data: existingProfile,
      error: profileError,
    } = await admin
      .from("profiles")
      .select("id")
      .eq("username", credentials.username)
      .maybeSingle();

    if (profileError) {
      console.error("[signUp] Username lookup failed:", {
        code: profileError.code,
        message: profileError.message,
      });

      return {
        error:
          "Username lookup is unavailable. Apply the Supabase profile migration.",
      };
    }

    if (existingProfile) {
      return { error: "That username is already taken." };
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password: credentials.password,
      options: {
        data: { username: credentials.username },
      },
    });

    if (error) {
      console.error("[signUp] Supabase Auth signup failed:", {
        name: error.name,
        message: error.message,
        status: error.status,
        code: error.code,
      });

      return {
        error:
          "Could not create the account. Check the email or choose another username.",
      };
    }

    if (!data.session) {
      return {
        error:
          "Your account was created, but automatic sign-in did not complete. Please try signing in.",
      };
    }
  } catch (error) {
    console.error(
      "[signUp] Unexpected signup error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return {
      error: "Could not reach the account service. Try again shortly.",
    };
  }

  redirect("/");
}

export async function signOut() {
  if (isUsernameAuthConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/");
}