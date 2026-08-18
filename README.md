# Faturamento — Terceirização

Sistema web para cadastro e cálculo de faturamento de mão de obra terceirizada: importa a planilha mensal de movimentação, calcula INSS, FGTS, provisões de férias/13º e taxa administrativa por tomador, e exporta o resultado em PDF.

## O que tem

- **Colaboradores** — cadastro completo (124 campos: identificação, cargo, documentos, endereço, dados bancários, dependentes), com busca e paginação.
- **Encargos** — alíquotas de INSS (515/655), FGTS e provisões por código de evento de folha, editável.
- **Informativas** — benefícios de valor fixo mensal (vale-refeição, seguro de vida, crachá etc.).
- **Tomadores** — clientes: regime (FPAS) e taxa administrativa.
- **Faturamento** — sobe o arquivo de Movimentos do mês (`.xlsx`/`.xls`, com ou sem cabeçalho) e calcula o faturamento por tomador, com detalhamento por evento e por colaborador. Exporta em PDF.
- **Importação** — lê uma planilha-base (abas Colaboradores/Encargos/Informativas/Tomadores) e popula o cadastro de uma vez.

## Motor de cálculo (resumo)

Por lançamento, a trilha de cobrança é decidida pelo tipo cadastrado em Encargos para aquele código de evento:

- **Provento (P)**: `DRE → INSS → FGTS → Prov. Férias → Prov. 13º → Encargo (INSS+FGTS) sobre a provisão → BASE`, mais taxa administrativa do tomador e gross-up de nota fiscal (÷ 0,8675).
- **Benefício em espécie / reembolso (I/R)**: cobrado pelo valor de face + taxa administrativa + gross-up, sem INSS/FGTS/provisão.
- **Desconto (D)** e **restatement de FGTS/INSS**: excluídos da soma — são valores descontados do colaborador ou já refletidos na base do provento, não custo adicional para o cliente.

Detalhes completos em [`src/lib/calc/engine.ts`](src/lib/calc/engine.ts).

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em [http://localhost:3000](http://localhost:3000). O banco (SQLite, via `node:sqlite` — nativo do Node ≥ 22) é criado automaticamente em `data/app.db` na primeira execução.

### Testes

```bash
npx vitest run
```

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS · SQLite (`node:sqlite`) · SheetJS (leitura de `.xlsx`/`.xls`) · `@react-pdf/renderer` (exportação em PDF) · Vitest.

## Dados sensíveis

`data/` (banco com CPF, salário e demais dados pessoais) e qualquer planilha (`.xlsx`/`.xls`) ou PDF gerado ficam fora do controle de versão — ver `.gitignore`.
