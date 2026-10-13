# Recursos visuais e tipográficos

## Revisão do globo — 13/10/2026

`assets/globe-reference.webp` e `assets/globe-reference-mobile.webp` são versões otimizadas da imagem fornecida pelo usuário nesta revisão (`codex-clipboard-ef53fe1b-98a7-4eb4-b1af-ee8d250d550b.png`). São o fallback estático aprovado, sem rotação da fotografia. A imagem anterior foi preservada, mas não é mais o fundo do hero.

`assets/earth-night.webp` é uma textura equiretangular local, 2048 × 1024, derivada do mapa Black Marble 2016 da NASA. Fonte: [Earth at Night / Black Marble: Flat Maps](https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/). Arquivo original: https://assets.science.nasa.gov/dynamicimage/assets/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg.

Crédito: NASA Earth Observatory, Joshua Stevens, dados Suomi NPP VIIRS de Miguel Román, NASA GSFC. A [política de imagens de Earth Science](https://science.nasa.gov/earth/faq/) permite reutilização, inclusive comercial, salvo indicação específica de copyright. Nenhum logotipo, pessoa identificável ou endosso da NASA é utilizado. As conexões douradas são ilustrações geradas matematicamente; não representam clientes ou infraestrutura da NAVOR BR.

Esta revisão não gerou novas imagens com IA e não substituiu as fotografias aprovadas dos produtos ou da chamada final.

## Identidade

Referência fornecida pelo usuário: `Mockup de Branding e Plataforma SaaS NavorBR.png`, enviada em 13/10/2026. A referência orienta a composição, paleta e marca desta implementação.

`assets/navorbr-gold.svg` e `assets/navorbr-gold-icon.svg` são adaptações vetoriais desenhadas a partir da marca dourada da referência raster. Não são arquivos vetoriais originais fornecidos pela marca. O desenho do N foi reconstruído; o lettering usa uma aproximação tipográfica. Se houver um arquivo mestre SVG/AI, ele deve substituir esta adaptação para reprodução exata. Os três SVGs e os favicons anteriores foram preservados, sem recoloração ou sobrescrita.

`assets/icons.svg` contém símbolos descritivos de segmentos e interface. Não se apresentam como logomarcas oficiais dos produtos, pois não foram encontrados arquivos oficiais específicos no repositório.

## Fonte

Manrope, pesos 400–800, arquivo WOFF2 latino local. Google Fonts: https://fonts.google.com/specimen/Manrope. Licença SIL Open Font License 1.1 preservada em `assets/Manrope-OFL.txt`. Nenhuma fonte é requisitada a terceiros em tempo de execução.

## Fotografias

Fotografias baixadas da Unsplash e distribuídas localmente em WebP. Licença consultada em 13/10/2026: https://unsplash.com/license. Ela permite download e uso comercial e não comercial, observadas suas restrições. As fotos são imagens ilustrativas dos segmentos; não representam instalações ou clientes da NAVOR BR.

| Arquivo | Fonte |
|---|---|
| `barberhub.webp` | https://images.unsplash.com/photo-1503951914875-452162b0f3f1 |
| `lawhub.webp` | https://images.unsplash.com/photo-1589829545856-d10d557cf95f |
| `rephub.webp` | https://images.unsplash.com/photo-1441986300917-64674bd600d8 |
| `enghub.webp` | https://images.unsplash.com/photo-1504307651254-35680f356dfd |
| `pethub.webp` | https://images.unsplash.com/photo-1543466835-00a7907e9de1 |
| `office.webp`, `office-mobile.webp` | https://images.unsplash.com/photo-1497366811353-6870744d04b2 |

As cinco fotografias de segmentos usam versões de 480 × 640. A imagem do escritório possui variantes desktop e mobile. Todas foram recomprimidas para WebP; nenhum domínio externo é necessário para sua exibição.

## Imagens geradas

Ferramenta: ImageGen integrada, modo nativo; não foi usada API externa ou chave de API. São ilustrações, não registros de operações reais. Os arquivos usados pela página estão no repositório.

### Globo

Saídas finais: `assets/globe.webp` (1672 × 941) e `assets/globe-mobile.webp` (900 × 507).

Prompt utilizado:

> Use case: stylized-concept. Asset type: cinematic background image for a premium Brazilian SaaS company website hero. Create a photorealistic 3D Earth globe in dark obsidian graphite, illuminated by tiny warm gold city lights and thin elegant gold network connections spanning continents. Globe is large, positioned toward RIGHT, seen from space showing Atlantic, Europe and Africa, top of sphere at upper right, lower hemisphere fades into pure near-black #080A0D. Left 40% is almost completely empty black negative space for HTML text overlay. Sophisticated extremely restrained amber light, realistic rich surface texture, gentle atmospheric rim with cool dark blue light, no purple. Wide 16:9 composition. No text, no logos, no UI, no cards, no watermarks, no neon thick lines. This should be an actual image asset, not a website screenshot. Render the luminous upper hemisphere clearly while retaining a dark overall exposure.

### LetterHub

Saída final: `assets/letterhub.webp` (640 × 640).

Prompt utilizado:

> Use case: product-mockup. Create a premium photographic website card asset: closeup of a dimensional freestanding metal marquee capital letter A on a dark workbench, warm small incandescent bulbs along the letter, brushed brass edges, 3D lettering and signage fabrication workshop in soft focus behind. Editorial cinematic photography, rich black and amber palette, tasteful and realistic, shallow depth of field. Square composition, the letter is centered, with space at bottom for separate HTML overlay. Only the physical letter A, no other text, no logos, no UI, no watermark.
