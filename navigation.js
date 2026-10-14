(() => {
  'use strict';
  document.documentElement.classList.remove('no-js');
  const controller = new AbortController();
  const { signal } = controller;
  const menu = document.querySelector('#mobile-menu');
  const toggle = document.querySelector('.menu-toggle');
  const hover = matchMedia('(hover: hover) and (pointer: fine)');
  const disclosures = [];
  let previousOverflow = '';
  const closeSystems = () => disclosures.forEach(item => item.setOpen(false));

  document.querySelectorAll('[data-system-access]').forEach(root => {
    const primary = root.querySelector('.system-access-link');
    const button = root.querySelector('.system-access-toggle');
    const panel = root.querySelector('.system-dropdown');
    const setOpen = open => {
      root.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
      panel.setAttribute('aria-hidden', String(!open));
      panel.inert = !open;
    };
    const open = () => { closeSystems(); setOpen(true); };
    disclosures.push({ root, button, panel, setOpen });
    primary.addEventListener('pointerenter', event => {
      if (hover.matches && event.pointerType === 'mouse') open();
    }, { signal });
    root.addEventListener('pointerleave', event => {
      if (hover.matches && event.pointerType === 'mouse') setOpen(false);
    }, { signal });
    button.addEventListener('click', () => {
      if (root.classList.contains('is-open')) setOpen(false);
      else open();
    }, { signal });
    root.addEventListener('keydown', event => {
      if (event.key !== 'ArrowDown') return;
      event.preventDefault(); open(); panel.querySelector('a')?.focus();
    }, { signal });
    root.addEventListener('focusout', event => {
      if (!root.contains(event.relatedTarget)) setOpen(false);
    }, { signal });
  });
  document.addEventListener('pointerdown', event => {
    disclosures.forEach(item => { if (!item.root.contains(event.target)) item.setOpen(false); });
  }, { signal });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const opened = disclosures.filter(item => item.root.classList.contains('is-open'));
    if (!opened.length) return;
    // Dismiss the inner disclosure first, leaving the mobile dialog open.
    event.preventDefault(); event.stopPropagation();
    opened.forEach(item => {
      const restoreFocus = item.root.contains(document.activeElement);
      item.setOpen(false);
      if (restoreFocus) item.button.focus();
    });
  }, { capture: true, signal });

  const closeMenu = () => menu.open && menu.close();
  toggle.addEventListener('click', () => {
    closeSystems();
    previousOverflow = document.body.style.overflow;
    menu.showModal();
    document.body.style.overflow = 'hidden';
    toggle.setAttribute('aria-expanded', 'true');
    menu.querySelector('.menu-close').focus();
  }, { signal });
  menu.querySelector('.menu-close').addEventListener('click', closeMenu, { signal });
  menu.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...menu.querySelectorAll('a[href], button:not([disabled])')]
      .filter(element => element.getClientRects().length && !element.closest('[inert]'));
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }, { signal });
  menu.addEventListener('close', () => {
    closeSystems();
    document.body.style.overflow = previousOverflow;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus({ preventScroll: true });
  }, { signal });
  menu.addEventListener('click', event => {
    if (event.target === menu && event.clientX < menu.getBoundingClientRect().left) closeMenu();
    const link = event.target.closest('a');
    if (!link) return;
    closeMenu();
    if (link.hash && link.origin === location.origin && link.pathname === location.pathname) {
      const target = document.querySelector(link.hash);
      requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    }
  }, { signal });
  matchMedia('(min-width: 901px)').addEventListener('change', event => {
    closeSystems();
    if (event.matches) closeMenu();
  }, { signal });
  if (!document.querySelector('.hero')) {
    const header = document.querySelector('.site-header');
    const updateHeader = () => header.classList.toggle('scrolled', scrollY > 40);
    addEventListener('scroll', updateHeader, { passive: true, signal });
    updateHeader();
  }
  addEventListener('pagehide', event => {
    closeSystems();
    if (!event.persisted) controller.abort();
  }, { signal });
})();
