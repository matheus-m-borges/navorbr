# Entrega — NAVOR BR

> Histórico da primeira implementação. A revisão posterior remove os produtos do hero e substitui o globo estático por WebGL progressivo. Consulte `HERO-REVISAO.md` para o estado atual; as métricas abaixo pertencem à versão anterior.

Data de referência: 13/10/2026, America/Sao_Paulo. Implementação local, sem commit, push ou deploy.

## Estado e preservação

- Repositório: `D:\Documentos\GitHub\navorbr`, remoto `matheus-m-borges/navorbr`.
- Branch inicial: `main`, limpa antes das alterações.
- Commit base preservado: `145d8df` — `fix(links): connect BarberHub product card to barberhub.navorbr.com`.
- Branch da implementação: `codex/navor-premium-homepage`.
- Estrutura existente: página HTML estática, estilos e GSAP por CDN embutidos no documento, deploy previamente vinculado à Vercel.
- Configurações `vercel.json`, `.vercel/`, `robots.txt`, logos e favicons anteriores permanecem inalteradas. Não havia regras de redirecionamento em `vercel.json`.
- Nenhum módulo operacional, autenticação, banco, migration, assinatura, RLS, API privada ou webhook foi alterado. Nenhum arquivo de outro repositório foi modificado.

## Implementação

Homepage composta conforme a referência fornecida: preto, grafite, branco e dourado; marca dourada baseada na imagem; globo tecnológico; seis produtos no hero; grid fotográfico; empresa; chamada final e rodapé. Layout responsivo e sem métricas ou depoimentos inventados.

Somente BarberHub possui links de produto. LawHub, RepHub, EngHub, PetHub e LetterHub são artigos sem âncoras operacionais, identificados como “Em breve”. Links institucionais e de login do BarberHub permanecem separados. O acesso Core está identificado como administração.

Cabeçalho com alteração após 40 px de scroll, âncoras reais e destaque ativo. Menu mobile em `dialog` nativo, bloqueio de scroll, contenção e retorno de foco, fechamento por Escape, botão, seleção ou mudança para desktop. Fallback de navegação se JavaScript estiver indisponível.

Entrada do hero e cards, reveal via IntersectionObserver, hover com elevação máxima de 5 px e inclinação limitada a 3 graus, iluminação recortada no card e parallax discreto. Eventos de ponteiro centralizados, atualizações em requestAnimationFrame, cleanup no encerramento da página e respeito a prefers-reduced-motion. O globo é imagem otimizada: sem Three.js, WebGL, partículas ou animações permanentes.

## Arquivos

Modificado: `index.html`.

Criados:

- `styles.css`, `main.js`.
- `package.json`, `.gitignore`, `README.md`.
- `scripts/build.mjs`, `scripts/serve.mjs`, `scripts/site.test.mjs`, `scripts/browser-check.mjs`.
- `assets/navorbr-gold.svg`, `assets/navorbr-gold-icon.svg`, `assets/icons.svg`.
- `assets/manrope-latin.woff2`, `assets/Manrope-OFL.txt`.
- `assets/globe.webp`, `assets/globe-mobile.webp`.
- `assets/barberhub.webp`, `assets/lawhub.webp`, `assets/rephub.webp`, `assets/enghub.webp`, `assets/pethub.webp`, `assets/letterhub.webp`.
- `assets/office.webp`, `assets/office-mobile.webp`.
- `docs/ASSETS.md`, `docs/ENTREGA.md`.

`dist/` contém o build e `artifacts/` contém relatórios e capturas locais, ambos ignorados pelo Git. Nenhum dado privado entra no build.

## Reutilização e dependências

Reutilizados: repositório e hospedagem estática existente, rota `/`, conteúdo institucional básico, famílias de produtos, e-mail `contato@navorbr.com`, destinos oficiais e arquivos originais preservados. Não havia componentes de framework reaproveitáveis; os componentes visuais permanecem HTML nativo.

Não foram adicionadas dependências de produção nem bibliotecas de animação. As referências a GSAP/ScrollTrigger e Google Fonts externos foram removidas da página. Manrope é servida localmente. Playwright e Sharp do ambiente foram usados somente na verificação e otimização; Lighthouse 13.5.0 foi executado via npx para auditoria, sem adicioná-lo ao projeto.

## Validação

| Verificação | Resultado |
|---|---|
| `npm test` | 5 testes aprovados |
| `npm run build` | Build estático concluído em `dist/`, aproximadamente 494 KB |
| Sintaxe de `main.js` | Aprovada pelo Node |
| Larguras | 360, 390, 768, 1024, 1440 e 1920 px aprovadas |
| Overflow horizontal | Ausente em todas as larguras testadas |
| Seis produtos na primeira tela desktop | Confirmado em 1024×900, 1440×900 e 1920×1080 |
| Menu | Abertura, Tab, foco contido, Escape, botão, âncoras, desbloqueio de scroll e resize aprovados |
| Navegação | Âncoras, retorno ao início e cabeçalho ativo aprovados |
| Movimento reduzido | Conteúdo e navegação funcionais; animações e parallax desativados |
| JavaScript desativado | Conteúdo, seis produtos e navegação mobile visíveis e funcionais |
| Console e recursos da página local | Nenhum erro encontrado |
| Links externos | Verificados via HTTP e navegação real do navegador, sem autenticação |

Navegador dos testes: Microsoft Edge Chromium headless no Windows. O teste de imagem confirma que todos os recursos carregam após percorrer a página. O código continua funcional sem IntersectionObserver: o conteúdo é visível por padrão.

### Auditoria mobile local

Lighthouse 13.5.0, perfil mobile simulado, servidor local:

| Métrica | Resultado |
|---|---|
| Performance | 96/100 |
| Acessibilidade | 100/100 |
| Boas práticas | 100/100 |
| SEO | 100/100 |
| LCP | 2,0 s |
| CLS | 0 |
| Total Blocking Time | 170 ms |

Esses resultados são de laboratório, não dados de produção. INP real não foi medido; TBT não substitui INP. O Lighthouse não substitui avaliação manual com tecnologias assistivas nem certifica acessibilidade integral.

### Links

| Origem | Destino configurado | Resultado observado |
|---|---|---|
| Logo / Início | `/` | Retorno à homepage local |
| Empresa | `#empresa` | Navegação e foco aprovados |
| Sistemas | `#sistemas` | Navegação e foco aprovados |
| Contato | `#contato` | Navegação e foco aprovados |
| Conhecer BarberHub | `https://barberhub.navorbr.com` | HTTP 200 após redirecionamento externo para `/entrar` |
| Entrar no BarberHub | `https://barberhub.navorbr.com/entrar` | HTTP 200, tela de login |
| Acessar sistema / Core | `https://sis.navorbr.com` | HTTP 200, login público identificado como acesso exclusivo do proprietário |
| Outros produtos | Sem destino | “Em breve”, sem links operacionais |
| E-mail | `mailto:contato@navorbr.com` | Reutilizado do projeto; envio não realizado |

## Evidências locais

- `artifacts/desktop-final.png`: página completa desktop.
- `artifacts/mobile-final.png`: página completa mobile.
- `artifacts/desktop-hero-final.png`, `artifacts/mobile-hero-final.png`: primeira tela.
- `artifacts/menu-mobile.png`: painel aberto e foco visível.
- `artifacts/page-360.png` a `artifacts/page-1920.png`: layouts da suíte de navegador.
- `artifacts/browser-results.json`: resultados estruturados dos testes.
- `artifacts/lighthouse-mobile-final.report.html` e `.json`: auditoria final.

## Pendências e riscos residuais

1. **Destino institucional do BarberHub:** a raiz redireciona externamente ao login. Os links da homepage seguem exatamente os destinos exigidos; a separação de experiências depende do responsável pelo BarberHub. Nenhuma tentativa de alterar esse sistema foi feita.
2. **Marca:** SVG dourado é uma adaptação vetorial da imagem fornecida, com aproximação do lettering. Um arquivo mestre oficial SVG/AI permitirá reprodução exata. Os recursos anteriores foram preservados. Conferir a adaptação na aprovação visual.
3. **Termos de Uso e Política de Privacidade:** não foram encontrados destinos reais confirmados. Foram omitidos para evitar links fictícios; incluir quando os documentos oficiais estiverem disponíveis.
4. **Aprovação visual e publicação:** a implementação foi comparada à referência, mas a aprovação final do proprietário permanece necessária. Nenhuma publicação em produção foi executada.
5. **Cobertura:** não houve testes em aparelhos físicos ou Safari. Performance de produção e INP real dependem de hospedagem, rede e uso reais.

## Executar e reverter

Na raiz, execute `npm run dev` e abra `http://127.0.0.1:4173`. Não é necessário executar `npm install`. Para testar: `npm test`; para gerar artefatos públicos: `npm run build`.

O commit `145d8df` continua como referência intacta do estado anterior. Para consultar a versão anterior sem alterar o trabalho, use `git show 145d8df:index.html`. Uma reversão pode restaurar somente a homepage e seus recursos após salvar o trabalho atual; não foi executado reset, clean ou descarte de alterações. A branch `main` não recebeu commits desta implementação.
