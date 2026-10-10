import { products } from "@/data/products";

export function NavorFooter() {
  return (
    <footer className="nv-footer">
      <div className="nv-footer-top">
        <a href="/" className="nv-logo">
          <img
            src="/navorbr-logo-light.svg"
            alt="NavorBR"
            width={156}
            height={38}
          />
        </a>
        <p>
          Sistemas conectados. Decisões mais simples.
          <br />
          <span>Conexões que abrem possibilidades.</span>
        </p>
        <nav aria-label="Links institucionais">
          <a href="/empresa">Empresa</a>
          <a href="/produtos">Soluções</a>
          <a href="/contato">Contato</a>
          <a href="/entrar">Acessar sistemas</a>
        </nav>
        <nav aria-label="Produtos">
          {products.map((p) => (
            <a key={p.slug} href={`/produtos/${p.slug}`}>
              {p.name.replace(/^Navor(?:BR)?\s+/, "")}
              {p.status === "coming_soon" && <small>Em breve</small>}
            </a>
          ))}
        </nav>
      </div>
      <div className="nv-footer-bottom">
        <span>© {new Date().getFullYear()} NavorBR</span>
        <span>TECNOLOGIA PARA O PRÓXIMO MOVIMENTO.</span>
        <a href="#conteudo">Voltar ao topo ↑</a>
      </div>
    </footer>
  );
}
