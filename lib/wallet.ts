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
};

function failure(error: { message?: string } | null): Failure {
  const code = (error?.message ?? "").trim();
  return { ok: false, reason: MESSAGES[code] ?? "Something went wrong. Try again." };
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
  if (error) return failure(error);
  return { ok: true, data };
}

function readBalance(data: unknown): { balance: number; version: number } | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.balance !== "number" || typeof d.version !== "number") return null;
  return { balance: d.balance, version: d.version };
}

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