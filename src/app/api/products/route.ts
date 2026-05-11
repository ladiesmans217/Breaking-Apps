import { NextResponse } from "next/server";
import { getProducts } from "@/lib/store/state";

export async function GET() {
  return NextResponse.json({ products: getProducts() });
}
