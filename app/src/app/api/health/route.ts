import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "SpoonShare API is running",
    timestamp: new Date().toISOString(),
  });
}
