import postgres from "postgres";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tomadores (
  codigo INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  fpas INTEGER NOT NULL DEFAULT 655,
  taxa_adm DOUBLE PRECISION NOT NULL DEFAULT 0
);

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
    // Cada invocação serverless da Vercel é um processo próprio — sem isso, o pool padrão
    // (10 conexões) de cada instância concorrente esgota rápido o limite de conexões do
    // pooler do Supabase, travando novas conexões em "statement timeout" até para queries
    // triviais (visto em produção em 2026-08-31/09-01). Recomendação oficial do Supabase
    // para postgres.js em serverless: 1 conexão por instância, liberada rápido quando ociosa.
    max: 1,
    idle_timeout: 20,
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
  await sql`TRUNCATE tomadores, encargos, informativas, colaboradores, movimentos`;
  await sql`UPDATE configuracoes SET valor = 29.32 WHERE chave = 'plr_celetista'`;
}
