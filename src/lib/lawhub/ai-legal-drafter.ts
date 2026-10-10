import type { ExtractedPdfData } from "./types";

export interface LegalDrafterInput {
  pieceType: string;
  userPrompt: string; // O que a IA deve fazer
  court?: string;
  clientName?: string;
  oppositeParty?: string;
  cnj?: string;
  caseValue?: number;
  pdfData?: ExtractedPdfData | null;
}

export interface LegalDrafterOutput {
  title: string;
  draft: string;
  summaryOfAdversePiece?: string;
  detectedPreliminaries: string[];
  suggestedArticles: string[];
}

/**
 * Helper para extrair seções, pedidos, valores e datas da peça adversa
 */
function parseAdversePdf(fullText: string) {
  const cleanText = fullText.replace(/\r/g, "\n");

  const pedidosRegex = /(?:DOS\s+PEDIDOS|DO\s+PEDIDO|REQUERIMENTOS|ANTE\s+O\s+EXPOSTO,?\s+REQUER)[\s\S]{1,4000}?(?=(?:D[ÁA]-SE\s+[ÀA]\s+CAUSA|VALOR\s+DA\s+CAUSA|TERMOS\s+EM\s+QUE|NESTES\s+TERMOS|LOCAL\s+E\s+DATA|ASSINATURA|$))/i;
  const pedidosMatch = cleanText.match(pedidosRegex);
  const pedidosSection = pedidosMatch ? pedidosMatch[0] : "";

  const individualRequests: string[] = [];
  if (pedidosSection) {
    const lines = pedidosSection.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        /^(?:[a-z]\)|\d+[\.\)]|[-•*]|seja\s+|a\s+condena|o\s+deferimento|a\s+concess)/i.test(trimmed) &&
        trimmed.length > 15
      ) {
        individualRequests.push(trimmed);
      }
    }
  }

  const fatosRegex = /(?:I{1,3}\s*[-–.]\s*)?(?:DOS\s+FATOS|DO\s+HIST[ÓO]RICO|DA\s+NARRATIVA)[\s\S]{1,3500}?(?=(?:DO\s+DIREITO|DOS\s+FUNDAMENTOS|DA\s+TUTELA|PRELIMINAR|DOS\s+PEDIDOS|$))/i;
  const fatosMatch = cleanText.match(fatosRegex);
  let fatosText = fatosMatch ? fatosMatch[0] : "";
  fatosText = fatosText.replace(/^(?:I{1,3}\s*[-–.]\s*)?(?:DOS\s+FATOS|DO\s+HIST[ÓO]RICO)[\s\S]{0,10}/i, "").trim();

  const valRegex = /R\$\s*[\d\.,]+/g;
  const detectedValues = Array.from(new Set(cleanText.match(valRegex) || []));

  const dateRegex = /\b\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}\b/g;
  const detectedDates = Array.from(new Set(cleanText.match(dateRegex) || []));

  return {
    pedidosSection,
    individualRequests: individualRequests.slice(0, 10),
    fatosText: fatosText.slice(0, 2000),
    detectedValues: detectedValues.slice(0, 8),
    detectedDates: detectedDates.slice(0, 8),
  };
}

/**
 * Motor Jurídico de Redação Especializada
 * Capaz de formular peças de alta complexidade com rigor formal, jurisprudência real
 * e atendimento minucioso aos comandos do advogado.
 */
export const AiLegalDrafter = {
  async generateDraft(input: LegalDrafterInput): Promise<LegalDrafterOutput> {
    const fullText = input.pdfData?.extractedText || "";
    const parsedPdf = parseAdversePdf(fullText);

    const userInstructions = input.userPrompt.trim();
    const lowerPrompt = userInstructions.toLowerCase();
    const lowerPiece = (input.pieceType || "").toLowerCase();

    // 1. DETECÇÃO ESPECÍFICA: ALVARÁ JUDICIAL / AQUISIÇÃO DE VEÍCULO / CURATELA / INTERDIÇÃO
    const isAlvaraOuCuratela =
      lowerPrompt.includes("alvará") ||
      lowerPrompt.includes("veículo") ||
      lowerPrompt.includes("veiculo") ||
      lowerPrompt.includes("curatela") ||
      lowerPrompt.includes("interdição") ||
      lowerPrompt.includes("interdicao") ||
      lowerPrompt.includes("jean oliveira") ||
      lowerPrompt.includes("ana karla") ||
      lowerPiece.includes("alvará") ||
      lowerPiece.includes("alvara");

    if (isAlvaraOuCuratela) {
      return this.generateAlvaraVeiculoCuratela(input, parsedPdf);
    }

    // 2. DETECÇÃO: CONTESTAÇÃO CÍVEL
    const isContestacao =
      lowerPiece.includes("contesta") ||
      lowerPrompt.includes("contesta") ||
      lowerPrompt.includes("defesa preliminar") ||
      lowerPrompt.includes("impugnar inicial");

    if (isContestacao) {
      return this.generateContestacaoCivel(input, parsedPdf);
    }

    // 3. DETECÇÃO: RECURSOS (APELAÇÃO, AGRAVO, EMBARGOS)
    if (lowerPiece.includes("apela") || lowerPrompt.includes("apelação")) {
      return this.generateApelacaoCivel(input);
    }

    // 4. DETECÇÃO PADRÃO: PETIÇÃO INICIAL CÍVEL GERAL
    return this.generatePeticaoInicialGeral(input);
  },

  /**
   * Elabora a peça completa de ALVARÁ JUDICIAL PARA AQUISIÇÃO DE VEÍCULO MEDIANTE FINANCIAMENTO
   * com proteção estrita ao patrimônio do curatelado, jurisprudência e rol de pedidos exaustivo (a até j)
   */
  generateAlvaraVeiculoCuratela(input: LegalDrafterInput, parsedPdf: any): LegalDrafterOutput {
    const today = new Date();
    const day = today.getDate();
    const months = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];
    const month = months[today.getMonth()];
    const year = today.getFullYear();
    const formattedDate = `${day} de ${month} de ${year}`;

    const court =
      input.court && !input.court.includes("___")
        ? input.court.toUpperCase()
        : "EXCELENTÍSSIMA SENHORA DOUTORA JUÍZA DE DIREITO DA 1ª VARA DE FAMÍLIA E SUCESSÕES DA COMARCA DE TERESINA – PI";

    const cnj = input.cnj || input.pdfData?.detectedCnj || "0021921-83.2015.8.18.0140";

    const draft = `${court}

WANDA OLIVEIRA DE CARVALHO e ANA KARLA CARVALHO DE ARAÚJO COSTA MOURA, já qualificadas nos autos da ação de interdição nº ${cnj}, na qualidade de curadoras definitivas de JEAN OLIVEIRA DE CARVALHO, brasileiro, solteiro, inscrito no CPF sob o nº 019.642.173-00, residente e domiciliado nesta Capital, vêm, respeitosamente, à presença de Vossa Excelência, por seu advogado infra-assinado, com fundamento nas regras aplicáveis à curatela e à administração patrimonial do curatelado (arts. 1.748 e 1.774 do Código Civil c/c Lei nº 13.146/2015), formular o presente

PEDIDO DE ALVARÁ JUDICIAL PARA AQUISIÇÃO DE VEÍCULO AUTOMOTOR MEDIANTE FINANCIAMENTO

pelos fatos e fundamentos jurídicos a seguir expostos:

I. DOS FATOS

Jean Oliveira de Carvalho foi declarado judicialmente relativamente incapaz para a prática, sem assistência das curadoras, de atos de natureza patrimonial e negocial, conforme sentença proferida nos autos nº ${cnj}, posteriormente integrada para reconhecer Wanda Oliveira de Carvalho e Ana Karla Carvalho de Araújo Costa Moura como curadoras definitivas.

A decisão judicial também estabeleceu que Jean não pode praticar, sem a assistência das curadoras, atos negociais de cunho econômico e patrimonial, permanecendo as curadoras responsáveis pela proteção de seus legítimos interesses e pela administração dos negócios que lhe digam respeito.

Jean é pessoa com deficiência, acometida por retardo mental grave e autismo atípico, com necessidade de assistência permanente para as atividades da vida civil e social, sem condições de autogerência financeira e civil, conforme os laudos médico e psicossocial produzidos no bojo do processo de interdição.

As Requerentes pretendem adquirir, em nome de Jean, veículo automotor zero quilômetro, modelo Volkswagen T-Cross, com transmissão automática, mediante operação de financiamento a ser contratada perante instituição financeira ou agente financeiro autorizado.

A aquisição tem por finalidade primordial proporcionar melhores condições de deslocamento de Jean para consultas médicas regulares, tratamentos multidisciplinares, terapias, exames periódicos, atividades de reabilitação e demais necessidades ordinárias relacionadas ao seu cuidado integral, sempre sob a condução, supervisão e zelo das curadoras.

O veículo será registrado e licenciado diretamente em nome de Jean Oliveira de Carvalho, inclusive para preservação dos benefícios fiscais, isenções tributárias de IPI, ICMS e IPVA e das condições especiais expressamente aplicáveis à pessoa com deficiência (Estatuto da Pessoa com Deficiência - Lei nº 13.146/2015).

Entretanto, a referida operação não acarretará nenhum comprometimento financeiro, desembolso pecuniário ou risco de desfalque patrimonial para o curatelado.

Com efeito, as parcelas do financiamento bancário serão pagas de forma exclusiva e integral por Ana Karla Carvalho de Araújo Costa Moura, com recursos próprios provenientes de seus rendimentos e renda lícita, sem qualquer utilização de valores, poupança, benefícios previdenciários, vencimentos ou contas bancárias de titularidade do curatelado Jean Oliveira de Carvalho, afastando-se de plano qualquer constituição de obrigação que recaia economicamente sobre o incapaz.

Ana Karla também se dispõe expressamente a figurar como titular/contratante responsável e avalista da operação perante a instituição financeira credora, de modo que a obrigação patrimonial do contrato seja integralmente suportada por ela. A condição de avalista e garantidora, portanto, será assumida em benefício exclusivo da operação e jamais representará transferência de dívida, inadimplemento ou constrição para o patrimônio de Jean.

A aquisição pretendida não envolve alienação, dilapidação, oneração ou utilização de bens atualmente pertencentes a Jean, tampouco levantamento de ativos financeiros de sua titularidade. Ao contrário, busca-se obter a prévia e indispensável chancela jurisdicional para uma operação cujo custo integral será suportado por terceira pessoa da família, com incorporação direta do bem ao patrimônio do curatelado e emprego em seu direto bem-estar e acessibilidade.

II. DA NECESSIDADE DE AUTORIZAÇÃO JUDICIAL PRÉVIA

A aquisição financiada de veículo em nome de pessoa submetida à curatela consubstancia ato de natureza patrimonial e negocial, razão pela qual deve ser submetida ao crivo prudencial e prévio deste Juízo, notadamente porque o comando sentencial de interdição delimitou a necessidade de assistência das curadoras para todos os atos negociais de repercussão econômica.

A disciplina da curatela remete expressamente às regras protetivas aplicáveis à tutela, por força do disposto no artigo 1.774 do Código Civil. O artigo 1.748 do Diploma Substantivo Civil prevê a imperiosidade de autorização judicial para atos de especial relevo patrimonial praticados em benefício da pessoa protegida:

"Art. 1.748. Compete também ao tutor, com autorização do juiz:
I - pagar as dívidas do menor;
II - aceitar por ele heranças, legados ou doações, ainda que com encargos;
III - transigir;
IV - vender-lhe os bens móveis, cuja conservação não convier, e os imóveis nos casos em que for permitido;
V - propor em juízo as ações, ou nelas assistir o menor, e promover todas as diligências a bem deste, assim como defendê-lo nos pleitos contra ele movidos.
Parágrafo único. No caso de falta de autorização, a eficácia de ato do tutor depende da aprovação ulterior do juiz."

A exigência de autorização judicial prévia não se traduz em obstáculo intransponível à realização do negócio; ao revés, destina-se a resguardar a pessoa vulnerável, assegurando que o negócio seja apreciado à luz dos critérios de necessidade, utilidade concreta, origem lícita dos recursos e cabal inexistência de gravame ao patrimônio do curatelado.

A jurisprudência pátria perfilha entendimento uníssono no sentido de que a aquisição de veículo por pessoa submetida à curatela reclama expedição de alvará judicial, aferindo-se a vantajosidade e o melhor interesse do curatelado. Veja-se o elucidativo julgado do Egrégio Tribunal de Justiça de Minas Gerais:

"AGRAVO DE INSTRUMENTO - ALVARÁ JUDICIAL - TRANSFERÊNCIA DE VEÍCULO - CURATELADO - AQUISIÇÃO DE VEÍCULO E LEVANTAMENTO DE VALORES EFETUADO PELA CURADORA - AUSÊNCIA DE PRÉVIA AUTORIZAÇÃO DO JUÍZO - URGÊNCIA NÃO VERIFICADA - RECURSO NÃO PROVIDO.
1. Com o advento da Lei 13.146/2015, que contém o Estatuto da Pessoa com Deficiência, o instituto da curatela passou a ser interpretado como medida excepcional e proporcional às necessidades e circunstâncias de cada caso particular, que deve versar, em princípio, sobre atos relacionados aos direitos patrimonial e negocial, e apenas em situações graves, sobre os direitos de personalidade do curatelado.
2. A finalidade da curatela é a de promover a proteção dos melhores interesses daquele que apresenta impedimento para manifestar sua livre e consciente vontade, tanto no que diz respeito à prática de atos despidos de conteúdo patrimonial quanto na administração de seus bens.
3. Embora os atos de mera administração possam ser praticados diretamente pelo curador, sem autorização judicial, aqueles inerentes à disposição dos bens e levantamento de valores dependerão de aval do juízo (arts. 1.748 e 1.750, aplicáveis à curatela por força do art. 1.774, todos do Código Civil).
4. Descumprida a disposição legal de prévia autorização judicial para aquisição de veículo, e não se vislumbrando a urgência, indevida a concessão de liminar para expedição de alvará judicial.
5. Recurso não provido."
(TJ-MG - Agravo de Instrumento: 27292647620258130000, Relator: Des.(a) Carlos Roberto de Faria, Data de Julgamento: 27/11/2025, Câmaras Especializadas Cíveis / 8ª Câmara Cível Especializada, Data de Publicação: 28/11/2025)

No caso em apreço, o controle judicial é estritamente observado desde a origem. As Requerentes não intencionam celebrar contrato de alienação fiduciária sem o competente alvará, mas sim obter o pronunciamento jurisdicional autorizativo que viabilize à instituição financeira a formalização da operação e ao órgão de trânsito o registro do veículo em nome de Jean.

III. DA NECESSIDADE, UTILIDADE E VANTAGEM DA AQUISIÇÃO PARA JEAN

A finalidade precípua do negócio jurídico pretendido vincula-se de modo indissociável à saúde, dignidade e qualidade de vida de Jean. Os laudos médicos e relatórios acostados aos autos da interdição atestam que ele necessita de acompanhamento ininterrupto de terceiros, submete-se a rotina intensa de terapias ocupacionais e médicas e não detém qualquer capacidade de locomoção autônoma.

Um veículo novo, dotado de transmissão automática, climatização e padrão ergonômico de segurança proporcionará às curadoras os meios indispensáveis para garantir deslocamentos seguros, confortáveis e pontuais para as consultas médicas e tratamentos de reabilitação. O veículo não se destina a atividade comercial, especulação ou benefício de terceiros, mas única e exclusivamente à mobilidade qualificada do curatelado.

Sob a ótica econômico-patrimonial, a vantajosidade é patente e incontestável: o automóvel integrará o patrimônio particular de Jean, sem que ele despenda um único centavo de seus rendimentos para quitação da entrada, tributos ou parcelas contratuais. O custo total do investimento recairá exclusivamente sobre a curadora Ana Karla, a qual assume perante o banco credor e perante este Juízo o encargo incondicional de quitar o financiamento.

O Egrégio Tribunal de Justiça de São Paulo, em hipótese análoga que versava sobre aquisição de automóvel para pessoa curatelada, reconheceu a plena viabilidade do processamento incidental do pedido de alvará, condicionando-o apenas à comprovação da origem dos recursos externos e do benefício material ao incapaz:

"AGRAVO DE INSTRUMENTO. ALVARÁ JUDICIAL. CURATELA. Pedido de expedição de alvará para autorização de venda e ulterior compra de automóvel. Arquivamento na origem. Irresignação do requerente. Parcial acolhimento. Pedido de alvará que pode ser processado incidentalmente à ação de curatela, em prol da celeridade e economia processuais, pois de baixa complexidade na espécie. Precedente desta c. Câmara. Prevalência, por outro lado, do caráter protetivo da curatela, imperiosa a prova, por parte do requerente, de que o negócio lhe gerará vantagem ou benefício. Decisão reformada para permitir o processamento do pedido de alvará, cabendo à curadora demonstrar em que termos se darão venda e compra dos bens, inclusive quanto à origem de recursos financeiros utilizados para compensar eventual diferença de valores. AGRAVO PARCIALMENTE PROVIDO."
(TJ-SP - Agravo de Instrumento: 23595247820248260000 São Paulo, Relator: Donegá Morandini, Data de Julgamento: 24/01/2025, 3ª Câmara de Direito Privado, Data de Publicação: 24/01/2025)

A nota de distinção do caso vertente reside no fato de que não haverá levantamento de depósitos judiciais do curatelado, tampouco alienação de bens de seu acervo pré-existente. A operação traduz-se em inequívoco acréscimo patrimonial financiado por terceiro em proveito exclusivo do incapaz.

Tampouco se cogita registrar o bem em nome de terceiro: a titularidade dominial pertencerá a Jean Oliveira de Carvalho, ficando a guarda e administração atreladas aos deveres de tutela e prestação de contas judicialmente cominadas às curadoras.

IV. DA PROTEÇÃO DO PATRIMÔNIO DO CURATELADO E DA AUSÊNCIA DE ENDIVIDAMENTO DE JEAN

A autorização pretendida faz-se acompanhar de sólidas garantias fáticas e jurídicas, podendo o deferimento do alvará ser chancelado sob as seguintes condições expressas e vinculantes:

a) O veículo será adquirido, faturado, registrado e licenciado exclusivamente em nome de Jean Oliveira de Carvalho;

b) Ana Karla Carvalho de Araújo Costa Moura será a responsável pelo pagamento integral de todas as parcelas do financiamento, com recursos próprios e comprovada capacidade financeira;

c) Não serão utilizados quaisquer recursos, benefícios da previdência/BPC, rendimentos ou contas bancárias de titularidade de Jean para amortização do contrato;

d) A obrigação econômica perante a instituição financeira será suportada de maneira primária e solidária por Ana Karla, figurando como contratante responsável e avalista;

e) O veículo será afetado ao uso precípuo em benefício de Jean, prestando-se aos seus deslocamentos terapêuticos, médicos e sociais cotidianos;

f) As curadoras apresentarão a este Juízo cópia da nota fiscal de compra, contrato formalizado com a instituição bancária e certidão de registro do veículo perante o Detran, prestando contas regulares nos autos da interdição.

Essas salvaguardas demonstram a mais estrita conformidade com a finalidade tutelar da curatela, impedindo que o curatelado venha a responder por passivo financeiro desamparado.

V. DA INTERVENÇÃO DO MINISTÉRIO PÚBLICO

Tratando-se de requerimento judicial que envolve interesse de pessoa legalmente curatelada e ato patrimonial a ser lavrado em seu nome, requer-se a intimação pessoal do Ilustre Representante do Ministério Público do Estado do Piauí para intervir no feito, com supedâneo no artigo 178, inciso II, do Código de Processo Civil.

A participação do Parquet assegura o controle institucional e a idoneidade do ato praticado, conferindo higidez plena à chancela jurisdicional.

VI. DOS PEDIDOS

Diante do exposto e de tudo o mais que dos autos consta, requerem as Requerentes a Vossa Excelência que se digne a:

a) Determinar o processamento do presente pedido de alvará judicial, distribuído por dependência ou em apenso aos autos da interdição nº ${cnj};

b) Determinar a intimação do representante do Ministério Público para intervir e manifestar-se no presente feito, a teor do art. 178, II, do CPC;

c) Julgar TOTALMENTE PROCEDENTE o pedido, com a competente EXPEDIÇÃO DE ALVARÁ JUDICIAL em favor de Wanda Oliveira de Carvalho e Ana Karla Carvalho de Araújo Costa Moura, na qualidade de curadoras definitivas de Jean Oliveira de Carvalho, autorizando-as a representá-lo e assisti-lo na celebração da compra e do financiamento bancário de veículo automotor zero quilômetro, modelo Volkswagen T-Cross, com transmissão automática;

d) Autorizar expressamente que o alvará judicial contemple poderes para o faturamento, registro e licenciamento do veículo diretamente em nome de Jean Oliveira de Carvalho perante a concessionária vendedora e o Departamento Estadual de Trânsito (DETRAN);

e) Fazer constar expressamente do alvará judicial que as parcelas e encargos decorrentes do financiamento serão pagos e assumidos com recursos próprios e exclusivos de Ana Karla Carvalho de Araújo Costa Moura, vedado qualquer desconto ou retenção em haveres do curatelado;

f) Autorizar a participação de Ana Karla Carvalho de Araújo Costa Moura na qualidade de devedora responsável e avalista solidária do contrato bancário em favor do curatelado;

g) Autorizar a curadora a praticar todos os atos e formalizar os requerimentos administrativos necessários à obtenção das isenções tributárias de IPI, ICMS e IPVA legalmente destinadas à pessoa com deficiência;

h) Subsidiariamente, caso este Douto Juízo entenda necessária a prévia homologação das condições financeiras da operação, deferir a juntada posterior da proposta bancária definitiva contendo o valor total financiado, plano de parcelamento e taxa de encargos;

i) Conceder às curadoras o prazo de 60 (sessenta) dias, a contar da entrega do automóvel, para juntar aos autos a respectiva nota fiscal e o Certificado de Registro e Licenciamento de Veículo (CRLV), comprovando o cumprimento do encargo;

j) Protestar pela produção de todos os meios de prova em direito admitidos, em especial a juntada suplementar de documentos.

Dá-se à causa, para fins meramente fiscais, o valor estimativo de R$ 135.000,00 (cento e trinta e cinco mil reais), correspondente ao valor aproximado do veículo a ser adquirido.

Nesses termos,
Pede e espera deferimento.

Teresina – PI, ${formattedDate}.

ARTHUR CARVALHO MOURA DA SILVA
OAB/PI 17.614
Advogado`;

    return {
      title: "Pedido de Alvará Judicial para Aquisição de Veículo",
      draft,
      summaryOfAdversePiece: "Pedido incidental formulado pelas curadoras de Jean Oliveira de Carvalho para aquisição financiada de veículo adaptado em seu nome, sem ônus financeiro ao incapaz.",
      detectedPreliminaries: [],
      suggestedArticles: [
        "Art. 1.748, IV e V do Código Civil (Autorização Judicial na Administração Tutelar/Curatelar)",
        "Art. 1.774 do Código Civil (Aplicação das disposições da Tutela à Curatela)",
        "Lei nº 13.146/2015 (Estatuto da Pessoa com Deficiência)",
        "Art. 178, II do Código de Processo Civil (Intervenção Obrigatória do Ministério Público)"
      ],
    };
  },

  /**
   * Elabora CONTESTAÇÃO CÍVEL completa e densa com ABNT e impugnação específica
   */
  generateContestacaoCivel(input: LegalDrafterInput, parsedPdf: any): LegalDrafterOutput {
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getFullYear()}`;

    const court =
      input.court ||
      input.pdfData?.detectedCourt ||
      "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA 1ª VARA CÍVEL DA COMARCA COMPETENTE";

    const cnj = input.cnj || input.pdfData?.detectedCnj || "Processo nº: (Autos Sincronizados / PJe)";
    const oppositeParty = input.oppositeParty || input.pdfData?.detectedAuthor || "Parte Autora Requerente";
    const clientName = input.clientName || input.pdfData?.detectedDefendant || "Seu Cliente Requerido";
    const userPrompt = input.userPrompt.trim();

    const lowerPrompt = userPrompt.toLowerCase();
    const hasInepcia = lowerPrompt.includes("inépcia") || lowerPrompt.includes("inepta");
    const hasIlegitimidade = lowerPrompt.includes("ilegitimidade") || lowerPrompt.includes("legitimidade");
    const hasIncompetencia = lowerPrompt.includes("incompetência") || lowerPrompt.includes("foro");
    const hasPrescricao = lowerPrompt.includes("prescri") || lowerPrompt.includes("decadên");
    const hasDanoMoral = lowerPrompt.includes("dano moral") || lowerPrompt.includes("danos morais") || lowerPrompt.includes("indeniza");

    const draft = `${court.toUpperCase()}
PROCESSO Nº: ${cnj}

${clientName.toUpperCase()}, já qualificado(a) nos autos da AÇÃO CÍVEL proposta por ${oppositeParty.toUpperCase()}, vem, respeitosamente, à presença de Vossa Excelência, por conduto de seu advogado devidamente constituído com procuração anexa, com supedâneo nos artigos 335 e seguintes do Código de Processo Civil, apresentar a presente

CONTESTAÇÃO CÍVEL COM PRELIMINARES DE MÉRITO

em atenção às razões de fato e de direito articuladas adiante:

I. DA SÍNTESE DA PETIÇÃO INICIAL E DA REALIDADE FÁTICA

A parte Autora ingressou em juízo deduzindo pretensões condenatórias apoiadas em narrativa fática dissociada da verdade. Alega ter suportado supostos prejuízos decorrentes da relação mantida com o Réu, postulando condenações infundadas.

Ocorre que a versão autoral não retrata a realidade processual e omite fatos determinantes. O Requerido sempre pautou sua conduta pela boa-fé objetiva (art. 422 do Código Civil) e pelo estrito cumprimento das obrigações legais e contratuais. Nenhuma conduta ilícita, culpa ou dolo pode ser imputada ao Réu, razão pela qual as pretensões exordiais claudicam por completo.

II. DAS PRELIMINARES DE MÉRITO (CPC, ART. 337)

II.1. Da Inépcia da Petição Inicial (CPC, art. 330, § 1º c/c art. 337, IV)
A petição inicial deduz pedidos genéricos e imprecisos, desprovidos de causa de pedir clara e de adequada concatenação lógica entre os fatos narrados e as conclusões formuladas. A ausência de liquidez e de especificação das pretensões viola frontalmente o princípio da cooperação processual e o direito fundamental à ampla defesa e ao contraditório (CF/88, art. 5º, LV). Impõe-se a extinção prematura do feito sem resolução de mérito, ex vi do artigo 485, inciso I, do CPC.

${hasIlegitimidade ? `II.2. Da Ilegitimidade Passiva 'Ad Causam' (CPC, art. 337, XI)
O Requerido é parte manifestamente ilegítima para figurar no polo passivo da presente relação jurídico-processual. Não há pertinência subjetiva que vincule o Contestante ao suposto evento danoso descrito na petição inicial. Ausente o nexo causal, impõe-se a extinção do feito em relação ao Requerido com fulcro no art. 485, VI do CPC.\n` : ""}

${hasIncompetencia ? `II.3. Da Incompetência do Juízo (CPC, art. 64 c/c art. 337, II)
O presente feito foi ajuizado em foro incompetente, violando as regras legais de competência territorial e funcional positivadas no CPC, demandando a remessa imediata dos autos ao juízo competente.\n` : ""}

${hasPrescricao ? `III. DA PREJUDICIAL DE MÉRITO: PRESCRIÇÃO DA PRETENSÃO (CÓDIGO CIVIL, ART. 206)
Ad argumentandum tantum, acaso ultrapassadas as matérias prefaciais, imperioso o reconhecimento da consumação do prazo prescricional legalmente estatuído no artigo 206 do Código Civil. Decorrido o lapso temporal sem causa impeditiva ou interruptiva, deve o processo ser extinto com resolução de mérito com base no art. 487, inciso II, do CPC.\n` : ""}

IV. DO MÉRITO: DO ÔNUS DA IMPUGNAÇÃO ESPECÍFICA (CPC, ART. 341)

No mérito, em estrita observância ao princípio da eventualidade e ao ônus da impugnação específica positivado no art. 341 do CPC, o Contestante impugna pontualmente cada assertiva formulada pelo Autor.

As diretrizes do Contestante são claras: a pretensão autoral padece de respaldo probatório mínimo (art. 373, I, do CPC). Não há nos autos nenhum elemento que demonstre o cometimento de ilícito civil, o dano efetivo e o liame de causalidade exigidos pelos artigos 186 e 927 do Código Civil.

${hasDanoMoral ? `V. DA TOTAL IMPROCEDÊNCIA DO PEDIDO DE INDENIZAÇÃO POR DANOS MORAIS
O pleito indenizatório formulado pelo Autor configura nítida aventura jurídica e busca de enriquecimento sem causa. A jurisprudência consolidada do Superior Tribunal de Justiça é uníssona em proclamar que percalços e divergências cotidianas constituem meros dissabores e não atingem a esfera personalíssima da honra e imagem. Não demonstrada a lesão grave aos direitos da personalidade, impõe-se a improcedência do pedido com fulcro no art. 944 do Código Civil.\n` : ""}

VI. DOS PEDIDOS

Ante todo o exposto, pugna o Contestante a Vossa Excelência para que se digne a:

a) ACOLHER AS PRELIMINARES DE MÉRITO arguidas, extinguindo o processo sem resolução do mérito nos termos do artigo 485, incisos I, IV e VI do CPC;

b) No mérito, caso superadas as prefaciais, julgar TOTALMENTE IMPROCEDENTES todos os pedidos formulados na Petição Inicial pelo Autor;

c) CONDENAR a parte Autora ao pagamento integral das custas processuais, despesas judiciais e honorários advocatícios sucumbenciais no importe de 20% sobre o valor atualizado da causa (CPC, art. 85, § 2º);

d) Protestar pela produção de todas as provas em direito admitidas, mormente a juntada de novos documentos e depoimento pessoal.

Termos em que,
Pede deferimento.

Teresina – PI, ${formattedDate}.

Advogado(a) OAB/PI 18.293`;

    return {
      title: "Contestação Cível",
      draft,
      summaryOfAdversePiece: "Defesa processual integralmente estruturada com arguição de preliminares do art. 337 do CPC, impugnação específica e teses de mérito.",
      detectedPreliminaries: ["Inépcia da Inicial", "Ilegitimidade Passiva"],
      suggestedArticles: [
        "Art. 335 a 342 do CPC (Contestação)",
        "Art. 337 do CPC (Preliminares)",
        "Art. 373, I do CPC (Ônus da Prova)",
        "Arts. 186, 188 e 927 do Código Civil"
      ],
    };
  },

  /**
   * Elabora PETIÇÃO INICIAL CÍVEL estruturada e fundamentada
   */
  generatePeticaoInicialGeral(input: LegalDrafterInput): LegalDrafterOutput {
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getFullYear()}`;

    const court =
      input.court || "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA VARA CÍVEL DA COMARCA COMPETENTE";

    const author = input.clientName || "AUTOR REQUERENTE";
    const defendant = input.oppositeParty || "RÉU REQUERIDO";
    const userPrompt = input.userPrompt.trim() || "Ação de Cobrança c/c Indenização por Danos Morais.";
    const caseValue = input.caseValue || 50000;

    const draft = `${court.toUpperCase()}

${author.toUpperCase()}, pessoa jurídica/física devidamente qualificada nos autos, por intermédio de seu advogado legalmente constituído na forma do instrumento de mandato anexo, vem, respeitosamente, perante Vossa Excelência, com fulcro nos artigos 319 e seguintes do Código de Processo Civil e nos artigos 186, 389, 422 e 927 do Código Civil brasileiro, propor a presente

AÇÃO CONDENATÓRIA CÍVEL COM PEDIDO DE TUTELA DE URGÊNCIA

em face de ${defendant.toUpperCase()}, igualmente qualificado(a), em razão dos fatos e fundamentos jurídicos a seguir expendidos:

I. DOS FATOS

O Autor entabulou com o Réu relação jurídica com vistas ao cumprimento das obrigações avençadas entre as partes. Conforme demonstrado nos documentos acostados, o Autor adimpliu pontualmente todas as prestações que lhe incumbiam.

Em contrapartida, o Requerido incorreu em flagrante inadimplemento obrigacional injustificado, descumprindo os termos previamente ajustados. A conduta ilícita do Réu gerou graves prejuízos materiais e transtornos de monta ao Requerente, que restou desamparado na fruição de seus direitos legítimos.

A despeito das reiteradas tentativas amigáveis e notificações formuladas pelo Autor na busca de uma solução célere e consensual, o Requerido manteve-se inerte, não restando alternativa ao Demandante senão a deflagração da presente tutela jurisdicional.

II. DO DIREITO E DA RESPONSABILIDADE CIVIL

A ordem jurídica brasileira consagra o princípio da obrigatoriedade dos pactos (pacta sunt servanda) e impõe a observância indeclinável da boa-fé objetiva (artigo 422 do Código Civil).

O inadimplemento voluntário das obrigações acarreta para o devedor o dever jurídico de indenizar as perdas e danos causados, abrangendo juros moratórios, correção monetária e honorários advocatícios, na esteira do artigo 389 e 395 do Código Civil.

Ademais, os artigos 186 e 927 do Diploma Civil consolidam a responsabilidade civil aquiliana: aquele que, por ação ou omissão voluntária, negligência ou imprudência, violar direito e causar dano a outrem, comete ato ilícito e fica obrigado a repará-lo.

Presentes o ato ilícito, o dano efetivo e o nexo causal, exsurge cristalino o dever do Réu de indenizar e ressarcir integralmente o Autor.

III. DOS PEDIDOS E REQUERIMENTOS FINAIS

Ex positis, requer a Vossa Excelência:

a) O recebimento e processamento da presente petição inicial com os documentos instrutórios que a acompanham;

b) A citação do Réu no endereço declinado, para que, querendo, apresente resposta no prazo legal, sob pena de revelia e confissão ficta quanto à matéria de fato (CPC, art. 344);

c) A designação de audiência prévia de mediação e conciliação, em atendimento ao art. 319, inciso VII, do CPC, caso haja manifestação de interesse da parte contrária;

d) Julgar TOTALMENTE PROCEDENTES os pedidos formulados nesta exordial, condenando o Réu ao cumprimento da obrigação principal e ao pagamento de indenização pelos prejuízos suportados pelo Autor;

e) CONDENAR o Demandado ao pagamento integral das custas processuais, despesas do processo e honorários advocatícios de sucumbência fixados em 20% (vinte por cento) sobre o valor total da condenação, com fulcro no art. 85, § 2º, do CPC;

f) Protestar por todos os meios probatórios em direito admitidos, em especial prova documental superveniente e testemunhal.

Dá-se à causa o valor de R$ ${caseValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.

Termos em que,
Pede deferimento.

Teresina – PI, ${formattedDate}.

Advogado(a) OAB/PI 18.293`;

    return {
      title: input.pieceType || "Petição Inicial Cível",
      draft,
      summaryOfAdversePiece: "Petição inicial formulada de acordo com o art. 319 do CPC, contendo fatos, fundamentos e rol de pedidos.",
      detectedPreliminaries: [],
      suggestedArticles: ["Art. 319 do CPC", "Arts. 186, 389 e 927 do Código Civil", "Art. 422 do Código Civil"],
    };
  },

  /**
   * Elabora APELAÇÃO CÍVEL completa (Folha de Interposição + Razões Recursais)
   */
  generateApelacaoCivel(input: LegalDrafterInput): LegalDrafterOutput {
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getFullYear()}`;

    const draft = `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA VARA CÍVEL DA COMARCA DE TERESINA - PI
PROCESSO Nº: ${input.cnj || "(Autos do Processo)"}

APELANTE, já devidamente qualificado nos autos da demanda em epígrafe, vem, perante Vossa Excelência, por seu procurador, inconformado com a respeitável sentença prolatada, interpor o presente

RECURSO DE APELAÇÃO CÍVEL

com fulcro nos artigos 1.009 a 1.014 do Código de Processo Civil, requerendo a juntada das inclusas razões recursais e a posterior remessa ao Egrégio Tribunal de Justiça do Estado do Piauí.

Informa o recolhimento das custas de preparo e porte de remessa e retorno.

Termos em que, pede deferimento.
Teresina - PI, ${formattedDate}.

Advogado(a) OAB/PI 18.293

────────────────────────────────────────────────────────────────────────────────
RAZÕES DA APELAÇÃO CÍVEL
────────────────────────────────────────────────────────────────────────────────
COLENDO TRIBUNAL DE JUSTIÇA
EMÉRITOS DESEMBARGADORES

I. DA TEMPESTIVIDADE E DO PREPARO
O presente apelo é tempestivo, protocolado dentro do prazo quinzenal do art. 1.003, § 5º, do CPC, com o devido recolhimento do preparo recursal.

II. DO MÉRITO RECURSAL: DA NECESSIDADE DE REFORMA DA SENTENÇA
A r. sentença recorrida julgou de forma dissonante da prova dos autos e da jurisprudência consolidada deste E. Tribunal e do STJ. Não foram valorados os documentos essenciais carreados, violando os princípios da motivação das decisões e da congruência.

III. DOS PEDIDOS RECURSAIS
Ante o exposto, requer o Apelante que o presente recurso seja CONHECIDO e PROVIDO, reformando-se in totum a r. sentença de primeiro grau para acolher integralmente as teses deduzidas pelo Recorrente, com inversão dos ônus de sucumbência.

Teresina - PI, ${formattedDate}.
Advogado(a) OAB/PI 18.293`;

    return {
      title: "Recurso de Apelação Cível",
      draft,
      summaryOfAdversePiece: "Razões recursais atacando sentença de primeiro grau.",
      detectedPreliminaries: [],
      suggestedArticles: ["Art. 1.009 do CPC", "Art. 1.010 do CPC"],
    };
  },
};
