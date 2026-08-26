import { supabase } from "./supabase";

const DEFAULT_TTL_SECONDS = 60;

export async function getCached<T>(key: string): Promise<T | null> {
  const { data } = await supabase
    .from("cache_entries")
    .select("value, expires_at")
    .eq("key", key)
    .maybeSingle();

  if (!data) return null;

  if (new Date(data.expires_at).getTime() < Date.now()) {
    await supabase.from("cache_entries").delete().eq("key", key);
    return null;
  }

  return data.value as T;
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await supabase
    .from("cache_entries")
    .upsert({ key, value: value as any, expires_at: expiresAt });
}

export async function invalidateCache(key: string): Promise<void> {
  await supabase.from("cache_entries").delete().eq("key", key);
}
