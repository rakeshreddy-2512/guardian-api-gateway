import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET!;

export type TokenPayload = {
  sub: string;
  email: string;
  role: string;
};

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.split(" ")[1];
}

export function requireAuth(req: NextRequest): TokenPayload | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}
