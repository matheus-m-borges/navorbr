import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Mail } from "lucide-react";
import { SiteLayout } from "@/components/navor/PublicSite";
export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato | NavorBR" },
      {
        name: "description",
        content:
          "Converse com a NavorBR sobre os sistemas e encontre o próximo passo para sua operação.",
      },
    ],
  }),
  component: Contato,
});
function Contato() {
  return (
    <SiteLayout>
      <section className="nv-section nv-page-hero">
        <span className="nv-eyebrow">CONEXÕES COMEÇAM COM UMA CONVERSA</span>
        <h1>
          Qual é o seu
          <br />
          <em>próximo movimento?</em>
        </h1>
        <p>
          Quer conhecer uma solução ou precisa de ajuda com seu acesso? Escreva para nossa equipe.
        </p>
      </section>
      <section className="nv-section nv-contact-options">
        <a className="nv-contact-channel" href="mailto:suporte@navor.com.br">
          <Mail size={30} />
          <span>
            <small>FALE COM A EQUIPE</small>
            <strong>suporte@navor.com.br</strong>
            <p>Envie sua mensagem pelo aplicativo de e-mail que você utiliza.</p>
          </span>
          <ArrowUpRight size={26} />
        </a>
        <div className="nv-contact-note">
          <h2>Já utiliza um sistema?</h2>
          <p>Entre no seu ambiente de trabalho pelo acesso de LawHub ou RepHub.</p>
          <a className="nv-text-link" href="/entrar">
            Escolher meu sistema <ArrowUpRight size={18} />
          </a>
        </div>
      </section>
    </SiteLayout>
  );
}
