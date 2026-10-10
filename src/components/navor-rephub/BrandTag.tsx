import { cn } from "@/lib/utils";

/** Logomarca + nome da marca, usado em listas, pedidos e relatórios. */
export function BrandTag({
  brand,
  logoUrl,
  hint,
  size = "sm",
  className,
}: {
  brand: string | null | undefined;
  logoUrl?: string | null | undefined;
  hint?: string | null | undefined;
  size?: "sm" | "lg";
  className?: string;
}) {
  const box = size === "lg" ? "size-10" : "size-7";
  return (
    <span className={cn("inline-flex items-center gap-2 align-middle", className)}>
      <span
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-ink-2/60",
          box,
        )}
      >
        {logoUrl ? (
          <img src={logoUrl} alt={`Logomarca ${brand ?? ""}`} className="size-full object-contain" />
        ) : (
          <span className="font-display text-[10px] font-bold text-muted-foreground">
            {(brand ?? "?").slice(0, 2).toUpperCase()}
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-card-foreground">{brand ?? "—"}</span>
        {hint ? <span className="block truncate text-[11px] text-muted-foreground">{hint}</span> : null}
      </span>
    </span>
  );
}
