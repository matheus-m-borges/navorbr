import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determina se o modo escuro está ativo atualmente
  const isDark =
    mounted &&
    (theme === "dark" ||
      (theme === "system" &&
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches));

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Alternar modo claro e escuro"
      title={isDark ? "Modo Escuro ativado (Clique para Claro)" : "Modo Claro ativado (Clique para Escuro)"}
      onClick={toggleTheme}
      className={cn(
        "relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
        isDark
          ? "bg-slate-800 ring-1 ring-slate-700 shadow-inner"
          : "bg-slate-200 ring-1 ring-slate-300 shadow-inner",
        className
      )}
    >
      {/* Ícones de fundo nos dois lados da chave */}
      <span className="absolute left-1.5 flex size-5 items-center justify-center text-amber-500 transition-opacity duration-200">
        <Sun className={cn("size-3.5 transition-transform duration-300", isDark ? "opacity-40 scale-75" : "opacity-100 scale-100")} />
      </span>
      <span className="absolute right-1.5 flex size-5 items-center justify-center text-blue-400 transition-opacity duration-200">
        <Moon className={cn("size-3.5 transition-transform duration-300", isDark ? "opacity-100 scale-100" : "opacity-40 scale-75")} />
      </span>

      {/* Botão deslizante (chave liga/desliga) */}
      <span
        className={cn(
          "pointer-events-none z-10 flex size-6 transform items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform duration-300 ease-in-out dark:bg-slate-900 dark:ring-white/10",
          isDark ? "translate-x-6" : "translate-x-0"
        )}
      >
        {isDark ? (
          <Moon className="size-3 text-blue-400" />
        ) : (
          <Sun className="size-3 text-amber-500" />
        )}
      </span>
    </button>
  );
}
