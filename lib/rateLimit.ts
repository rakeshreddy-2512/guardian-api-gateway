import { supabase } from "./supabase";

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 20;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
};

export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  const now = new Date();

  const { data: existing } = await supabase
    .from("rate_limits")
    .select("count, window_start")
    .eq("identifier", identifier)
    .maybeSingle();

  if (!existing) {
    await supabase
      .from("rate_limits")
      .insert({ identifier, count: 1, window_start: now.toISOString() });
    return { allowed: true, remaining: MAX_REQUESTS - 1, limit: MAX_REQUESTS };
  }

  const windowStart = new Date(existing.window_start);
  const elapsedSeconds = (now.getTime() - windowStart.getTime()) / 1000;

  if (elapsedSeconds > WINDOW_SECONDS) {
    await supabase
      .from("rate_limits")
      .update({ count: 1, window_start: now.toISOString() })
      .eq("identifier", identifier);
    return { allowed: true, remaining: MAX_REQUESTS - 1, limit: MAX_REQUESTS };
  }

  const newCount = existing.count + 1;
  await supabase
    .from("rate_limits")
    .update({ count: newCount })
    .eq("identifier", identifier);

  const remaining = Math.max(0, MAX_REQUESTS - newCount);
  return { allowed: newCount <= MAX_REQUESTS, remaining, limit: MAX_REQUESTS };
}
