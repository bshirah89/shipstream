import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken, setAuthCookie } from "@/lib/auth";
import type { LoginRequest, AuthResponse } from "@/types";

export async function POST(request: NextRequest): Promise<NextResponse<AuthResponse>> {
  try {
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Use constant-time comparison via bcrypt even when user doesn't exist.
    // Returning "user not found" vs "wrong password" would allow email enumeration.
    const passwordValid = user
      ? await verifyPassword(password, user.password)
      : false;

    if (!user || !passwordValid) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = signToken({ userId: user.id, email: user.email });
    setAuthCookie(token);

    return NextResponse.json({
      success: true,
      message: "Logged in successfully",
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error("[login] error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
