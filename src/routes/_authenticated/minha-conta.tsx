import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/navor-rephub/AppShell";
import { MinhaContaSection } from "@/components/navor/MinhaContaSection";

export const Route = createFileRoute("/_authenticated/minha-conta")({
  head: () => ({
    meta: [
      { title: "Minha Conta & Segurança | NAVOR" },
      {
        name: "description",
        content: "Gerencie suas credenciais, sessões, dados cadastrais e preferências de privacidade na NAVOR.",
      },
    ],
  }),
  component: MinhaContaPage,
});

function MinhaContaPage() {
  return (
    <AppShell
      title="Minha Conta"
      subtitle="Dados cadastrais, segurança, sessões e consentimentos LGPD"
    >
      <MinhaContaSection />
    </AppShell>
  );
}
