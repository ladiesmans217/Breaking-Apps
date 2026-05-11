import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrder, InsufficientInventoryError, listOrders, placeCheckoutOrder } from "@/lib/store/state";
import { SUPPORTED_LOCALES } from "@/lib/truth/money";

export const dynamic = "force-dynamic";

const orderSchema = z.object({
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

const placeCheckoutSchema = z.object({
  checkoutId: z.string(),
});

export async function GET() {
  return NextResponse.json({ orders: listOrders() });
}

export async function POST(request: Request) {
  const body = await request.json();
  try {
    if (typeof body.checkoutId === "string") {
      const input = placeCheckoutSchema.parse(body);
      const order = placeCheckoutOrder(input.checkoutId);
      return NextResponse.json({ order }, { status: 201 });
    }

    const input = orderSchema.parse(body);
    const order = createOrder(input);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof InsufficientInventoryError) {
      return NextResponse.json(
        {
          error: "Insufficient inventory",
          productId: error.productId,
          requested: error.requested,
          available: error.available,
        },
        { status: 409 },
      );
    }
    throw error;
  }
}
