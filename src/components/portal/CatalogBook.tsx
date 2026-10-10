import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
  destroy: () => void;
};
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
    promise: Promise<void>;
    cancel: () => void;
  };
};

let pdfLibPromise: Promise<{ getDocument: (src: unknown) => { promise: Promise<PdfDoc> } }> | null =
  null;

async function loadPdfLib() {
  if (!pdfLibPromise) {
    pdfLibPromise = (async () => {
      const lib = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      lib.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;
      return lib as unknown as { getDocument: (src: unknown) => { promise: Promise<PdfDoc> } };
    })();
  }
  return pdfLibPromise;
}

/** Leitor de catálogo em formato livro: o cliente passa página por página. */
export function CatalogBook({
  url,
  title,
  subtitle,
  onClose,
}: {
  url: string;
  title: string;
  subtitle?: string | undefined;
  onClose: () => void;
}) {
  const docRef = useRef<PdfDoc | null>(null);
  const leftRef = useRef<HTMLCanvasElement | null>(null);
  const rightRef = useRef<HTMLCanvasElement | null>(null);
  const tasksRef = useRef<{ cancel: () => void }[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [spread, setSpread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [turning, setTurning] = useState<"" | "next" | "prev">("");

  useEffect(() => {
    const update = () => setSpread(window.innerWidth >= 1024);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const lib = await loadPdfLib();
        const doc = await lib.getDocument({ url }).promise;
        if (!alive) {
          doc.destroy();
          return;
        }
        docRef.current = doc;
        setTotal(doc.numPages);
        setPage(1);
        setLoading(false);
      } catch {
        if (alive) {
          setError("Não foi possível abrir este catálogo.");
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
      tasksRef.current.forEach((t) => t.cancel());
      tasksRef.current = [];
      docRef.current?.destroy();
      docRef.current = null;
    };
  }, [url]);

  const draw = useCallback(async (canvas: HTMLCanvasElement | null, pageNumber: number) => {
    const doc = docRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!doc || pageNumber < 1 || pageNumber > doc.numPages) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }
    const pdfPage = await doc.getPage(pageNumber);
    const base = pdfPage.getViewport({ scale: 1 });
    const maxH = Math.min(window.innerHeight - 190, 980);
    const maxW = (window.innerWidth - 90) / (window.innerWidth >= 1024 ? 2 : 1);
    const fit = Math.min(maxH / base.height, maxW / base.width);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = pdfPage.getViewport({ scale: fit * dpr });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
    const task = pdfPage.render({ canvasContext: ctx, viewport });
    tasksRef.current.push(task);
    try {
      await task.promise;
    } catch {
      /* renderização substituída */
    }
  }, []);

  useEffect(() => {
    if (loading || error) return;
    tasksRef.current.forEach((t) => t.cancel());
    tasksRef.current = [];
    void draw(leftRef.current, page);
    if (spread) void draw(rightRef.current, page + 1);
  }, [page, spread, loading, error, draw]);

  const step = spread ? 2 : 1;
  const canPrev = page > 1;
  const canNext = page + step <= total;

  const go = useCallback(
    (dir: "next" | "prev") => {
      setTurning(dir);
      window.setTimeout(() => {
        setPage((p) => {
          const target = dir === "next" ? p + step : p - step;
          return Math.min(Math.max(target, 1), Math.max(total, 1));
        });
        setTurning("");
      }, 220);
    },
    [step, total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && canNext) go("next");
      if (e.key === "ArrowLeft" && canPrev) go("prev");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canNext, canPrev, go, onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const touchX = useRef<number | null>(null);

  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col bg-ink/95 backdrop-blur-md">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold text-card-foreground">{title}</p>
          {subtitle ? <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar catálogo"
          className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-card-foreground hover:bg-accent"
        >
          Fechar ✕
        </button>
      </header>

      <div
        className="flex flex-1 items-center justify-center gap-3 overflow-hidden px-2 py-4"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX ?? null;
          touchX.current = null;
          if (start === null || end === null) return;
          if (start - end > 60 && canNext) go("next");
          if (end - start > 60 && canPrev) go("prev");
        }}
      >
        <button
          type="button"
          onClick={() => go("prev")}
          disabled={!canPrev}
          aria-label="Página anterior"
          className="hidden size-10 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-card-foreground disabled:opacity-30 sm:flex"
        >
          ‹
        </button>

        <div className="flex max-h-full items-center justify-center gap-1 [perspective:2000px]">
          {loading ? (
            <p className="text-sm text-muted-foreground">Abrindo catálogo...</p>
          ) : error ? (
            <p className="text-sm text-rose">{error}</p>
          ) : (
            <>
              <canvas
                ref={leftRef}
                className="max-h-full rounded-l-lg bg-white shadow-2xl transition-transform duration-200 [transform-style:preserve-3d]"
                style={{
                  transform:
                    turning === "prev"
                      ? "rotateY(28deg)"
                      : turning === "next"
                        ? "rotateY(-8deg)"
                        : "none",
                }}
              />
              {spread ? (
                <canvas
                  ref={rightRef}
                  className="max-h-full rounded-r-lg bg-white shadow-2xl transition-transform duration-200"
                  style={{
                    transform:
                      turning === "next"
                        ? "rotateY(-28deg)"
                        : turning === "prev"
                          ? "rotateY(8deg)"
                          : "none",
                  }}
                />
              ) : null}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => go("next")}
          disabled={!canNext}
          aria-label="Próxima página"
          className="hidden size-10 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-card-foreground disabled:opacity-30 sm:flex"
        >
          ›
        </button>
      </div>

      <footer className="flex items-center justify-center gap-3 border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={() => go("prev")}
          disabled={!canPrev}
          className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs text-card-foreground disabled:opacity-30"
        >
          Anterior
        </button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {total ? `Página ${page}${spread && page + 1 <= total ? `-${page + 1}` : ""} de ${total}` : "—"}
        </span>
        <button
          type="button"
          onClick={() => go("next")}
          disabled={!canNext}
          className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs text-card-foreground disabled:opacity-30"
        >
          Próxima
        </button>
      </footer>
    </div>,
    document.body,
  );
}
