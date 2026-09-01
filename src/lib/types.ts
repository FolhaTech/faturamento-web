export type TipoEvento = "P" | "D" | "I" | "R" | "FGTS" | "INSS";

/** Qual saldo do colaborador um código de férias/1/3 real abate — ver Encargo.abateSaldo. */
export type TipoSaldoFerias = "ferias" | "terco";

export interface Tomador {
  codigo: number;
  nome: string;
  fpas: 515 | 655;
  taxaAdm: number;
  /** true = criado automaticamente a partir de um Cód Serviço sem cadastro em Tomadores (ver upsertTomadoresPendentes) — ainda não entra no faturamento até alguém completar FPAS/Taxa Adm pela tela. */
  pendente: boolean;
}

export interface Encargo {
  codigo: number;
  evento: string;
  tipo: TipoEvento;
  inss655: number;
  inss515: number;
  fgts: number;
  provFerias: number;
  prov13: number;
  /** Marca este código como o pagamento real de férias OU de 1/3 (não a provisão mensal) — abate o saldo correspondente do colaborador em vez de cobrar o valor cheio. null = não abate nenhum saldo. */
  abateSaldo: TipoSaldoFerias | null;
}

export interface Informativa {
  id: string;
  codigo: number | null;
  evento: string;
  valor: number;
  recorrencia: string | null;
  inicio: string | null;
  obs: string | null;
}

export interface Movimento {
  id: string;
  codigo: number;
  matricula: number;
  nome: string;
  evento: string;
  competencia: string;
  valor: number;
  ref: number;
  tipo: TipoEvento;
  forma: string | null;
  /** Quanto desse lançamento foi abatido do saldo (férias ou 1/3) do colaborador — congelado no upload (ver abatimentoFerias.ts). Opcional: ausente = 0. */
  abatimentoFerias?: number;
  /** De qual saldo veio o abatimento acima — congelado junto, não deriva da classificação atual do código. Opcional: ausente = nenhum abatimento. */
  abatimentoSaldoTipo?: TipoSaldoFerias | null;
}

/** Valor de cada campo do formulário de Colaborador (ver colaboradorFields.ts). */
export type DadosColaborador = Record<string, string | number | null>;

export interface Colaborador {
  matricula: number;
  nome: string;
  situacao: string | null;
  codServico: number | null;
  descricaoServico: string | null;
  salario: number;
  admissao: string | null;
  dataDemissao: string | null;
  dados: DadosColaborador;
  /** Saldo de férias já provisionado/cobrado do tomador, editado manualmente — ver saldo_ferias em db.ts. */
  saldoFerias: number;
  /** Saldo de 1/3 constitucional já provisionado/cobrado do tomador, editado manualmente — separado do saldo de férias. */
  saldoUmTerco: number;
}
