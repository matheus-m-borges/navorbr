# Publicação da homepage institucional — 13/10/2026

Publicação autorizada pelo proprietário, condicionada aos testes e à identificação do projeto. Os relatórios `ENTREGA.md` e `HERO-REVISAO.md` registram etapas locais anteriores; suas referências a ausência de deploy descrevem aquele momento.

## Destino confirmado

- Repositório: `https://github.com/matheus-m-borges/navorbr`.
- Branch de desenvolvimento: `codex/navor-premium-homepage`; produção: `main`.
- Projeto Vercel existente: `navor-sistemas/navorbr` (`prj_dtR7w9h29zFKzfxS8incVWe4zXVb`).
- Integração GitHub ativa, com produção configurada em `main`.
- Domínios `navorbr.com` e `www.navorbr.com` verificados nesse projeto.
- Nenhuma regra de branch/ruleset exigindo PR foi identificada na auditoria; publicação direta em `main` autorizada pelo proprietário, sem force push.

`vercel.json` explicita `npm run build` e saída `dist/`. Isso limita a publicação ao HTML, CSS, JavaScript e assets públicos. Não foram alterados variáveis de ambiente, domínios ou configurações de outros projetos.

## Verificações

- Sintaxe JavaScript: `node --check main.js` e `node --check globe.js`.
- Lint: ESLint 9.39.1 executado via npx sobre os dois scripts da página e todos os scripts de QA/build. Configuração de regras de correção em `artifacts/release/eslint.config.mjs`, sem dependências adicionadas à aplicação.
- Typecheck TypeScript não aplicável: projeto estático em HTML/CSS/JavaScript, sem TypeScript ou configuração de tipos.
- Testes estruturais: `npm test`.
- Build: `npm run build`; aproximadamente 928 KB.
- Browser QA sobre o conteúdo de `dist/`: seis larguras (360–1920 px), menu desktop/mobile, teclado, âncoras, imagens, movimento reduzido, ausência de JavaScript, links públicos e console.
- Efeitos: rotação por tempo e pixels, inclinação, pausa, descarte de recursos, scroll reveal, hover e fallbacks.
- Revisão de escopo e padrões de segredos antes de adicionar os arquivos explicitamente ao commit. Backups, relatórios de execução, `.env`, chaves e temporários excluídos.

A suíte de navegador aguarda o evento assíncrono de fechamento do diálogo antes de verificar `aria-expanded` e foco. Isso evita uma falha intermitente da verificação.

As evidências de execução ficam em `artifacts/release/`, ignoradas pelo Git. O resultado efetivo da publicação deve ser confirmado na Vercel e no domínio após o push; este documento não afirma que o deployment foi concluído.

## Reversão preparada antes do push

Deployment anterior confirmado como `READY`, origem Git, target `production`, servindo `navorbr.com` com HTTP 200:

- ID: `dpl_AMCzT6CcdQcmb2www9ENPoze7but`.
- URL: `https://navorbr-nhwdd17bx-navor-sistemas.vercel.app`.
- Commit: `145d8df311d42f57cc66b9ec96ad1669aac9bc5b`.

Em caso de falha crítica após publicação, usar a reversão da Vercel no projeto confirmado:

```powershell
vercel rollback dpl_AMCzT6CcdQcmb2www9ENPoze7but --scope navor-sistemas --yes
vercel inspect https://navorbr.com
```

Confirmar o domínio e o funcionamento após a reversão. Não fazer reset destrutivo nem force push. Se necessário, corrigir o código em novo commit antes de retomar a publicação.

## Limites preservados

BarberHub é o único produto disponível. Os links de conhecer e entrar continuam separados no HTML, mas a raiz do domínio externo BarberHub redireciona para `/entrar`; ambos responderam HTTP 200 antes da publicação. A NAVOR Core também respondeu HTTP 200. Nenhum fluxo autenticado ou dado operacional é alterado/testado por estas verificações públicas.

A marca dourada mantém a adaptação vetorial da referência enviada; o arquivo mestre oficial ainda não foi fornecido, conforme `ASSETS.md`. Permanecem pendentes os documentos jurídicos oficiais. Nenhuma destas pendências é resolvida mediante alteração dos produtos operacionais.
