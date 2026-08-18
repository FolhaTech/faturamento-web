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

/** Uso exclusivo em testes: limpa os dados mantendo o schema (o projeto Supabase é compartilhado entre execuções de teste). */
export async function resetDbForTests(): Promise<void> {
  await ensureSchema();
  const sql = getDb();
  await sql`TRUNCATE tomadores, encargos, informativas, colaboradores, movimentos`;
}
