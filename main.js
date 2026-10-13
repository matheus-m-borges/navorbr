(() => {
  'use strict';
  document.documentElement.classList.remove('no-js');
  const controller = new AbortController();
  const { signal } = controller;
  const header = document.querySelector('.site-header');
  const menu = document.querySelector('#mobile-menu');
  const toggle = document.querySelector('.menu-toggle');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 901px)');
  const hero = document.querySelector('.hero');
  const cta = document.querySelector('.final-cta');
  const globeToggle = document.querySelector('.globe-toggle');
  let globe;
  let globeAbort;
  let globeLoading = false;
  let globeFailed = false;
  let heroVisible = false;
  let userPaused = false;
  let idleHandle;
  let globeObserver;
  let previousOverflow = '';
  let pointerFrame = 0;
  let scrollFrame = 0;
  let currentCard;
  let revealObserver;
  let sectionObserver;

  const closeMenu = () => menu.open && menu.close();
  toggle.addEventListener('click', () => {
    previousOverflow = document.body.style.overflow;
    menu.showModal();
    document.body.style.overflow = 'hidden';
    toggle.setAttribute('aria-expanded', 'true');
    menu.querySelector('.menu-close').focus();
  }, { signal });
  menu.querySelector('.menu-close').addEventListener('click', closeMenu, { signal });
  menu.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...menu.querySelectorAll('a[href], button:not([disabled])')];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, { signal });
  menu.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus({ preventScroll: true });
  }, { signal });
  menu.addEventListener('click', event => {
    if (event.target === menu && event.clientX < menu.getBoundingClientRect().left) closeMenu();
    const link = event.target.closest('a');
    if (!link) return;
    closeMenu();
    if (link.hash && link.origin === location.origin) {
      const target = document.querySelector(link.hash);
      // Wait for the dialog's close event before moving focus to the destination.
      requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    }
  }, { signal });
  matchMedia('(min-width: 901px)').addEventListener('change', event => {
    if (event.matches) closeMenu();
  }, { signal });

  const updateScroll = () => {
    scrollFrame = 0;
    const y = window.scrollY;
    const heroBounds = hero.getBoundingClientRect();
    const bounds = cta.getBoundingClientRect();
    header.classList.toggle('scrolled', y > 40);
    if (finePointer.matches && !motion.matches) {
      const progress = Math.max(0, Math.min(1, -heroBounds.top / heroBounds.height));
      hero.style.setProperty('--hero-drift', `${progress * 28}px`);
      hero.style.setProperty('--globe-intensity', String(1 - progress * .4));
      if (bounds.top < innerHeight && bounds.bottom > 0) {
        const progress = Math.max(-1, Math.min(1, (innerHeight / 2 - (bounds.top + bounds.height / 2)) / innerHeight));
        cta.style.setProperty('--cta-y', `${progress * 20}px`);
      }
    }
  };
  addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
  }, { passive: true, signal });
  updateScroll();

  if ('IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove('reveal-pending');
        if (!motion.matches) entry.target.classList.add('revealing');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -35px 0px' });
    document.querySelectorAll('[data-reveal]').forEach(element => {
      // Only hide offscreen content after the observer exists. No JS => visible.
      if (!motion.matches && element.getBoundingClientRect().top >= innerHeight) element.classList.add('reveal-pending');
      revealObserver.observe(element);
    });
    const navLinks = [...document.querySelectorAll('.desktop-nav a')];
    sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(link => {
          const active = entry.target.id === 'inicio' ? link.getAttribute('href') === '/' : link.hash === `#${entry.target.id}`;
          if (active) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -60% 0px', threshold: 0 });
    document.querySelectorAll('[data-section]').forEach(section => sectionObserver.observe(section));
  }

  const resetCard = () => {
    if (!currentCard) return;
    ['--tilt-x', '--tilt-y', '--pointer-x', '--pointer-y'].forEach(property => currentCard.style.removeProperty(property));
    currentCard = undefined;
  };
  const resetEffects = () => {
    cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    resetCard();
    globe?.setPointer(0,0);
    hero.style.removeProperty('--hero-drift');
    hero.style.removeProperty('--globe-intensity');
    cta.style.removeProperty('--cta-y');
  };
  document.addEventListener('pointermove', event => {
    if (motion.matches || !finePointer.matches || event.pointerType === 'touch') return;
    cancelAnimationFrame(pointerFrame);
    pointerFrame = requestAnimationFrame(() => {
      const card = event.target.closest('.interactive-card');
      if (card !== currentCard) resetCard();
      if (card) {
        currentCard = card;
        const rect = card.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        card.style.setProperty('--pointer-x', `${x}px`);
        card.style.setProperty('--pointer-y', `${y}px`);
        card.style.setProperty('--tilt-x', `${Math.max(-3, Math.min(3, (0.5 - y / rect.height) * 6))}deg`);
        card.style.setProperty('--tilt-y', `${Math.max(-3, Math.min(3, (x / rect.width - 0.5) * 6))}deg`);
      }
      const bounds = hero.getBoundingClientRect();
      if (bounds.bottom > 0 && event.clientY <= bounds.bottom) {
        globe?.setPointer((event.clientX / innerWidth - .5) * 2, ((event.clientY - bounds.top) / bounds.height - .5) * 2);
      } else globe?.setPointer(0,0);
      pointerFrame = 0;
    });
  }, { passive: true, signal });
  document.addEventListener('pointerleave', resetEffects, { signal });
  document.addEventListener('pointerout', event => {
    if (currentCard && !currentCard.contains(event.relatedTarget)) resetCard();
  }, { signal });
  hero.addEventListener('pointerleave', () => globe?.setPointer(0,0), { signal });

  const eligible = () => finePointer.matches && !motion.matches && !globeFailed
    && !navigator.connection?.saveData && (navigator.hardwareConcurrency || 4) >= 4
    && (navigator.deviceMemory || 4) >= 4;
  const disposeGlobe = () => {
    globeAbort?.abort();
    globeAbort = undefined;
    globe = undefined;
    globeLoading = false;
    hero.classList.remove('webgl-ready');
    globeToggle.hidden = true;
  };
  const loadGlobe = async () => {
    if (!eligible() || !heroVisible || document.hidden || globe || globeLoading) return;
    globeLoading = true;
    const resourceAbort = new AbortController();
    globeAbort = resourceAbort;
    try {
      const { createGlobe } = await import('/globe.js');
      if (resourceAbort.signal.aborted) return;
      const canvas = document.createElement('canvas');
      canvas.className = 'globe-canvas';
      canvas.setAttribute('aria-hidden','true');
      document.querySelector('.globe-canvas').replaceWith(canvas);
      const renderer = await createGlobe(canvas, { signal: resourceAbort.signal, onFailure: () => {
        globeFailed = true;
        disposeGlobe();
      }});
      if (resourceAbort.signal.aborted || !eligible()) { resourceAbort.abort(); return; }
      globe = renderer;
      globe.setPaused(userPaused);
      globe.setVisible(heroVisible);
      hero.classList.add('webgl-ready');
      globeToggle.hidden = false;
    } catch {
      if (!resourceAbort.signal.aborted) { globeFailed = true; disposeGlobe(); }
    } finally {
      if (globeAbort === resourceAbort) globeLoading = false;
    }
  };
  const updateGlobe = () => {
    resetEffects();
    if (!eligible()) disposeGlobe();
    else loadGlobe();
    if (motion.matches) document.querySelectorAll('.reveal-pending').forEach(el => el.classList.remove('reveal-pending'));
  };
  globeToggle.addEventListener('click', () => {
    userPaused = !userPaused;
    globe?.setPaused(userPaused);
    globeToggle.setAttribute('aria-pressed',String(userPaused));
    globeToggle.textContent = userPaused ? 'Retomar movimento' : 'Pausar movimento';
  }, { signal });
  if ('IntersectionObserver' in window) {
    globeObserver = new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      globe?.setVisible(heroVisible);
      if (heroVisible) {
        if ('requestIdleCallback' in window) idleHandle = requestIdleCallback(loadGlobe,{ timeout:1500 });
        else idleHandle = setTimeout(loadGlobe,400);
      }
    });
    globeObserver.observe(hero);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadGlobe(); }, { signal });
  motion.addEventListener('change', updateGlobe, { signal });
  finePointer.addEventListener('change', updateGlobe, { signal });
  navigator.connection?.addEventListener('change',updateGlobe,{signal});
  addEventListener('pagehide', event => {
    resetEffects();
    cancelAnimationFrame(scrollFrame);
    globe?.setVisible(false);
    if ('cancelIdleCallback' in window) cancelIdleCallback(idleHandle);
    else clearTimeout(idleHandle);
    if (!event.persisted) {
      disposeGlobe();
      controller.abort();
      revealObserver?.disconnect();
      sectionObserver?.disconnect();
      globeObserver?.disconnect();
    }
  }, { signal });
  addEventListener('pageshow', event => { if (event.persisted) globe?.setVisible(heroVisible); }, { signal });
})();
