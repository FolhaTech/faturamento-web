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

### Reservas cobradas no faturamento

Na ficha do colaborador, abra **Consultar reservas**. Férias + 1/3 e 13º vêm do histórico mensal de provisões da Folha, descontando os abatimentos já lançados. O aviso prévio usa as faturas de fechamento salvas, preservando cobranças de aviso confirmadas anteriormente. O histórico da Folha sem período aquisitivo cadastrado aparece agrupado como **Histórico da Folha**.

O painel mostra o saldo e exige que o operador aplique o crédito. Férias são proporcionais aos dias usados (2,5 dias por mês com cobrança no período). O 13º é encerrado em dezembro ou no desligamento, dentro do mesmo exercício. Na rescisão, as férias são quitadas pelo saldo dos períodos do vínculo e o aviso considera os 12 meses fechados anteriores ao mês de desligamento. Confira essa janela e os valores com a fatura e as condições do tomador.

A retirada de um crédito é registrada no histórico. Créditos mudam o cálculo ao vivo; para usar o novo cálculo em uma versão salva, salve uma nova versão antes de exportar. Créditos posteriores precisam ser revistos antes de lançar cobranças ou créditos retroativos que mudariam sua base.
