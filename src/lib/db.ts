import postgres from "postgres";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tomadores (
  codigo INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  fpas INTEGER NOT NULL DEFAULT 655,
  taxa_adm DOUBLE PRECISION NOT NULL DEFAULT 0
);
-- Marca tomadores criados automaticamente a partir de um Cód Serviço sem cadastro (ver
-- upsertTomadoresPendentes em repo/tomadores.ts) — mesmo padrão da situação "Cadastro
-- pendente" de colaboradores. Ficam de fora do faturamento (calculateLine em engine.ts) até
-- alguém completar FPAS/Taxa Adm pela tela de Tomadores, o que já zera esta coluna de volta.
ALTER TABLE tomadores ADD COLUMN IF NOT EXISTS pendente BOOLEAN NOT NULL DEFAULT false;
-- Gross Up da Nota Fiscal desse Tomador — era uma constante global fixa, agora editável por
-- Tomador (ver calcularNf em engine.ts): NF = fatura + (fatura × gross_up) (padrão 0,1325),
-- igual pra qualquer regime. O default da COLUNA (só usado se algum INSERT não passar o campo, o
-- que a aplicação sempre faz — ver upsertTomador/upsertTomadoresPendentes em repo/tomadores.ts)
-- acompanha esse mesmo padrão.
ALTER TABLE tomadores ADD COLUMN IF NOT EXISTS gross_up DOUBLE PRECISION NOT NULL DEFAULT 0.1325;
ALTER TABLE tomadores ALTER COLUMN gross_up SET DEFAULT 0.1325;
-- Operador entre Fatura e Gross Up que define a Nota Fiscal (ver calcularNf em engine.ts):
--   '+' soma a tributação: NF = fatura + (fatura × gross_up)  (padrão, igual pra qualquer regime)
--   '-' subtrai a tributação: NF = fatura - (fatura × gross_up)
--   '*' multiplica direto: NF = fatura × gross_up
--   '/' divide direto: NF = fatura / gross_up
-- Substituiu o hardcode "só o Tomador código 23 divide" por um campo editável por Tomador —
-- por isso o backfill abaixo preserva justamente esse comportamento pra quem já tinha
-- gross_up = 0,8675 (o valor que só fazia sentido pra divisão).
ALTER TABLE tomadores ADD COLUMN IF NOT EXISTS gross_up_operacao TEXT NOT NULL DEFAULT '+';
UPDATE tomadores SET gross_up_operacao = '/' WHERE codigo = 23 AND gross_up_operacao = '+';

CREATE TABLE IF NOT EXISTS encargos (
  codigo INTEGER PRIMARY KEY,
  evento TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'P',
  inss_655 DOUBLE PRECISION NOT NULL DEFAULT 0,
  inss_515 DOUBLE PRECISION NOT NULL DEFAULT 0,
  fgts DOUBLE PRECISION NOT NULL DEFAULT 0,
  prov_ferias DOUBLE PRECISION NOT NULL DEFAULT 0,
  prov_13 DOUBLE PRECISION NOT NULL DEFAULT 0
);
-- Marca quais códigos representam o pagamento real de férias OU de 1/3 (não a provisão
-- mensal) — 'ferias'/'terco'/NULL. Usado para abater o saldo correspondente do colaborador
-- em vez de cobrar o valor cheio de novo. Substituiu a antiga coluna booleana
-- abate_saldo_ferias (que não distinguia férias de 1/3); a coluna antiga fica sem uso.
ALTER TABLE encargos ADD COLUMN IF NOT EXISTS abate_saldo_ferias BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE encargos ADD COLUMN IF NOT EXISTS abate_saldo TEXT;
UPDATE encargos SET abate_saldo = 'ferias' WHERE abate_saldo_ferias = true AND abate_saldo IS NULL;

CREATE TABLE IF NOT EXISTS informativas (
  id TEXT PRIMARY KEY,
  codigo INTEGER,
  evento TEXT NOT NULL,
  valor DOUBLE PRECISION NOT NULL DEFAULT 0,
  recorrencia TEXT,
  inicio TEXT,
  obs TEXT
);

CREATE TABLE IF NOT EXISTS colaboradores (
  matricula INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  situacao TEXT,
  cod_servico INTEGER,
  descricao_servico TEXT,
  salario DOUBLE PRECISION NOT NULL DEFAULT 0,
  admissao TEXT,
  data_demissao TEXT,
  dados TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_colaboradores_nome ON colaboradores(nome);
CREATE INDEX IF NOT EXISTS idx_colaboradores_situacao ON colaboradores(situacao);
CREATE INDEX IF NOT EXISTS idx_colaboradores_cod_servico ON colaboradores(cod_servico);
-- Saldo de férias e saldo de 1/3 já cobrados do tomador (provisão acumulada), editados
-- manualmente e mantidos SEPARADOS — são rubricas distintas na folha. Ficam FORA da coluna
-- dados/upsertColaborador de propósito: um reimport da base de Colaboradores sobrescreve
-- essa coluna inteira, o que apagaria os saldos se eles morassem lá.
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS saldo_ferias DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS saldo_um_terco DOUBLE PRECISION NOT NULL DEFAULT 0;
-- CC do colaborador — não obrigatório, digitado manualmente na tela de Faturamento (ver
-- FaturamentoViewer.tsx) e mostrado no PDF. Fora da coluna dados pelo mesmo motivo dos saldos
-- acima: um reimport da base de Colaboradores não pode apagar o que foi digitado aqui.
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS cc TEXT;

CREATE TABLE IF NOT EXISTS movimentos (
  id TEXT PRIMARY KEY,
  codigo INTEGER NOT NULL,
  matricula INTEGER NOT NULL,
  nome TEXT NOT NULL,
  evento TEXT NOT NULL,
  competencia TEXT NOT NULL,
  valor DOUBLE PRECISION NOT NULL DEFAULT 0,
  ref DOUBLE PRECISION NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'P',
  forma TEXT
);
CREATE INDEX IF NOT EXISTS idx_movimentos_competencia ON movimentos(competencia);
CREATE INDEX IF NOT EXISTS idx_movimentos_matricula ON movimentos(matricula);
-- Quanto do valor desse lançamento foi abatido do saldo (férias OU 1/3, ver
-- abatimento_saldo_tipo) do colaborador, calculado e congelado no momento do upload (ver
-- abatimentoFerias.ts) — não recalcula sozinho depois, pra não derivar do saldo já
-- consumido em uploads futuros nem depender da classificação atual do código em Encargos.
ALTER TABLE movimentos ADD COLUMN IF NOT EXISTS abatimento_ferias DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE movimentos ADD COLUMN IF NOT EXISTS abatimento_saldo_tipo TEXT;

-- Configurações globais simples (chave/valor), editáveis na tela de Faturamento — ex.:
-- valor de PLR por colaborador celetista, aplicado automaticamente todo mês (ver
-- generatePlrCharges em engine.ts) até alguém mudar o valor aqui.
CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY,
  valor DOUBLE PRECISION NOT NULL
);
INSERT INTO configuracoes (chave, valor) VALUES ('plr_celetista', 29.32) ON CONFLICT (chave) DO NOTHING;

-- Desconto de saldo de férias/1/3 lançado manualmente na tela do colaborador (ver
-- descontoSaldoFerias.ts) — separado de Movimentos de propósito: reenviar o arquivo da folha
-- daquela competência (replaceMovimentosPorCompetencia) apaga e recria as linhas de Movimentos,
-- mas não mexe aqui, então o desconto continua sendo aplicado (ver generateDescontoSaldoFeriasCharges
-- em engine.ts, que gera a linha de novo a cada cálculo em vez de depender de uma linha física
-- sobrevivendo em Movimentos). Um valor por matrícula+competência+tipo; salvar de novo pra mesma
-- competência SOMA ao valor já lançado (não substitui).
CREATE TABLE IF NOT EXISTS descontos_saldo (
  matricula INTEGER NOT NULL,
  competencia TEXT NOT NULL,
  tipo TEXT NOT NULL,
  valor DOUBLE PRECISION NOT NULL DEFAULT 0,
  PRIMARY KEY (matricula, competencia, tipo)
);

-- Foto congelada do faturamento de uma competência (ver faturasSalvas.ts) — guarda o resultado
-- inteiro do motor (CalculatedLine[] + warnings) já com os ajustes manuais em vigor no momento
-- de salvar (checkboxes de INSS/FGTS/Provisões por evento, Gross Up, PLR, descontos de saldo).
-- Sem isso, a tela de Faturamento recalcula tudo ao vivo a cada acesso e um mês passado muda
-- retroativamente sempre que alguém mexe numa configuração global hoje — a foto salva aqui é o
-- que fica de referência pra aquele mês, mesmo depois.
--
-- Cada "Salvar Fatura" INSERE uma linha nova (nunca sobrescreve) — é um log, não mais uma linha
-- por competência: dois usuários salvando a mesma competência não apagam a foto um do outro, e
-- cada usuário vê como "ativa" a própria entrada mais recente (não descartada), não a de outro
-- (ver getFaturaSalvaDoUsuario em faturasSalvas.ts). A coluna descartada marca uma entrada que
-- não vale mais como ativa — por um "Descartar" manual do próprio usuário, ou porque o arquivo de
-- Movimentos daquela competência foi reenviado (dados de origem mudaram — ver
-- replaceMovimentosPorCompetencia); em nenhum dos casos a linha é apagada, só marcada, pra sobrar
-- registro na timeline de quem salvou o quê.
CREATE TABLE IF NOT EXISTS faturas_salvas (
  competencia TEXT NOT NULL,
  lines TEXT NOT NULL,
  warnings TEXT NOT NULL DEFAULT '[]',
  salvo_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Migração: a chave primária deixa de ser só competencia (uma linha por mês, compartilhada
-- entre todo mundo) pra virar um log com id próprio por save, dono (usuario_email/nome) e uma
-- coluna descartada que substitui o antigo DELETE. Linhas de antes dessa migração (sem dono
-- conhecido) ganham um id sintético (a própria competência, que já era única) e ficam atribuídas
-- a "sistema".
ALTER TABLE faturas_salvas DROP CONSTRAINT IF EXISTS faturas_salvas_pkey;
ALTER TABLE faturas_salvas ADD COLUMN IF NOT EXISTS id TEXT;
UPDATE faturas_salvas SET id = competencia WHERE id IS NULL;
ALTER TABLE faturas_salvas ALTER COLUMN id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_faturas_salvas_id ON faturas_salvas (id);
ALTER TABLE faturas_salvas ADD COLUMN IF NOT EXISTS usuario_email TEXT NOT NULL DEFAULT 'sistema';
ALTER TABLE faturas_salvas ADD COLUMN IF NOT EXISTS usuario_nome TEXT NOT NULL DEFAULT 'Versão salva antes do login por usuário';
ALTER TABLE faturas_salvas ADD COLUMN IF NOT EXISTS descartada BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_faturas_salvas_competencia_salvo_em ON faturas_salvas (competencia, salvo_em DESC);
CREATE INDEX IF NOT EXISTS idx_faturas_salvas_usuario ON faturas_salvas (competencia, usuario_email, salvo_em DESC);
-- Total fatura (NF) já cobrado na Prévia correspondente, por Centro de Custo, congelado no
-- momento de salvar uma Folha (ver tipoCompetencia.ts/faturaCompetencia.ts) — pra que o
-- "complementar a cobrar" (Folha − Prévia) mostrado na tela e no PDF não mude sozinho se a
-- Prévia for editada/reenviada depois de a Folha já ter sido salva. '[]' quando não há Prévia
-- correspondente (ou a competência é a própria Prévia, ou é antiga e nunca teve esse campo).
ALTER TABLE faturas_salvas ADD COLUMN IF NOT EXISTS previa_total_fatura TEXT NOT NULL DEFAULT '[]';

-- Evento excluído manualmente da fatura de UM colaborador numa competência (ver
-- eventosExcluidos.ts) — some da tabela de eventos e do total faturado só pra ele, não afeta os
-- demais colaboradores do mesmo Centro de Custo. Separado de Movimentos de propósito, igual
-- descontos_saldo acima: reenviar o arquivo da competência não traz o evento de volta sozinho —
-- fica excluído até alguém restaurar manualmente (ver restaurarEvento).
CREATE TABLE IF NOT EXISTS eventos_excluidos (
  competencia TEXT NOT NULL,
  evento TEXT NOT NULL,
  excluido_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Migração: exclusão deixa de ser por Centro de Custo inteiro e vira por colaborador — o recurso
-- tinha acabado de sair, sem uso real ainda, então linhas da chave antiga (ccusto_codigo em vez
-- de matricula) não precisam de backfill, só descartar a coluna velha.
ALTER TABLE eventos_excluidos DROP CONSTRAINT IF EXISTS eventos_excluidos_pkey;
ALTER TABLE eventos_excluidos DROP COLUMN IF EXISTS ccusto_codigo;
ALTER TABLE eventos_excluidos ADD COLUMN IF NOT EXISTS matricula INTEGER NOT NULL DEFAULT 0;
ALTER TABLE eventos_excluidos ALTER COLUMN matricula DROP DEFAULT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_eventos_excluidos_pk ON eventos_excluidos (matricula, competencia, evento);

-- Login do sistema (ver src/lib/auth/). Senha nunca gravada em texto puro: scrypt (Node
-- built-in, sem dependência nem segredo externo) com salt por usuário — ver auth/senha.ts.
-- Cadastro é liberado só pra e-mails de domínios específicos, checado em código (ver
-- auth/dominios.ts), não por uma lista guardada aqui nem em variável de ambiente.
CREATE TABLE IF NOT EXISTS usuarios (
  email TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  senha_salt TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessão de login — token opaco aleatório guardado num cookie httpOnly, validado direto contra
-- esta tabela a cada requisição (ver proxy.ts). Sem JWT/segredo de assinatura: como o Proxy
-- deste Next.js roda em runtime Node.js (não Edge), dá pra consultar o Postgres direto, então
-- não precisa de segredo nenhum fora do banco — nada disso fica em .env.
CREATE TABLE IF NOT EXISTS sessoes (
  token TEXT PRIMARY KEY,
  usuario_email TEXT NOT NULL REFERENCES usuarios(email) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessoes_expira_em ON sessoes(expira_em);
`;

export type Sql = ReturnType<typeof postgres>;

declare global {
  var __sql__: Sql | undefined;
  var __schemaReady__: Promise<void> | undefined;
}

function createClient(): Sql {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não configurada — veja .env.example (string de conexão do Supabase/Postgres).');
  }
  return postgres(connectionString, {
    ssl: "require",
    // O pooler do Supabase em modo "transaction" (porta 6543, usado em serverless)
    // não sustenta prepared statements entre conexões diferentes do PgBouncer.
    prepare: false,
  });
}

/** Conexão única por processo (evita abrir uma conexão nova a cada hot-reload em dev / a cada função serverless reaproveitada). */
export function getDb(): Sql {
  if (!globalThis.__sql__) {
    globalThis.__sql__ = createClient();
  }
  return globalThis.__sql__;
}

/** Garante que as tabelas existem — roda uma vez por processo (idempotente: CREATE TABLE IF NOT EXISTS). */
export async function ensureSchema(): Promise<void> {
  if (!globalThis.__schemaReady__) {
    globalThis.__schemaReady__ = getDb().unsafe(SCHEMA).then(() => undefined);
  }
  return globalThis.__schemaReady__;
}

/**
 * Uso exclusivo em testes: limpa os dados mantendo o schema. Recusa-se a rodar sem
 * TEST_DATABASE_URL configurada (ver src/lib/testSetup.ts) — já apagamos os dados de
 * produção uma vez porque resetDbForTests() rodava TRUNCATE direto no DATABASE_URL
 * de produção, que era o mesmo usado pelos testes. Nunca remova essa checagem.
 */
export async function resetDbForTests(): Promise<void> {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      "resetDbForTests(): TEST_DATABASE_URL não configurada. Recusando rodar TRUNCATE — configure um banco de testes separado (ver .env.example) antes de rodar a suíte.",
    );
  }
  await ensureSchema();
  const sql = getDb();
  await sql`TRUNCATE tomadores, encargos, informativas, colaboradores, movimentos, descontos_saldo, faturas_salvas, eventos_excluidos, usuarios, sessoes`;
  await sql`UPDATE configuracoes SET valor = 29.32 WHERE chave = 'plr_celetista'`;
}
