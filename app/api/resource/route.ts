import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCached, setCached, invalidateCache } from "@/lib/cache";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
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
      { status: 429, headers: { "X-RateLimit-Remaining": "0" } }
    );
  }

  const cacheKey = "resources:list";
  const cached = await getCached<any[]>(cacheKey);
  if (cached) {
    return NextResponse.json(
      { source: "cache", data: cached },
      { headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) } }
    );
  }

  const { data, error } = await supabase
    .from("resources")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch resources" }, { status: 500 });
  }

  await setCached(cacheKey, data, 60);

  return NextResponse.json(
    { source: "database", data },
    { headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) } }
  );
}

export async function POST(req: NextRequest) {
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

  const body = await req.json();
  const { title, itemBody } = body;

  if (!title || !itemBody) {
    return NextResponse.json(
      { error: "title and itemBody are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("resources")
    .insert({ title, body: itemBody, created_by: user.sub })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create resource" }, { status: 500 });
  }

  await invalidateCache("resources:list");

  return NextResponse.json(
    { message: "Resource created", id: data.id },
    { status: 201 }
  );
}
