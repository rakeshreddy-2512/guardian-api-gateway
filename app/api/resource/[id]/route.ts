import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCached, setCached } from "@/lib/cache";
import { supabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = requireAuth(req);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized: missing or invalid token" },
      { status: 401 }
    );
  }

  const rateLimit = await checkRateLimit(user.sub);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests, please try again later" },
      { status: 429 }
    );
  }

  const cacheKey = `resources:${id}`;
  const cached = await getCached<any>(cacheKey);
  if (cached) {
    return NextResponse.json({ source: "cache", data: cached });
  }

  const { data, error } = await supabase
    .from("resources")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  await setCached(cacheKey, data, 60);

  return NextResponse.json({ source: "database", data });
}
