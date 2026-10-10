import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, ContactCTA, Orbital } from "@/components/navor/PublicSite";
export const Route = createFileRoute("/empresa")({
  head: () => ({
    meta: [
      { title: "Empresa | NavorBR" },
      {
        name: "description",
        content:
          "Conheça a visão da NavorBR: tecnologia especializada para conectar operações e simplificar o trabalho.",
      },
    ],
  }),
  component: Empresa,
});
function Empresa() {
  return (
    <SiteLayout>
      <section className="nv-page-hero nv-section">
        <span className="nv-eyebrow">SOMOS NAVORBR</span>
        <h1>
          Tecnologia com propósito.
          <br />
          <em>Trabalho com clareza.</em>
        </h1>
        <p>
          Desenvolvemos produtos digitais para aproximar as pessoas das informações de que precisam
          no dia a dia.
        </p>
      </section>
      <section className="nv-section nv-coming">
        <Orbital />
        <div>
          <span className="nv-eyebrow">O QUE NOS MOVE</span>
          <h2>
            Cada operação
            <br />
            tem o seu universo.
          </h2>
          <p>
            Um escritório jurídico e uma representação comercial têm desafios diferentes. Por isso,
            nosso ecossistema reúne sistemas especializados, com recursos pensados para cada rotina.
          </p>
          <p>
            LawHub e RepHub traduzem essa visão em ferramentas para organizar informações,
            acompanhar atividades e apoiar decisões.
          </p>
        </div>
      </section>
      <section className="nv-section" data-reveal>
        <span className="nv-eyebrow">COMO PENSAMOS PRODUTOS</span>
        <h2>
          Entender. Conectar.
          <br />
          <em>Simplificar.</em>
        </h2>
        <div className="nv-feature-list">
          {[
            ["A operação primeiro", "Partimos das atividades que compõem a rotina de cada setor."],
            [
              "Informação com contexto",
              "Conectamos os elementos da operação para facilitar o acompanhamento.",
            ],
            [
              "Experiência em evolução",
              "Tratamos a simplicidade e a clareza como parte do desenvolvimento do produto.",
            ],
          ].map(([title, text], i) => (
            <article key={title}>
              <span>0{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <a className="nv-text-link" href="/produtos">
          Explore nosso ecossistema ↗
        </a>
      </section>
      <ContactCTA />
    </SiteLayout>
  );
}
