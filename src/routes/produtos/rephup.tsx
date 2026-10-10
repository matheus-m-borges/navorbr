import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/navor/PublicSite";
import { products } from "@/data/products";
export const Route = createFileRoute("/produtos/rephup")({
  head: () => ({
    meta: [
      { title: "RepHub | Representação comercial — NavorBR" },
      {
        name: "description",
        content: "Clientes, pedidos, comissões e coleções em uma operação comercial conectada.",
      },
    ],
  }),
  component: RepHubPage,
});
function RepHubPage() {
  return <ProductPage product={products.find((p) => p.slug === "rephup")!} />;
}
