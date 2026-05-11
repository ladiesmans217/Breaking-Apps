import { NextResponse } from "next/server";
import { z } from "zod";
import { resetStore } from "@/lib/store/state";

export const dynamic = "force-dynamic";

const resetSchema = z.object({
  flags: z.record(z.string(), z.boolean()).default({}),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = resetSchema.parse(body);
  const store = resetStore(parsed.flags);
  return NextResponse.json({
    ok: true,
    flags: store.flags,
    products: store.products,
  });
}
