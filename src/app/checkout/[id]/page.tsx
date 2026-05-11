import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckoutView } from "@/components/CheckoutView";
import { getCheckout } from "@/lib/store/state";

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const checkout = getCheckout(id);
  if (!checkout) {
    notFound();
  }

  return (
    <main className="page">
      <Link className="button ghost" href="/">
        Back to store
      </Link>
      <CheckoutView checkout={checkout} />
    </main>
  );
}
