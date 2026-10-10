import type { ReactNode } from "react";
import { toneClasses } from "@/lib/crm";
import { cn } from "@/lib/utils";

/** Badge para status do módulo de representação (pedidos, coleções, comissões). */
export function RepBadge({
  status,
  tones,
  className,
}: {
  status: string;
  tones: Record<string, "brand" | "cyan" | "violet" | "amber" | "rose" | "muted">;
  className?: string;
}) {
  const tone = tones[status] ?? "muted";
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

export function TableShell({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5 align-middle", className)}>{children}</td>;
}

export function Tr({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-border/50 last:border-0",
        onClick ? "cursor-pointer transition hover:bg-accent/50" : "",
        className,
      )}
    >
      {children}
    </tr>
  );
}
