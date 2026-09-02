import { getColaboradoresPorMatriculas } from "../repo/colaboradores";
import type { CalculatedLine } from "./engine";

/** Filtros de colaborador aplicados ao faturamento (tela e export de PDF) — ver colaboradorFields.ts. */
export interface FiltrosColaborador {
  codEmp?: string;
  descricaoCargo?: string;
  descricaoDpto?: string;
  descricaoCcusto?: string;
  /** FPAS do Tomador — 515 (Terceiro/CLT) ou 655 (Temporário) — separa faturamento/PDF por regime. Vem direto de CalculatedLine.fpas, sem precisar consultar Colaboradores. */
  fpas?: 515 | 655;
}

export function temFiltroAtivo(f: FiltrosColaborador): boolean {
  return Boolean(f.codEmp || f.descricaoCargo || f.descricaoDpto || f.descricaoCcusto || f.fpas);
}

/** Restringe as linhas calculadas aos colaboradores que batem com os filtros, antes de agregar por tomador. */
export async function filtrarLinesPorColaborador(lines: CalculatedLine[], filtros: FiltrosColaborador): Promise<CalculatedLine[]> {
  if (!temFiltroAtivo(filtros)) return lines;

  // Regime (fpas) já está na própria linha calculada — só busca Colaboradores quando algum
  // outro filtro (que depende do cadastro) também está ativo.
  const precisaColaborador = Boolean(filtros.codEmp || filtros.descricaoCargo || filtros.descricaoDpto || filtros.descricaoCcusto);
  const colaboradoresPorMatricula = precisaColaborador
    ? await getColaboradoresPorMatriculas([...new Set(lines.map((l) => l.matricula))])
    : null;

  return lines.filter((l) => {
    if (filtros.fpas && l.fpas !== filtros.fpas) return false;
    if (!colaboradoresPorMatricula) return true;
    const colaborador = colaboradoresPorMatricula.get(l.matricula);
    if (!colaborador) return false;
    if (filtros.codEmp && String(colaborador.dados.cod_emp ?? "") !== filtros.codEmp) return false;
    if (filtros.descricaoCargo && String(colaborador.dados.descricao_cargo ?? "") !== filtros.descricaoCargo) return false;
    if (filtros.descricaoDpto && String(colaborador.dados.descricao_dpto ?? "") !== filtros.descricaoDpto) return false;
    if (filtros.descricaoCcusto && String(colaborador.dados.descricao_ccusto ?? "") !== filtros.descricaoCcusto) return false;
    return true;
  });
}
