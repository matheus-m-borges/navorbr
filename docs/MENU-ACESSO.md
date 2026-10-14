# Menu de acesso aos sistemas

Alteração posterior à publicação da homepage de 13/10/2026. A entrega inicial foi local, sem commit, push ou deploy, conforme pedido. Após a revisão, o proprietário autorizou explicitamente o commit, push e deploy do seletor e de `/acessar`.

## Publicação autorizada

Repositório `matheus-m-borges/navorbr`, branch de produção `main`, projeto existente `navor-sistemas/navorbr` (`prj_dtR7w9h29zFKzfxS8incVWe4zXVb`). Integração GitHub automática confirmada. Aguardar o deployment do push, sem disparar outro deploy manual.

Antes do push, o domínio foi confirmado no deployment funcional `dpl_3x1WbM1MSzaayGQyC2uhpSm6Ro8k`, URL `https://navorbr-8o29zq850-navor-sistemas.vercel.app`, commit `0f477f4dabcc0b037b4d3115caa0a225a08a0901`. Este é o ponto de reversão desta alteração. Se houver falha crítica, usar `vercel rollback dpl_3x1WbM1MSzaayGQyC2uhpSm6Ro8k --scope navor-sistemas --yes`, confirmar o domínio e não fazer reset destrutivo ou force push.

As verificações anteriores à publicação incluem build, lint ESLint, sintaxe JavaScript, testes estruturais e de navegador. TypeScript não aplicável. Evidências finais de deployment e validação do domínio ficam em `artifacts/access-menu/production/`, ignoradas pelo Git. A conclusão da publicação depende da confirmação efetiva da Vercel e dos testes no domínio.

## Auditoria e reaproveitamento

O cabeçalho e o menu mobile estavam em `index.html`; o diálogo mobile era controlado por `main.js`. O projeto é estático, sem roteador de aplicação. A configuração existente da Vercel já usa `cleanUrls: true`, permitindo servir `/acessar` a partir de `dist/acessar.html` sem regra adicional ou alteração de infraestrutura.

O catálogo de sistemas, seus ícones e o seletor são gerados por `scripts/access-components.mjs`. O build reutiliza o cabeçalho, o diálogo mobile e o rodapé da homepage na nova página. Os templates são transformados em HTML completo antes da publicação; não há requisição de fragmentos nem dependência de JavaScript para exibir os seis cards.

A lógica de navegação e foco foi extraída para `navigation.js`, compartilhada pelas duas páginas. `main.js` mantém os efeitos exclusivos da homepage. `/acessar` não carrega `main.js`, `globe.js`, canvas ou textura do globo.

## Interações

- Acessar sistema é um link para `/acessar`, com seta independente para abrir/fechar o seletor.
- Hover no link principal abre o dropdown; a área que conecta botão e painel faz parte do próprio dropdown, sem intervalo que feche a lista.
- Saída do ponteiro, Escape, clique fora e saída do foco fecham o seletor.
- Enter/Espaço na seta e ArrowDown abrem; Tab alcança o único produto operacional. Escape restaura o foco à seta quando apropriado.
- No menu mobile, a seta funciona por toque. Escape fecha primeiro o seletor, preservando o diálogo; o próximo Escape fecha o diálogo.
- Painéis fechados usam `inert`, `aria-hidden` e `aria-expanded=false`. Produtos futuros não têm links nem controles operacionais.
- Abertura 180 ms, fechamento 140 ms, deslocamento 8 px, ease-out. Movimento reduzido desativa as animações.
- `/acessar`: título 550 ms/20 px, subtítulo 450 ms/15 px, seis cards com intervalos de 70 ms. Só o card BarberHub tem hover de até 5 px, borda dourada e spotlight de 220 ms.

## Rota BarberHub

Verificação real, pública e sem sessão:

1. `https://barberhub.navorbr.com/barber` respondeu HTTP **307**.
2. Redirecionou para `https://barberhub.navorbr.com/entrar`, HTTP **200**.
3. A tela “BarberHub — NAVOR Sistemas” exibiu os campos de autenticação.

O destino dos novos links continua sendo `/barber`; não foi substituído por `/entrar`. Não foram enviados dados de login nem alteradas rotas do produto. Os links anteriores para a raiz do BarberHub e `/entrar` foram preservados no restante da homepage. Evidência: `artifacts/access-menu/barber-route.json` e `barber-route.png`.

## Arquivos

Modificados:

- `index.html`: referências à navegação compartilhada e pontos de composição do seletor; retirada da identificação Core no cabeçalho/mobile.
- `main.js`: extração da navegação, sem alteração dos efeitos.
- `scripts/build.mjs`: geração estática da homepage e `/acessar`.
- `scripts/serve.mjs`: mesma composição em desenvolvimento e atendimento direto de `/acessar` no build.
- `scripts/site.test.mjs`: verificação do HTML composto e reconhecimento da rota limpa.
- `README.md`: execução, composição e status local desta entrega.

Criados:

- `scripts/access-components.mjs`: catálogo único, seletor e reaproveitamento do cabeçalho/rodapé.
- `acessar.html`: template da página pública de seleção.
- `navigation.js`: menu mobile e dropdown acessíveis, compartilhados.
- `access.css`: estilos isolados do seletor e da nova página.
- `access.js`: spotlight somente no card disponível.
- `scripts/access-check.mjs`: verificações do novo fluxo e da preservação da homepage.
- `docs/MENU-ACESSO.md`: este relatório.

`styles.css`, `globe.js`, assets e configuração Vercel permanecem intactos. O conteúdo de `<main>` da homepage foi comparado ao commit anterior e é idêntico. Não houve alterações em autenticação, banco, Core, BarberHub, assinaturas, Asaas, webhooks, migrations ou RLS.

## Testes e evidências

- Build aprovado: aproximadamente 953 KB em `dist/`.
- Cinco testes estruturais aprovados; sintaxe dos scripts aprovada.
- Treze grupos de verificações do seletor/página, incluindo clique principal, hover e trajeto, único destino operacional, saída do mouse, teclado, Escape, clique fora, toque mobile, acesso direto/refresh, hover exclusivo, movimento reduzido, conteúdo sem JavaScript e preservação da homepage.
- Nova página sem overflow em 360, 390, 768, 1024 e 1440 px.
- Suíte existente da homepage aprovada nas seis larguras 360–1920 px, menu, foco, âncoras, movimento reduzido, ausência de JS e links externos.
- Treze verificações dos efeitos existentes aprovadas. A rotação avançou 0,366842 rad em 6,1265 s, mantendo o período previsto de 105 segundos.
- Nenhum erro de console nos fluxos monitorados.

Capturas em `artifacts/access-menu/`:

- `dropdown-desktop.png`: seletor aberto sobre a homepage preservada.
- `dropdown-mobile.png`: seletor aberto por toque no menu mobile.
- `acessar-1440.png`: página completa em desktop.
- `acessar-390.png`: página completa em mobile; também disponíveis 360, 768 e 1024 px.
- `access-results.json`: resultados do novo fluxo.
- `homepage-regression/browser-results.json` e `homepage-regression/effects-results.json`: regressão da homepage.

Executar `npm run dev` para revisar `/` e `/acessar` em `http://127.0.0.1:4173`. Para verificar o build: `npm run build` e `node scripts/serve.mjs --dist`. Com Playwright configurado conforme README, usar `node scripts/access-check.mjs`.

## Pendências

- A autorização posterior para commit/push/deploy foi recebida. O registro efetivo da publicação e das verificações do domínio acompanha as evidências de produção.
- Mantida a marca dourada aprovada na homepage, que é uma adaptação da referência raster. O arquivo mestre da marca e logomarcas individuais oficiais dos produtos não estão disponíveis no repositório; foram reutilizados os ícones de segmento existentes, sem apresentá-los como logomarcas oficiais.
- Testes em Edge Chromium com tamanhos de tela simulados; aparelhos físicos, Safari e área autenticada do BarberHub não foram testados.
