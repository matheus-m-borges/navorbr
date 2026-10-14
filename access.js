(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  document.querySelectorAll('.access-card-available').forEach(card => {
    card.addEventListener('pointermove', event => {
      if (motion.matches || !pointer.matches || event.pointerType === 'touch') return;
      const bounds = card.getBoundingClientRect();
      card.style.setProperty('--access-x', `${event.clientX - bounds.left}px`);
      card.style.setProperty('--access-y', `${event.clientY - bounds.top}px`);
    }, { passive: true });
    card.addEventListener('pointerleave', () => {
      card.style.removeProperty('--access-x');
      card.style.removeProperty('--access-y');
    });
  });
})();
