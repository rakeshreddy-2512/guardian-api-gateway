import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from("users")
    .insert({ email, password_hash: passwordHash, role: "consumer" })
    .select("id, email, role")
    .single();

  if (error) {
    console.error("[signup] Supabase error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { message: "Account created", user: data },
    { status: 201 }
  );
}
