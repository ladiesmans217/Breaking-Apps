import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrder, listOrders } from "@/lib/store/state";

export const dynamic = "force-dynamic";

const orderSchema = z.object({
  customerEmail: z.string().email(),
  customerName: z.string().min(1),
  couponCode: z.string().optional(),
  cart: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

export async function GET() {
  return NextResponse.json({ orders: listOrders() });
}

export async function POST(request: Request) {
  const body = await request.json();
  const input = orderSchema.parse(body);
  const order = createOrder(input);
  return NextResponse.json({ order }, { status: 201 });
}
