import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function RepHubAccessLayout({
  children,
  eyebrow,
  title,
  description,
  wide = false,
  showBack = true,
  backTo = "/entrar",
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  wide?: boolean;
  showBack?: boolean;
  backTo?: string;
}) {
  return (
    <main className="access-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <img
        src="/navorbr-icon.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-48 -bottom-24 w-[42rem] max-w-none opacity-[0.055] sm:-right-36 lg:right-[-7rem] lg:w-[50rem]"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-brand" />

      <div className={cn("relative z-10 w-full", wide ? "max-w-4xl" : "max-w-md")}>
        <header className="mb-7 text-center">
          <div className="mx-auto mb-5 flex w-fit items-center rounded-md bg-access-logo px-5 py-3 shadow-sm">
            <img src="/navorbr-logo-dark.svg" alt="NavorBR" className="h-8 w-auto sm:h-9" />
          </div>
          <p className="text-xs font-bold text-brand uppercase">{eyebrow}</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
        </header>

        {children}

        <footer className="mt-6 flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
          {showBack ? (
            <Link to={backTo} className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
              <ArrowLeft className="size-3.5" /> Escolher outra área de acesso
            </Link>
          ) : null}
          <p>NavorBR · Sistemas conectados. Decisões mais simples.</p>
        </footer>
      </div>
    </main>
  );
}
