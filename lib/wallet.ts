// lib/wallet.ts
import { peekBrowserClient } from "@/lib/supabase-browser";

export type SpendReason = "travel" | "rent" | "furniture" | "loan_repay";

export type Failure = { ok: false; reason: string };
export type Balance = { ok: true; balance: number; version: number };

const MESSAGES: Record<string, string> = {
  not_signed_in: "Please sign in again.",
  insufficient_funds: "Not enough cash.",
  bad_amount: "That amount is not allowed.",
  bad_reason: "That payment was refused.",
  self_transfer: "You can't send money to yourself.",
  unknown_player: "That player doesn't exist.",
  unknown_action: "That isn't available here.",
  unknown_task: "That task isn't available.",
  cooldown: "This task will be available again tomorrow.",
  loan_taken: "You already took a loan.",
  bad_loan: "That loan amount is not allowed.",
  no_credit: "This furniture was bought before the wallet update, so it can't be sold for cash.",
  already_claimed: "Somebody got it first.",
  expired: "Too late, that note is gone.",
  own_drop: "You can't pick up your own money.",
  too_fast: "Slow down a little.",
  no_profile: "Your profile is missing.",
  case_pending: "Resolve your current police or court case first.",
  not_at_station: "You are not being held at State CID.",
  not_at_court: "You do not have an active court case.",
  bail_not_available: "Bail is not available for this case.",
  offering_taken: "You already took the church offering.",
};

type RpcError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

function failure(error: RpcError | null, rpcName?: string): Failure {
  const message = (error?.message ?? "").trim();
  const diagnostic = [message, error?.details, error?.hint].filter(Boolean).join(" ");
  const code = message.match(/\b[a-z][a-z0-9_]{2,}\b/i)?.[0]?.toLowerCase();
  const knownCode = code && MESSAGES[code] ? MESSAGES[code] : undefined;
  const missingCrimeRpc =
    (error?.code === "PGRST202" || error?.code === "42883" || /schema cache|does not exist/i.test(diagnostic)) &&
    (rpcName === "crime_get" || rpcName === "crime_action" || /crime_(get|action)/i.test(diagnostic));

  if (missingCrimeRpc) {
    return {
      ok: false,
      reason: "Crime gameplay isn't installed in Supabase yet. Run the 20261104000000_crime_gameplay.sql migration in the Supabase SQL Editor, then reload the schema cache.",
    };
  }
  if (knownCode) return { ok: false, reason: knownCode };

  const knownMessage = Object.entries(MESSAGES).find(([key]) =>
    new RegExp(`\\b${key}\\b`, "i").test(diagnostic),
  )?.[1];
  if (knownMessage) return { ok: false, reason: knownMessage };

  const readableMessage = message.replace(/\s+/g, " ").slice(0, 180);
  return {
    ok: false,
    reason: readableMessage || `Request failed${error?.code ? ` (${error.code})` : ""}. Try again.`,
  };
}

// Every wallet call waits for the one before it, so spends and refunds reach the server in order
let tail: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = tail.then(job, job);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

type Raw = { ok: true; data: unknown } | Failure;

async function run(name: string, args: Record<string, unknown> = {}): Promise<Raw> {
  const client = peekBrowserClient();
  if (!client) return { ok: false, reason: "Not connected yet. Try again in a moment." };
  const { data, error } = await client.rpc(name, args);
  if (error) {
    console.error(`[wallet] ${name} RPC failed:`, error);
    return failure(error, name);
  }
  return { ok: true, data };
}

function readBalance(data: unknown): { balance: number; version: number } | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.balance !== "number" || typeof d.version !== "number") return null;
  return { balance: d.balance, version: d.version };
}

export type CrimeStatus = "clear" | "station" | "court";
export type CrimeAction =
  | "bank_rob"
  | "bank_rob_escape"
  | "bank_rob_complete"
  | "bank_hack"
  | "church_offering"
  | "bail"
  | "court_wait"
  | "court_lawyer"
  | "court_defend";
export type CrimeOutcome = "state" | "loot" | "arrested" | "offering" | "released";
export type CrimeResult = Balance & {
  status: CrimeStatus;
  stolenAmount: number;
  arrestReason: "bank_theft" | "bank_hack" | null;
  offeringClaimed: boolean;
  outcome: CrimeOutcome;
  loot: number;
};

function readCrimeResult(data: unknown): CrimeResult | null {
  if (!data || typeof data !== "object") return null;
  const result = data as Record<string, unknown>;
  const balance = readBalance(data);
  if (
    !balance ||
    (result.status !== "clear" && result.status !== "station" && result.status !== "court") ||
    typeof result.stolenAmount !== "number" ||
    (result.arrestReason !== null && result.arrestReason !== "bank_theft" && result.arrestReason !== "bank_hack") ||
    typeof result.offeringClaimed !== "boolean" ||
    (result.outcome !== "state" && result.outcome !== "loot" && result.outcome !== "arrested" && result.outcome !== "offering" && result.outcome !== "released") ||
    typeof result.loot !== "number"
  ) {
    return null;
  }
  return {
    ok: true,
    ...balance,
    status: result.status,
    stolenAmount: result.stolenAmount,
    arrestReason: result.arrestReason,
    offeringClaimed: result.offeringClaimed,
    outcome: result.outcome,
    loot: result.loot,
  };
}

function crimeCall(name: "crime_get" | "crime_action", args: Record<string, unknown> = {}) {
  return enqueue(async (): Promise<CrimeResult | Failure> => {
    const res = await run(name, args);
    if (!res.ok) return res;
    const parsed = readCrimeResult(res.data);
    if (!parsed) return { ok: false, reason: "Unexpected reply. Try again." };
    return parsed;
  });
}

export const getCrimeState = () => crimeCall("crime_get");
export const performCrimeAction = (action: CrimeAction) =>
  crimeCall("crime_action", { p_action: action });

function balanceCall(name: string, args: Record<string, unknown> = {}): Promise<Balance | Failure> {
  return enqueue(async (): Promise<Balance | Failure> => {
    const res = await run(name, args);
    if (!res.ok) return res;
    const parsed = readBalance(res.data);
    if (!parsed) return { ok: false, reason: "Unexpected reply. Try again." };
    return { ok: true, balance: parsed.balance, version: parsed.version };
  });
}

export const walletGet = () => balanceCall("wallet_get");

export const walletSpend = (amount: number, reason: SpendReason, ref?: string) =>
  balanceCall("wallet_spend", { p_amount: amount, p_reason: reason, p_ref: ref ?? null });

export const walletRefundFurniture = (price: number) =>
  balanceCall("wallet_refund_furniture", { p_price: price });

export const walletTakeLoan = (amount: number) =>
  balanceCall("wallet_take_loan", { p_amount: amount });

export const claimTask = (taskId: string) => balanceCall("claim_task", { p_task: taskId });

export const venueBuy = (venue: string, actionId: string) =>
  balanceCall("venue_buy", { p_venue: venue, p_action: actionId });

export function claimDrop(
  dropId: string,
): Promise<(Balance & { amount: number }) | Failure> {
  return enqueue(async (): Promise<(Balance & { amount: number }) | Failure> => {
    const res = await run("claim_drop", { p_id: dropId });
    if (!res.ok) return res;
    const parsed = readBalance(res.data);
    const amount = (res.data as Record<string, unknown> | null)?.amount;
    if (!parsed || typeof amount !== "number") return { ok: false, reason: "Unexpected reply. Try again." };
    return { ok: true, balance: parsed.balance, version: parsed.version, amount };
  });
}

export function sendMoney(
  recipientId: string,
  amount: number,
): Promise<(Balance & { message: unknown }) | Failure> {
  return enqueue(async (): Promise<(Balance & { message: unknown }) | Failure> => {
    const res = await run("send_money", { p_recipient: recipientId, p_amount: amount });
    if (!res.ok) return res;
    const parsed = readBalance(res.data);
    if (!parsed) return { ok: false, reason: "Unexpected reply. Try again." };
    const message = (res.data as Record<string, unknown>).message ?? null;
    return { ok: true, balance: parsed.balance, version: parsed.version, message };
  });
}