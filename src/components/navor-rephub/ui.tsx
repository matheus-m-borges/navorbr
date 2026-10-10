import type { ReactNode } from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusTone, toneClasses } from "@/lib/crm";
import { Switch } from "@/components/ui/switch";

/**
 * Fundo do sistema inspirado na logomarca: base preta profunda com brilhos
 * dourados discretos e um leve traçado diagonal, para um visual empresarial.
 */
export function AuroraBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-ink" />
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,color-mix(in_oklab,var(--brand)_7%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--brand)_7%,transparent)_1px,transparent_1px)] [background-size:40px_40px]" />
    </div>
  );
}

export function GlassCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("glass rounded-xl", className)}>{children}</div>;
}

export function SectionTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string | undefined;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = statusTone[status] ?? "muted";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {status}
    </span>
  );
}

export function Chip({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: "brand" | "cyan" | "violet" | "amber" | "rose" | "muted";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "brand",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "brand" | "cyan" | "violet" | "amber" | "rose" | "muted";
}) {
  const hintColor: Record<string, string> = {
    brand: "text-brand",
    cyan: "text-cyan",
    violet: "text-violet",
    amber: "text-amber",
    rose: "text-rose",
    muted: "text-muted-foreground",
  };
  return (
    <GlassCard className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight text-card-foreground tabular-nums sm:text-3xl">
        {value}
      </p>
      {hint ? <p className={cn("mt-1 text-xs font-medium", hintColor[tone])}>{hint}</p> : null}
    </GlassCard>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-cyan px-4 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-lg shadow-brand/20 transition hover:brightness-110 disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-card-foreground transition hover:bg-accent disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  className,
  required = false,
  hint,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
        {required ? <span className="ml-0.5 text-brand">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

const controlClass =
  "w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-card-foreground outline-hidden placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/25";

export function TextInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlClass, className)} />;
}

/**
 * Campo de dinheiro: o usuário digita só números e o campo mostra R$ 0,00 formatado.
 * `value` guarda o número puro em texto (ex.: "1234.56") e `onValueChange` devolve no mesmo formato.
 */
export function MoneyInput({
  value,
  onValueChange,
  className,
  placeholder = "R$ 0,00",
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
}) {
  const cents = (() => {
    if (value === "" || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  })();

  const display =
    cents === null
      ? ""
      : `R$ ${(cents / 100).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 15);
        onValueChange(digits ? (Number(digits) / 100).toFixed(2) : "");
      }}
      className={cn(controlClass, "tabular-nums", className)}
    />
  );
}

/** Aliases compatíveis com telas administrativas. */
export const Input = TextInput;

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} className={cn("block text-xs font-medium", className)} />;
}

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "destructive" | "ghost" | "link" | "outline" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}) {
  const variants: Record<string, string> = {
    default: "bg-brand text-primary-foreground hover:brightness-110",
    destructive: "bg-destructive/20 text-destructive hover:bg-destructive/30",
    ghost: "border border-border bg-secondary text-card-foreground hover:bg-accent",
    link: "bg-transparent text-brand underline-offset-4 hover:underline",
    outline: "border border-border bg-transparent text-card-foreground hover:bg-accent",
    secondary: "bg-secondary text-card-foreground hover:bg-accent",
  };
  const sizes: Record<string, string> = {
    default: "px-4 py-2 text-sm",
    sm: "px-3 py-1.5 text-xs",
    lg: "px-5 py-2.5 text-sm",
    icon: "size-9 p-0",
  };
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:opacity-60",
        sizes[size],
        variants[variant],
        className,
      )}
    />
  );
}

export function TextArea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlClass, "min-h-20", className)} />;
}

export function SelectInput({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        controlClass,
        // Listas nativas herdam fundo transparente: fixamos fundo/texto das opções
        // para que fiquem legíveis nos temas claro e escuro.
        "appearance-none bg-popover text-popover-foreground [&>option]:bg-popover [&>option]:text-popover-foreground [&>optgroup]:bg-popover [&>optgroup]:text-popover-foreground",
        className,
      )}
    >
      {children}
    </select>
  );
}

export function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-medium text-card-foreground">{value || "—"}</span>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
      <p className="text-sm font-medium text-card-foreground">{title}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string | undefined;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  // Portal para <body>: evita que backdrop-filter/transform de cartões "glass"
  // ancestrais quebrem o posicionamento fixo do modal.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "panel-shell flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl shadow-2xl",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="font-display text-base font-semibold text-card-foreground">{title}</h2>}
            {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar"
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-sm text-muted-foreground transition hover:bg-accent hover:text-card-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function ShowAllToggle({
  showAll,
  onToggle,
  className,
}: {
  showAll: boolean;
  onToggle: (show: boolean) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-xs font-medium text-muted-foreground select-none">
        Ocultar lista
      </span>
      <Switch 
        checked={showAll}
        onCheckedChange={onToggle}
      />
      <span className="text-xs font-medium text-card-foreground select-none">
        Exibir lista
      </span>
    </div>
  );
}
