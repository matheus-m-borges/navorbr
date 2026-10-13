# NAVOR BR — homepage institucional

Site estático, público e independente dos sistemas operacionais. HTML, CSS e JavaScript nativos, sem dependências de produção e sem etapa obrigatória de instalação.

A revisão do hero usa WebGL nativo com uma esfera terrestre, rotação de 105 segundos e imagem estática nos dispositivos que não devem carregar 3D. O relatório atual está em `docs/HERO-REVISAO.md`.

## Executar localmente

Requer Node.js 22 ou superior. Na raiz do repositório:

```powershell
npm run dev
```

Abra http://127.0.0.1:4173. O servidor aceita apenas conexões locais e arquivos públicos. Para encerrar, use Ctrl+C. Para outra porta: `$env:PORT=4174; npm run dev`.

## Verificação e build

```powershell
npm test
npm run build
node scripts/serve.mjs --dist
```

O build copia apenas a página e os recursos públicos para `dist/`. Não faz deploy nem executa integrações. A configuração da Vercel publica exclusivamente `dist/`. `dist/`, `artifacts/` e `node_modules/` são ignorados pelo Git.

## Testes de navegador opcionais

`scripts/browser-check.mjs` utiliza Playwright disponível no ambiente de QA. A aplicação não depende dele. Com Playwright acessível:

```powershell
$env:PLAYWRIGHT_MODULE='C:\caminho\para\node_modules\playwright'
$env:BROWSER_CHANNEL='msedge'
node scripts/browser-check.mjs
node scripts/effects-check.mjs
```

Mantenha a prévia local em execução. Os testes verificam seis larguras, menu modal, teclado, Escape, foco, âncoras, cabeçalho, movimento reduzido, ausência de JavaScript, console e navegação pública externa. Evidências são salvas em `artifacts/`. Não são enviados formulários ou credenciais.

## Organização

- `index.html`: conteúdo acessível, metadados, links e estrutura da página.
- `styles.css`: identidade, layouts responsivos e animações.
- `main.js`: menu, foco, scroll reveal, estado de navegação e efeitos de ponteiro.
- `globe.js`: renderização esférica WebGL, textura noturna, conexões, rotação, pausa e liberação de recursos.
- `assets/`: marca dourada, símbolos de segmentos, imagens WebP, fonte local e sua licença.
- `scripts/`: servidor local, build estático e verificações.
- `docs/ENTREGA.md`: decisões, resultados, pendências e reversão.
- `docs/HERO-REVISAO.md`: revisão mais recente, evidências de movimento e comparação antes/depois.
- `docs/ASSETS.md`: fontes dos recursos, licenças e prompts de geração.

## Destinos

O endereço institucional do BarberHub permanece `https://barberhub.navorbr.com`; o login permanece `https://barberhub.navorbr.com/entrar`. O redirecionamento da raiz para `/entrar` observado no sistema externo está documentado no relatório. Os demais produtos não possuem links operacionais.

A NAVOR Core aparece explicitamente como administração. Contato reutilizado do site anterior: `contato@navorbr.com`. Páginas jurídicas e redes sociais não foram inventadas.

O projeto existente `navor-sistemas/navorbr` faz deploy automático da branch `main`. A publicação desta revisão foi autorizada pelo proprietário, condicionada às verificações descritas em `docs/PUBLICACAO.md`.
