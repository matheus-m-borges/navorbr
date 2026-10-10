import { useRef, useEffect, useCallback, useState } from "react";

/**
 * Hook para tornar a navegação em Kanbans e containers horizontais extremamente
 * fluida, permitindo rolagem com a rodinha do mouse (wheel) e botões laterais de navegação.
 */
export function useHorizontalKanbanScroll() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  const scrollToLeft = useCallback(() => {
    containerRef.current?.scrollBy({ left: -260, behavior: "smooth" });
  }, []);

  const scrollToRight = useCallback(() => {
    containerRef.current?.scrollBy({ left: 260, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Checar scroll inicial
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);

    // Suporte nativo à rodinha do mouse (Wheel to Horizontal Scroll)
    const handleWheel = (e: WheelEvent) => {
      // Se não houver movimento vertical ou já estiver segurando shift, deixa comportamento nativo
      if (e.deltaY === 0 || e.shiftKey) return;

      // Verificar se o elemento sob o mouse possui scroll vertical próprio que não chegou ao fim
      let target = e.target as HTMLElement | null;
      let hasConsumableVerticalScroll = false;

      while (target && target !== el) {
        const style = window.getComputedStyle(target);
        const canScrollVertically =
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          target.scrollHeight > target.clientHeight;

        if (canScrollVertically) {
          const atTop = target.scrollTop <= 0 && e.deltaY < 0;
          const atBottom =
            target.scrollTop + target.clientHeight >= target.scrollHeight - 1 && e.deltaY > 0;

          if (!atTop && !atBottom) {
            hasConsumableVerticalScroll = true;
            break;
          }
        }
        target = target.parentElement;
      }

      if (!hasConsumableVerticalScroll) {
        // Rola horizontalmente no container principal do Kanban
        e.preventDefault();
        el.scrollLeft += e.deltaY * 1.25;
        checkScroll();
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      el.removeEventListener("scroll", checkScroll);
      el.removeEventListener("wheel", handleWheel);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  return {
    containerRef,
    canScrollLeft,
    canScrollRight,
    scrollToLeft,
    scrollToRight,
    checkScroll,
  };
}
