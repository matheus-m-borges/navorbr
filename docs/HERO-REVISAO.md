# Revisão do hero e efeitos — 13/10/2026

Implementação local na branch `codex/navor-premium-homepage`. Sem commit, push ou deploy. NAVOR Core, BarberHub, autenticação, banco de dados, infraestrutura e integrações operacionais não foram alterados.

## Auditoria e preservação

Reutilizado o site estático existente: `index.html`, `styles.css` e `main.js`. O build anterior passou antes da intervenção. Não havia biblioteca de animação instalada; os efeitos existentes eram CSS, IntersectionObserver e ponteiro com requestAnimationFrame. O globo era uma imagem WebP com parallax, incapaz de rotação esférica. Os cards apareciam no hero e em Nossos Sistemas.

O trabalho anterior, ainda não commitado, foi preservado em `artifacts/hero-revision/before/` (HTML, CSS, JS e capturas). A branch e o commit base `145d8df` permanecem os mesmos. As fotografias dos produtos, empresa, chamada final, marca e links aprovados foram mantidos.

## Antes / depois

| Elemento | Antes | Depois |
|---|---|---|
| Hero | Seis cards e três benefícios repetidos | Apenas texto, botões, globo e indicador de scroll |
| CTA principal | Conheça nossos sistemas | Conheça nossas soluções → `#sistemas` |
| Globo | Imagem estática com deslocamento | Esfera WebGL, rotação vertical de 105 s e inclinação suave limitada a 3° |
| Fallback | Imagem anterior | Imagem fornecida nesta revisão, otimizada em desktop/mobile |
| Entrada do título | Bloco único | Reveal de três linhas em sequência |
| Produtos | Duplicados no hero | Seis cards somente em Nossos Sistemas |
| Entrada dos cards | Fade pouco perceptível | 25 px, 600 ms, intervalos de 80 ms, uma vez |
| Hover | Elevação discreta | Até 6 px, escala 1,015, tilt até 3°, spotlight localizado |
| Scroll | Revelações e CTA | Acrescenta deslocamento leve do hero, redução de luz do globo, título/descrição da empresa e rodapé |
| Movimento contínuo | Ausente | Rotação pausável pelo usuário, fora da viewport e em aba oculta |

## Implementação do globo

`globe.js` é um módulo próprio, carregado progressivamente via `import()`. Usa WebGL nativo, sem Three.js, React Three Fiber ou dependências adicionais.

A superfície é uma esfera calculada por interseção raio/esfera no fragment shader. A textura equiretangular é amostrada por longitude/latitude após a transformação tridimensional. Assim, os continentes cruzam a superfície e desaparecem atrás da esfera; a fotografia plana não é girada. As conexões são arcos tridimensionais interpolados entre coordenadas geográficas, com ocultação dos trechos atrás do planeta. Os pontos representam conexões ilustrativas, não clientes.

Textura: Black Marble 2016, NASA Earth Observatory. Fonte e condições de reutilização em `ASSETS.md`. A imagem enviada nesta revisão é o fallback; não é usada como mapa equiretangular, pois já contém perspectiva e iluminação fotográfica.

Características:

- Uma volta a cada 105 segundos de animação ativa, velocidade linear.
- Inclinação por mouse independente da rotação, limitada a 3°, suavização e retorno ao neutro.
- Até aproximadamente 30 quadros por segundo; DPR máximo 1,25 e canvas limitado a 1000 × 1000.
- Sem biblioteca 3D, pós-processamento pesado ou partículas infinitas.
- Carregamento somente em desktop elegível e com o hero visível.
- Pausa automática por IntersectionObserver e Page Visibility.
- Botão “Pausar movimento” / “Retomar movimento”.
- Fallback em mobile/tablet, movimento reduzido, economia de dados, memória/CPU limitadas, falha WebGL, textura indisponível ou lentidão gráfica sustentada.
- Cleanup de buffers, shaders, programas, texturas, contexto WebGL, observers e listeners vinculados a AbortSignal. Reativação usa um canvas novo.
- Conteúdo principal permanece em HTML; não depende do canvas para aparecer ou funcionar.

## Arquivos desta revisão

Modificados: `index.html`, `styles.css`, `main.js`, `scripts/build.mjs`, `scripts/serve.mjs`, `scripts/site.test.mjs`, `scripts/browser-check.mjs`, `README.md`, `docs/ASSETS.md`, `docs/ENTREGA.md`.

Criados: `globe.js`, `scripts/effects-check.mjs`, `assets/earth-night.webp`, `assets/globe-reference.webp`, `assets/globe-reference-mobile.webp`, `docs/HERO-REVISAO.md`.

Reutilizados: cabeçalho, marca, menu modal, botões, âncoras, seis cards fotográficos, empresa, CTA, rodapé, fonte local, servidor e build estático. Nenhuma dependência de produção adicionada. Playwright e Lighthouse são ferramentas de verificação externas ao bundle. FFmpeg foi instalado no cache do Playwright apenas para gravar o vídeo de evidência.

## Resultados

| Verificação | Resultado |
|---|---|
| Build de produção estático | Aprovado; `dist/`, aproximadamente 928 KB incluindo assets anteriores preservados |
| Sintaxe JS | `main.js` e `globe.js` aprovados |
| TypeScript | Não aplicável; projeto HTML/CSS/JS |
| Testes estruturais | 5 aprovados |
| Responsividade | 360, 390, 768, 1024, 1440 e 1920 px; sem overflow horizontal |
| Menu / navegação / foco | Tab contido, Escape, botão, âncoras, resize e retorno de foco aprovados |
| Movimento reduzido / sem JS | Conteúdo e navegação funcionais |
| Efeitos | 13 verificações específicas aprovadas |
| Console local | Nenhum erro nos fluxos normais |
| Imagens | Carregadas em todas as larguras após percorrer a página |
| Links externos | HTTP 200, navegação somente de leitura |

### Verificação real do movimento

Inspeção visual no navegador e capturas em instantes diferentes confirmam a mudança da superfície. Em uma amostra real de 6,173 segundos, o ângulo avançou 0,369846 rad (esperado 0,369385 rad), compatível com uma volta a cada 105 segundos. Os pixels das duas capturas são diferentes. Não se trata apenas de verificar a existência de uma declaração CSS.

O teste confirmou resposta ao ponteiro e retorno ao neutro, spotlight, matriz de transformação 3D dos cards, redução de movimento, pausa manual, frames parados fora da viewport e destruição/recriação dos recursos. O evento de aba oculta foi simulado explicitamente no teste para validar o tratamento de Page Visibility; não é apresentado como medição de uma aba real em segundo plano.

Falhas controladas também foram testadas: WebGL indisponível e textura bloqueada preservam o fallback. Mobile, movimento reduzido, pouca memória e economia de dados não requisitam o módulo 3D.

### Lighthouse mobile

Lighthouse 13.5.0, Microsoft Edge Chromium headless, perfil mobile simulado, servidor local:

| Métrica | Resultado |
|---|---|
| Performance | 94/100 |
| Acessibilidade | 100/100 |
| Boas práticas | 100/100 |
| SEO | 100/100 |
| LCP | 2,3 s |
| CLS | 0 |
| TBT | 200 ms |

INP real não foi medido. TBT não substitui INP. Resultados de laboratório não garantem valores em produção. A renderização 3D foi verificada separadamente no desktop; o teste mobile usa o fallback previsto.

## Evidências

Todos os caminhos abaixo ficam em `artifacts/hero-revision/`, ignorado pelo Git:

- `efeitos-desktop.webm`: vídeo real do navegador com entrada, rotação, mouse, scroll e cards.
- `hero-1440.png`, `page-1440.png`: desktop.
- `hero-390.png`, `page-390.png`: mobile.
- `hero-360.png`, `hero-768.png`, `hero-1024.png`, `hero-1920.png`: outras larguras.
- `rotation-before.png`, `rotation-after.png`: mesma região do globo em dois instantes.
- `cards-hover.png`: hover tridimensional e cabeçalho após scroll.
- `menu-mobile.png`: navegação mobile.
- `browser-results.json`, `effects-results.json`: resultados estruturados.
- `lighthouse-mobile.report.html`, `lighthouse-mobile.report.json`: auditoria.
- `before/desktop-final.png`, `before/mobile-final.png`: versão anterior para comparação.

## Pendências e limites

- Sem deploy; publicação depende da autorização do proprietário.
- O endereço institucional do BarberHub continua redirecionando externamente a `/entrar`. O código preserva os dois links exigidos e não altera o sistema externo.
- Permanecem as pendências anteriores de documentos jurídicos oficiais e arquivo mestre da marca.
- A versão WebGL reproduz o estilo e os elementos da referência com renderização real; a iluminação não é uma reprodução pixel a pixel da fotografia. Em ambientes não elegíveis, a própria imagem enviada é exibida.
- Testes no Edge Chromium local; Safari e aparelhos físicos não foram testados. Dispositivos sem recursos usam o fallback.
- Não foi executada análise de heap prolongada. A liberação explícita e a reativação gráfica foram testadas; não se declara ausência absoluta de vazamentos em todos os navegadores.

## Executar

`npm run dev` → http://127.0.0.1:4173. `npm test` para a suíte estrutural; `npm run build` para gerar `dist/`. Com Playwright configurado conforme README, executar `node scripts/browser-check.mjs` e `node scripts/effects-check.mjs`.
