import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { signupOfficial } from "@/api/account-security";
import { supabase } from "@/integrations/supabase/client";
import { TERMS_VERSION, PRIVACY_VERSION } from "@/core/legal/terms-and-privacy";
import { products } from "@/data/products";

type SlugStatus = "idle" | "checking" | "available" | "taken" | "reserved" | "invalid";

export const Route = createFileRoute("/cadastro")({
  validateSearch: (search: Record<string, unknown>): { next?: string; product?: string } => ({
    next: typeof search["next"] === "string" && search["next"].startsWith("/") ? search["next"] : undefined,
    product: typeof search["product"] === "string" ? search["product"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Criar Conta | NAVOR" },
      { name: "description", content: "Crie sua conta NAVOR com nome, telefone e e-mail. Acesso rápido e seguro." },
    ],
  }),
  component: CadastroPage,
});

function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function CadastroPage() {
  const navigate = useNavigate();
  const { next, product: productFromUrl } = Route.useSearch();

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedProductSlug, setSelectedProductSlug] = useState(productFromUrl || "");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [slugMessage, setSlugMessage] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const slugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!slug && companyName.trim()) {
      const suggested = companyName
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 63);
      if (suggested.length >= 3) setSlug(suggested);
    }
  }, [companyName]);

  useEffect(() => {
    if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    if (!slug || slug.length < 3 || !selectedProductSlug) {
      setSlugStatus("idle");
      setSlugMessage("");
      return;
    }
    setSlugStatus("checking");
    slugTimerRef.current = setTimeout(async () => {
      try {
        const prod = products.find(p => p.slug === selectedProductSlug);
        if (!prod) { setSlugStatus("invalid"); setSlugMessage("Produto inválido."); return; }
        const { data, error } = await supabase.rpc("reserve_account_slug", {
          p_product_id: "00000000-0000-0000-0000-000000000000",
          p_slug: slug,
        });
        if (error) { setSlugStatus("invalid"); setSlugMessage("Erro ao verificar slug."); return; }
        if (data?.available) {
          setSlugStatus("available");
          setSlugMessage(`${selectedProductSlug}.navorbr.com/${data.normalized_slug}`);
        } else {
          setSlugStatus(data?.reason === "RESERVED_WORD" ? "reserved" : "taken");
          setSlugMessage(data?.reason === "RESERVED_WORD" ? "Endereço reservado pelo sistema." : "Este endereço já está em uso.");
        }
      } catch {
        setSlugStatus("invalid");
        setSlugMessage("Erro ao verificar slug.");
      }
    }, 400);
    return () => { if (slugTimerRef.current) clearTimeout(slugTimerRef.current); };
  }, [slug, selectedProductSlug]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneDisplay(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!name.trim() || name.trim().length < 2) { setErrorMessage("Informe seu nome completo."); return; }
    if (phone.replace(/\D/g, "").length < 10) { setErrorMessage("Telefone celular válido com DDD é obrigatório."); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErrorMessage("E-mail inválido."); return; }
    if (!password || password.length < 6) { setErrorMessage("Senha mínima de 6 caracteres."); return; }
    if (!acceptTerms) { setErrorMessage("Aceite dos Termos e Privacidade é obrigatório."); return; }
    if (!selectedProductSlug) { setErrorMessage("Selecione um produto."); return; }
    if (slugStatus !== "available" && slugStatus !== "idle") { setErrorMessage("Escolha um endereço válido e disponível."); return; }

    setLoading(true);
    try {
      const result = await signupOfficial({
        data: {
          name: name.trim(),
          companyName: companyName.trim() || name.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          password,
          desiredSlug: slug || undefined,
          productSlug: selectedProductSlug,
          consentTerms: acceptTerms,
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
          marketingOptIn,
          source: "web_cadastro_oficial",
        },
      });
      if (result.success) {
        toast.success(result.message || "Conta criada com sucesso!");
        const targetNext = next || (selectedProductSlug ? `/${selectedProductSlug}` : "/dashboard");
        void navigate({ to: "/auth", search: { email: email.trim().toLowerCase(), next: targetNext, product: selectedProductSlug } });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível criar sua conta.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="w-full max-w-[480px]">
        <div className="mb-6 text-center">
          <Link to="/" className="inline-block transition hover:opacity-90">
            <span className="font-display text-2xl font-bold tracking-tight text-foreground">NAVOR<span className="text-brand">.</span></span>
          </Link>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-card-foreground sm:text-2xl">Crie sua conta NAVOR</h1>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card/60 p-6 shadow-sm backdrop-blur-md sm:p-7">
          {errorMessage && <div role="alert" className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{errorMessage}</div>}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="cadastro-name" className="mb-1.5 block text-xs font-medium text-card-foreground">Nome completo</label>
              <input id="cadastro-name" type="text" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Mariana Silva" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground transition placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
            </div>
            <div>
              <label htmlFor="cadastro-company" className="mb-1.5 block text-xs font-medium text-card-foreground">Nome da empresa</label>
              <input id="cadastro-company" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex.: Arena Barbearia" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground transition placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
            </div>
            <div>
              <label htmlFor="cadastro-phone" className="mb-1.5 block text-xs font-medium text-card-foreground">Telefone celular com DDD</label>
              <input id="cadastro-phone" type="tel" required autoComplete="tel" value={phone} onChange={handlePhoneChange} placeholder="(11) 98765-4321" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground transition placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
            </div>
            <div>
              <label htmlFor="cadastro-email" className="mb-1.5 block text-xs font-medium text-card-foreground">E-mail de acesso</label>
              <input id="cadastro-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu.email@empresa.com" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground transition placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
            </div>
            <div>
              <label htmlFor="cadastro-password" className="mb-1.5 block text-xs font-medium text-card-foreground">Senha de acesso</label>
              <input id="cadastro-password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground transition placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
            </div>
            <div>
              <label htmlFor="cadastro-product" className="mb-1.5 block text-xs font-medium text-card-foreground">Produto</label>
              <select id="cadastro-product" value={selectedProductSlug} onChange={(e) => { setSelectedProductSlug(e.target.value); setSlugStatus("idle"); setSlugMessage(""); }} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground transition focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand">
                <option value="">Selecione um produto</option>
                {products.filter(p => p.status === "available").map(p => (<option key={p.id} value={p.slug}>{p.name}</option>))}
              </select>
            </div>
            {selectedProductSlug && (
              <div>
                <label htmlFor="cadastro-slug" className="mb-1.5 block text-xs font-medium text-card-foreground">Endereço desejado</label>
                <input id="cadastro-slug" type="text" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 63))} placeholder="ex: arena-barbearia" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground transition placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
                {slugStatus === "checking" && <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Verificando...</p>}
                {slugStatus === "available" && <p className="mt-1 text-xs text-emerald-600 font-medium">✓ Disponível: {slugMessage}</p>}
                {(slugStatus === "taken" || slugStatus === "reserved") && <p className="mt-1 text-xs text-destructive font-medium">✗ {slugMessage}</p>}
                {slugStatus === "invalid" && slug.length > 0 && <p className="mt-1 text-xs text-destructive">{slugMessage || "Endereço inválido."}</p>}
              </div>
            )}
            <div className="pt-2">
              <div className="flex items-start gap-2.5">
                <input id="cadastro-terms" type="checkbox" required checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 size-4 shrink-0 rounded border-border bg-background text-brand focus:ring-brand focus:ring-offset-0" />
                <label htmlFor="cadastro-terms" className="text-xs leading-relaxed text-muted-foreground select-none">
                  Li e aceito os <Link to="/termos" target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline underline-offset-2 hover:text-brand/80">Termos de Uso</Link> da NAVOR e declaro que tive acesso à <Link to="/privacidade" target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline underline-offset-2 hover:text-brand/80">Política de Privacidade</Link>.
                </label>
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-card/40 p-2.5">
              <div className="flex items-start gap-2.5">
                <input id="cadastro-marketing" type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} className="mt-0.5 size-4 shrink-0 rounded border-border bg-background text-brand focus:ring-brand focus:ring-offset-0" />
                <label htmlFor="cadastro-marketing" className="text-xs leading-relaxed text-muted-foreground select-none">
                  <span className="font-medium text-card-foreground">Opcional: </span>Desejo receber novidades e comunicações comerciais da NAVOR.
                </label>
              </div>
            </div>
            <div className="pt-2">
              <button type="submit" disabled={!acceptTerms || loading || (selectedProductSlug && slugStatus !== "available" && slugStatus !== "idle")} className="flex h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? (<><Loader2 className="mr-2 size-4 animate-spin" /> Criando conta...</>) : "Criar conta"}
              </button>
            </div>
          </form>
          <div className="mt-6 border-t border-border/60 pt-4 text-center">
            <p className="text-xs text-muted-foreground">Já tem uma conta? <Link to="/auth" search={{ next, product: selectedProductSlug }} className="font-medium text-brand underline-offset-4 hover:underline">Entrar</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
