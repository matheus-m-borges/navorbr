import { Lock, Sparkles, MessageSquare, PhoneCall, ShieldCheck, ArrowRight, Zap, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function AtendimentoUpgradeBlocker() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-b from-muted/30 via-background to-background">
      <div className="w-full max-w-2xl bg-card border border-border/80 rounded-3xl p-8 sm:p-10 shadow-2xl text-center space-y-6 relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Ícone de Cadeado Premium */}
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary mx-auto flex items-center justify-center shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            Módulo Premium LawHub
          </div>
          <h2 className="text-2xl font-extrabold text-foreground tracking-tight">
            Módulo CallCenter Oficial
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Centralize as conversas do escritório em um único número oficial de WhatsApp com roteamento inteligente
            por setores, triagem automatizada com Bot/IA e integração direta ao Funil de Leads.
          </p>
        </div>

        {/* Recursos inclusos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
          {[
            "1 Número Oficial para todo o escritório",
            "Recepção por Bot Estruturado (0 tokens) ou IA Gemini Flash",
            "Setores (Trabalhista, Cível, Financeiro, etc.)",
            "Transferência transparente e notas internas",
            "Criação automática ou qualificada de Leads no Funil",
            "Handoff com resumo executivo prévio para o advogado",
          ].map((feat, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/50 text-xs text-foreground/90">
              <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5" />
              </div>
              <span className="font-medium">{feat}</span>
            </div>
          ))}
        </div>

        {/* Ação */}
        <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/lawhub/configuracoes">
            <Button variant="outline" size="sm" className="text-xs">
              Ver Detalhes do Plano
            </Button>
          </Link>
          <a
            href="https://wa.me/5586994821190?text=Ol%C3%A1!%20Gostaria%20de%20ativar%20o%20m%C3%B3dulo%20CALL%20CENTER%20no%20meu%20LawHub."
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-md">
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Solicitar Upgrade do Plano (NAVOR)
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
