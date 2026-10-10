# SaaS RepHub

Crie um aplicativo web profissional, moderno, responsivo e completo de CRM para gestão de LEADS e clientes de uma REPRESENTAÇÃO COMERCIAL.

O aplicativo será utilizado por um representante comercial que trabalha com diversas fábricas e marcas e precisa controlar todos os leads recebidos, clientes, oportunidades de venda, contatos, follow-ups e resultados comerciais.

O sistema deve ter aparência profissional de um CRM moderno, com interface limpa, intuitiva e rápida, funcionando perfeitamente em computador, tablet e celular.

NOME DO SISTEMA:
"CRM Representação Comercial"

==================================================

OBJETIVO PRINCIPAL
==================================================

O sistema deverá permitir:

Cadastrar as fábricas/marcas representadas.

Cadastrar clientes.

Cadastrar novos leads.

Relacionar cada lead a uma fábrica/marca.

Registrar de onde o lead veio.

Registrar a data em que o lead entrou.

Registrar todo o histórico de atendimento.

Controlar se o catálogo foi enviado.

Controlar se o cliente demonstrou interesse.

Controlar se o lead foi positivado/converteu.

Registrar quando o cliente recusou.

Registrar o motivo da recusa.

Criar tarefas e lembretes de follow-up.

Avisar o administrador quando um lead estiver sem retorno.

Permitir contato novamente por WhatsApp ou SMS.

Ter dashboard com indicadores comerciais.

Permitir filtros e pesquisas.

Manter histórico completo de cada cliente e lead.

Evitar que oportunidades sejam esquecidas.

O foco principal do sistema é garantir que NENHUM LEAD fique esquecido ou sem acompanhamento.

==================================================
2. PERFIS DE USUÁRIO

Criar inicialmente dois níveis de acesso:

ADMINISTRADOR

Pode:

Ver todos os dados.

Criar, editar e excluir empresas/marcas.

Criar, editar e excluir clientes.

Criar e editar leads.

Alterar status.

Criar tarefas.

Criar lembretes.

Visualizar dashboard.

Visualizar relatórios.

Configurar notificações.

Gerenciar usuários.

Visualizar histórico completo.

VENDEDOR/REPRESENTANTE

Pode:

Cadastrar leads.

Cadastrar clientes.

Atualizar atendimentos.

Registrar contatos.

Alterar status dos próprios leads.

Criar lembretes.

Visualizar seus clientes.

Visualizar seu pipeline.

Deixar a estrutura preparada para futuramente adicionar mais usuários e representantes.

==================================================
3. CADASTRO DE FÁBRICAS / MARCAS

Criar módulo:

"FÁBRICAS / MARCAS"

Campos:

ID

Nome da empresa

Razão social

Nome fantasia

CNPJ

Marca

Segmento

Nome do responsável comercial

Telefone

WhatsApp

E-mail

Site

Estado

Cidade

Endereço

Observações

Status: Ativa / Inativa

Permitir cadastrar várias fábricas/marcas.

Exemplo:

Fábrica:
Grupo XYZ

Marca:
Marca ABC

Segmento:
Moda Infantil

O sistema deve permitir relacionar vários leads e clientes à mesma marca.

==================================================
4. CADASTRO DE CLIENTES

Criar módulo:

"CLIENTES"

Campos:

DADOS DA EMPRESA:

ID

CNPJ

Razão Social

Nome Fantasia

Inscrição Estadual

Segmento

Tipo de cliente

Cidade

Estado

Endereço

Bairro

CEP

CONTATO:

Nome do responsável

Cargo/função

Telefone

WhatsApp

E-mail

Instagram

Outros contatos

COMERCIAL:

Marcas de interesse

Representante responsável

Data do primeiro contato

Origem do cliente

Status do cliente

Potencial de compra

Observações gerais

STATUS DO CLIENTE:

Prospect

Lead

Em negociação

Cliente ativo

Cliente inativo

Cliente perdido

Permitir cadastrar mais de um contato para a mesma empresa.

==================================================
5. CADASTRO DE LEADS

Criar módulo principal:

"LEADS"

Este será o coração do sistema.

Cada lead deverá possuir:

DADOS DO LEAD:

ID do lead

Data de entrada

Hora de entrada

Empresa

CNPJ

Razão Social

Nome Fantasia

Cidade

Estado

Nome do responsável

Cargo

Telefone

WhatsApp

E-mail

Instagram

Site

ORIGEM DO LEAD:

Criar campo obrigatório:

"Como esse lead chegou?"

Opções:

WhatsApp

Instagram

Facebook

Site

Indicação

Ligação

Visita presencial

Cliente antigo

Evento/Feira

Prospecção ativa

Fábrica

Representação

Google

Outro

Permitir cadastrar novas fontes posteriormente.

==================================================
6. MARCA SOLICITADA

No cadastro do lead, criar campo:

"MARCA / FÁBRICA DE INTERESSE"

Permitir selecionar uma ou mais marcas/fábricas cadastradas.

Exemplo:

Cliente entrou interessado em:

[X] Alphabeto
[ ] Marca B
[ ] Marca C

Se o lead demonstrar interesse em mais de uma marca, manter todas vinculadas.

==================================================
7. STATUS DO LEAD

Criar um pipeline visual estilo Kanban.

Colunas:

NOVO LEAD

PRIMEIRO CONTATO PENDENTE

CONTATO REALIZADO

CATÁLOGO A ENVIAR

CATÁLOGO ENVIADO

AGUARDANDO RETORNO

EM NEGOCIAÇÃO

POSITIVADO

NÃO QUIS

SEM RETORNO

PERDIDO

Permitir arrastar o lead entre as colunas.

Cada alteração deverá ficar registrada no histórico.

==================================================
8. PROCESSO DE ATENDIMENTO

Dentro de cada lead, criar uma timeline/histórico.

Exemplo:

08/09/2026 09:30
Lead recebido pelo WhatsApp.

08/09/2026 10:15
Primeiro contato realizado.

08/09/2026 10:20
Cliente demonstrou interesse.

08/09/2026 10:30
Catálogo enviado.

09/09/2026 14:00
Cliente ainda não respondeu.

10/09/2026 09:00
Follow-up realizado.

Permitir registrar:

Data

Hora

Tipo de contato

Responsável

Descrição

Resultado

Próxima ação

Data do próximo contato

TIPOS DE CONTATO:

WhatsApp

Ligação

SMS

E-mail

Instagram

Visita

Reunião

Outro

==================================================
9. CATÁLOGO

Criar controle:

"CATÁLOGO"

Campos:

Catálogo enviado? SIM/NÃO

Data do envio

Forma de envio

Catálogo/coleção

Observação

Formas:

WhatsApp

E-mail

Link

Presencial

Outro

Permitir futuramente anexar arquivos PDF dos catálogos às marcas.

==================================================
10. POSITIVAÇÃO

Criar campo:

"LEAD POSITIVADO?"

Opções:

Sim

Não

Em negociação

Aguardando pedido

Quando selecionar "POSITIVADO":

Solicitar:

Data da positivação

Marca

Valor estimado do pedido

Valor efetivo do pedido

Número do pedido

Observações

Criar indicador de conversão.

==================================================
11. LEAD QUE NÃO QUIS

Quando o usuário selecionar:

"CLIENTE NÃO QUIS"

abrir automaticamente campo:

"MOTIVO DA RECUSA"

Opções:

Preço

Prazo

Já trabalha com outra marca

Não trabalha com esse segmento

Sem interesse no momento

Estoque alto

Problema financeiro

Condições comerciais

Marca não agradou

Público diferente

Já possui fornecedor

Não respondeu após contatos

Outro

Adicionar campo:

"Observação da recusa"

Permitir escrever livremente o motivo.

==================================================
12. FOLLOW-UP / LEMBRETES

Criar um sistema de tarefas e lembretes.

Exemplo:

Lead entrou hoje.

Após 2 dias sem resposta:

"LEMBRETE:
Entrar em contato novamente com João da Loja XYZ sobre a marca ABC."

Permitir configurar:

Data

Hora

Lead

Cliente

Responsável

Tipo de lembrete

Observação

Prioridade

Prioridades:

Baixa

Normal

Alta

Urgente

==================================================
13. ALERTA DE LEAD SEM RETORNO

Criar inteligência automática:

Se um lead permanecer sem interação durante determinado período, mostrar alerta.

Exemplo:

"⚠️ 12 leads estão sem retorno há mais de 3 dias."

"🔴 5 leads estão sem retorno há mais de 7 dias."

Permitir configurar o período:

1 dia

2 dias

3 dias

5 dias

7 dias

Personalizado

No dashboard criar seção:

"LEADS QUE PRECISAM DE ATENÇÃO"

Mostrar:

Cliente | Marca | Último contato | Dias sem retorno | Próxima ação

==================================================
14. WHATSAPP

Preparar integração com WhatsApp.

Na página do lead criar botão:

"ENVIAR WHATSAPP"

Ao clicar:

Abrir conversa do WhatsApp com o número cadastrado.

Permitir mensagens pré-configuradas.

Exemplo:

"Olá, [NOME]. Tudo bem?

Estou entrando em contato para saber se conseguiu analisar o catálogo da [MARCA].

Fico à disposição para apresentar melhor a coleção e as condições comerciais.

Abraço!"

Utilizar os dados do cliente automaticamente.

Preparar arquitetura para futuramente integrar WhatsApp Business API oficial para envio automático.

IMPORTANTE:

Não utilizar métodos não oficiais ou que possam causar bloqueio da conta.

==================================================
15. SMS

Criar estrutura para integração com serviço de SMS.

No sistema deverá existir botão:

"ENVIAR SMS"

Permitir enviar lembretes ou mensagens para clientes.

Deixar a integração preparada para serviços externos de SMS.

==================================================
16. DASHBOARD

Criar um dashboard profissional.

Mostrar cards:

Total de Leads

Leads novos hoje

Leads esta semana

Leads este mês

Leads em negociação

Leads aguardando retorno

Leads positivados

Leads perdidos

Leads sem retorno

Taxa de conversão

Valor estimado em negociação

Valor vendido

Criar gráficos:

Leads por mês

Leads por origem

Leads por marca

Leads por cidade

Conversão por marca

Conversão por origem

Motivos de perda

Funil de vendas

==================================================
17. FUNIL DE VENDAS

Criar gráfico visual:

NOVOS LEADS
↓
CONTATO
↓
CATÁLOGO ENVIADO
↓
AGUARDANDO RETORNO
↓
NEGOCIAÇÃO
↓
POSITIVADO

Mostrar quantidade e percentual em cada etapa.

==================================================
18. FILTROS

Permitir filtrar leads por:

Data

Marca

Fábrica

Cidade

Estado

Origem

Status

Responsável

Positivado

Catálogo enviado

Sem retorno

Motivo da perda

Criar pesquisa rápida por:

CNPJ

Razão Social

Nome Fantasia

Nome do responsável

Telefone

WhatsApp

==================================================
19. PÁGINA DETALHADA DO LEAD

Ao abrir um lead, criar uma página completa.

No topo:

NOME DA EMPRESA
STATUS DO LEAD
MARCA
RESPONSÁVEL

Abaixo:

DADOS DA EMPRESA

DADOS DO CONTATO

ORIGEM

MARCA SOLICITADA

STATUS

CATÁLOGO

HISTÓRICO DE ATENDIMENTO

TAREFAS

PRÓXIMO FOLLOW-UP

OBSERVAÇÕES

BOTÕES:

[WhatsApp]
[Ligar]
[E-mail]
[Adicionar interação]
[Adicionar tarefa]
[Enviar catálogo]
[Alterar status]
[Converter em cliente]

==================================================
20. CONVERSÃO DE LEAD EM CLIENTE

Quando um lead for positivado, permitir botão:

"CONVERTER EM CLIENTE"

O sistema deverá automaticamente:

Criar cliente.

Copiar dados da empresa.

Copiar contatos.

Copiar marca.

Copiar histórico.

Manter origem.

Manter data do primeiro contato.

Manter informações comerciais.

Nunca apagar o histórico original do lead.

==================================================
21. NOTIFICAÇÕES

Criar sistema de notificações internas.

Exemplos:

"Novo lead recebido."

"Lead sem retorno há 3 dias."

"Follow-up agendado para hoje."

"5 leads precisam de atendimento."

"Lead positivado."

"Lead marcado como perdido."

Criar central de notificações.

==================================================
22. AGENDA / TAREFAS

Criar uma agenda comercial.

Visualizações:

Hoje

Semana

Mês

Mostrar:

Follow-ups

Ligações

Visitas

Reuniões

Retornos

Leads pendentes

Permitir clicar no compromisso e abrir o lead.

==================================================
23. RELATÓRIOS

Criar módulo:

"RELATÓRIOS"

Relatórios:

Leads por período

Leads por marca

Leads por cidade

Leads por origem

Leads positivados

Leads perdidos

Taxa de conversão

Motivos de perda

Clientes novos

Clientes ativos

Clientes inativos

Valor de vendas

Performance por marca

Performance por responsável

Permitir exportar para:

Excel

CSV

PDF

==================================================
24. BANCO DE DADOS

Utilizar banco de dados relacional.

Criar tabelas bem estruturadas:

users
companies
brands
clients
contacts
leads
lead_brands
lead_interactions
lead_status_history
tasks
notifications
catalogs
sales
loss_reasons
lead_sources

Criar relacionamentos corretamente.

Cada registro deverá possuir:

ID único

created_at

updated_at

Registrar também:

created_by

updated_by

==================================================
25. SEGURANÇA

Implementar:

Login

Senha

Controle de sessão

Recuperação de senha

Controle de permissões

Proteção das rotas

Criptografia de senhas

Validação dos dados

Proteção contra acesso não autorizado

Nunca armazenar senhas em texto puro.

==================================================
26. LGPD

Como o sistema armazenará dados de empresas e contatos, estruturar o sistema pensando em LGPD.

Implementar:

Controle de acesso

Registro de alterações

Proteção de dados

Possibilidade de excluir dados quando necessário

Política de retenção preparada para configuração

Não expor dados de clientes publicamente

==================================================
27. INTERFACE

Criar uma interface extremamente profissional.

Estilo:

CRM empresarial moderno

Visual premium

Layout limpo

Menu lateral

Dashboard com cards

Gráficos modernos

Tabelas organizadas

Kanban para leads

Ícones intuitivos

Responsivo

Excelente experiência em celular

Menu lateral:

DASHBOARD

LEADS

CLIENTES

FÁBRICAS / MARCAS

AGENDA

TAREFAS

RELATÓRIOS

NOTIFICAÇÕES

CONFIGURAÇÕES

USUÁRIOS

==================================================
28. CORES

Utilizar visual profissional.

Base:

Fundo claro

Branco

Cinza

Preto/grafite

Uma cor principal de destaque

Permitir futuramente alterar a cor principal da identidade visual.

Criar também modo escuro opcional.

==================================================
29. AUTOMATIZAÇÕES

Criar automações:

AUTOMAÇÃO 1

Novo lead cadastrado.

→ Criar automaticamente tarefa:
"Realizar primeiro contato."

AUTOMAÇÃO 2

Catálogo enviado.

→ Criar tarefa de follow-up após X dias.

AUTOMAÇÃO 3

Lead sem interação.

→ Criar alerta automático.

AUTOMAÇÃO 4

Lead positivado.

→ Alterar automaticamente para cliente.

AUTOMAÇÃO 5

Lead perdido.

→ Solicitar motivo da perda.

AUTOMAÇÃO 6

Follow-up vencido.

→ Mostrar alerta no dashboard.

==================================================
30. INTELIGÊNCIA COMERCIAL

Criar futuramente estrutura para indicadores inteligentes.

Exemplos:

"Você possui 18 leads sem retorno."

"Os leads provenientes do WhatsApp possuem conversão de 32%."

"A marca X possui maior conversão neste mês."

"Existem 7 clientes que não recebem contato há mais de 30 dias."

"Você possui 12 leads em negociação com potencial estimado de R$ 85.000."

Criar estrutura para que esses indicadores possam ser calculados automaticamente.

==================================================
31. EXPERIÊNCIA DO USUÁRIO

O cadastro de um novo lead deve ser extremamente rápido.

Criar botão fixo:

"+ NOVO LEAD"

Ao clicar, abrir formulário simples:

EMPRESA
CNPJ
CONTATO
WHATSAPP
CIDADE
MARCA
ORIGEM
DATA
OBSERVAÇÃO

Botão:

"SALVAR LEAD"

Depois de salvar, abrir automaticamente a página do lead.

==================================================
32. DETALHE IMPORTANTE — LEAD NÃO PODE SER ESQUECIDO

Este é um dos objetivos mais importantes do aplicativo.

O sistema deverá identificar automaticamente leads que estão parados.

Exemplo:

Lead entrou:
08/09

Catálogo enviado:
08/09

Último contato:
08/09

Hoje:
12/09

O sistema deverá mostrar:

🔴 ATENÇÃO

"Cliente sem retorno há 4 dias."

Botões:

[ENTRAR EM CONTATO]
[AGENDAR FOLLOW-UP]
[MARCAR COMO PERDIDO]

==================================================
33. RESPONSIVIDADE

O aplicativo deverá funcionar perfeitamente em:

Desktop

Notebook

Tablet

Smartphone

No celular, adaptar o menu e transformar tabelas em cards quando necessário.

==================================================
34. PERFORMANCE

O sistema deve ser rápido mesmo com milhares de leads.

Implementar:

Paginação

Pesquisa otimizada

Filtros no banco de dados

Carregamento sob demanda

Cache quando necessário

Consultas otimizadas

==================================================
35. ARQUITETURA

Construir o aplicativo de forma modular e escalável.

Separar:

Frontend
Backend
Banco de dados
Autenticação
Notificações
Integrações
Relatórios

A arquitetura deverá permitir posteriormente adicionar:

WhatsApp Business API

SMS

E-mail automático

Integração com Google Calendar

Integração com ERP

Integração com emissão de pedidos

Controle de comissão

Controle financeiro

Aplicativo mobile

==================================================
36. RESULTADO ESPERADO

Entregar um CRM funcional, profissional e pronto para utilização real.

O sistema deve permitir que o representante comercial consiga responder rapidamente:

Quantos leads tenho?

Quantos entraram hoje?

De onde estão vindo meus leads?

Qual marca está sendo mais procurada?

Quais clientes estão em negociação?

Quais clientes receberam catálogo?

Quem ainda não respondeu?

Quem precisa de follow-up hoje?

Quais leads foram positivados?

Quais clientes não quiseram?

Por que não quiseram?

Quanto estou potencialmente vendendo?

Qual marca converte mais?

Qual cidade gera mais clientes?

Qual origem gera mais vendas?

O sistema deve ter como principal filosofia:

"CAPTAR → ATENDER → ACOMPANHAR → NEGOCIAR → POSITIVAR → FIDELIZAR"

Não criar apenas uma agenda de contatos. Criar um verdadeiro CRM comercial focado em REPRESENTAÇÃO COMERCIAL, LEADS, FOLLOW-UP E CONVERSÃO.

Antes de finalizar o desenvolvimento, criar dados fictícios de demonstração para que seja possível testar todas as funções do sistema.

Criar também um usuário administrador inicial para testes e deixar a estrutura preparada para alteração das credenciais no primeiro acesso.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://navorbr.com

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/377dd057-7e75-4712-bd8e-b5043990c8be).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
