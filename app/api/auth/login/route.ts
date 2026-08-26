import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, password_hash, role")
    .eq("email", email)
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  return NextResponse.json({
    token,
    tokenType: "Bearer",
    expiresIn: 3600,
  });
}
