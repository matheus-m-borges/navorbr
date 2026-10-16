// Build-time components: public HTML is complete even without JavaScript.
export const systems = [
  { name: 'NavalhaHub', icon: 'scissors', description: 'Gestão profissional para barbearias.', href: 'https://app.navalhahub.navorbr.com/barber/login' },
  { name: 'LawHub', icon: 'scales', description: 'Organização para a sua prática jurídica.' },
  { name: 'RepHub', icon: 'chart', description: 'CRM para representantes comerciais.' },
  { name: 'EngHub', icon: 'helmet', description: 'Gestão para obras e engenharia.' },
  { name: 'PetHub', icon: 'paw', description: 'Gestão para quem cuida dos pets.' },
  { name: 'LetterHub', icon: 'letter', description: 'Letras caixa e produção 3D.' }
];
const icon = name => `<svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#${name}"/></svg>`;

export function systemSelector(id) {
  const rows = systems.map(system => {
    const content = `${icon(system.icon)}<span><strong>${system.name}</strong><small>${system.href ? 'Disponível' : 'Em breve'}</small></span>${system.href ? icon('arrow') : ''}`;
    return `<li>${system.href ? `<a class="system-option available" href="${system.href}" aria-label="Acessar ${system.name}">${content}</a>` : `<span class="system-option unavailable" aria-disabled="true">${content}</span>`}</li>`;
  }).join('\n');
  return `<div class="system-access" data-system-access>
    <div class="system-access-controls"><a class="button button-outline system-access-link" href="/acessar">Acessar sistema</a><button class="system-access-toggle" type="button" aria-label="Mostrar sistemas" aria-expanded="false" aria-controls="${id}"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></div>
    <div class="system-dropdown" id="${id}" role="region" aria-label="Sistemas NAVOR BR" aria-hidden="true" inert><ul>${rows}</ul></div>
  </div>`;
}

export function renderHome(source) {
  return source.replace('<!-- system-access:desktop -->', systemSelector('desktop-system-list'))
    .replace('<!-- system-access:mobile -->', systemSelector('mobile-system-list'));
}

export function renderAccess(homeSource, template) {
  const home = renderHome(homeSource);
  const header = home.match(/<header class="site-header">[\s\S]*?<\/dialog>/)?.[0];
  const footer = home.match(/<footer class="site-footer"[\s\S]*?<\/footer>/)?.[0];
  if (!header || !footer) throw new Error('Cabeçalho ou rodapé compartilhado ausente');
  const pageLinks = html => html.replaceAll('href="#', 'href="/#').replace(' aria-current="location"', '');
  const cards = systems.map((system, index) => `<article class="access-card${system.href ? ' access-card-available' : ''}" aria-labelledby="access-${system.name}" style="--card-delay:${index * 70}ms">
    <div class="access-card-top"><span class="access-icon">${icon(system.icon)}</span><span class="access-status${system.href ? ' is-available' : ''}">${system.href ? 'Disponível' : 'Em breve'}</span></div>
    <h2 id="access-${system.name}">${system.name}</h2><p>${system.description}</p>
    ${system.href ? `<a class="button button-primary" href="${system.href}">Acessar ${system.name} ${icon('arrow')}</a>` : '<span class="access-coming">Em desenvolvimento</span>'}
  </article>`).join('\n');
  return template.replace('<!-- shared-header -->', pageLinks(header))
    .replace('<!-- access-cards -->', cards).replace('<!-- shared-footer -->', pageLinks(footer));
}
