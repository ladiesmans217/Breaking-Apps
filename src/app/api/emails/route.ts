import { NextResponse } from "next/server";
import { listEmails } from "@/lib/email/inbox";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email") ?? undefined;
  return NextResponse.json({ messages: listEmails(email) });
}
