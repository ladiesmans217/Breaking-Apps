import { Storefront } from "@/components/Storefront";
import { getProducts } from "@/lib/store/state";

export default function Home() {
  return <Storefront products={getProducts()} />;
}
