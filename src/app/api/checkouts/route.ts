import { NextResponse } from "next/server";
import { z } from "zod";
import { createCheckout } from "@/lib/store/state";
import { SUPPORTED_LOCALES } from "@/lib/truth/money";

export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  customerEmail: z.string().email(),
  customerName: z.string().min(1),
  couponCode: z.string().optional(),
  locale: z.enum(SUPPORTED_LOCALES).default("en-IN"),
  cart: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  const body = await request.json();
  const input = checkoutSchema.parse(body);
  const checkout = createCheckout(input);
  return NextResponse.json({ checkout }, { status: 201 });
}
