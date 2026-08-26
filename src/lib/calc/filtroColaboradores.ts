import { getColaboradoresPorMatriculas } from "../repo/colaboradores";
import type { CalculatedLine } from "./engine";

/** Filtros de colaborador aplicados ao faturamento (tela e export de PDF) — ver colaboradorFields.ts. */
export interface FiltrosColaborador {
  codEmp?: string;
  descricaoCargo?: string;
  descricaoDpto?: string;
  descricaoCcusto?: string;
}

export function temFiltroAtivo(f: FiltrosColaborador): boolean {
  return Boolean(f.codEmp || f.descricaoCargo || f.descricaoDpto || f.descricaoCcusto);
}

/** Restringe as linhas calculadas aos colaboradores que batem com os filtros, antes de agregar por tomador. */
export async function filtrarLinesPorColaborador(lines: CalculatedLine[], filtros: FiltrosColaborador): Promise<CalculatedLine[]> {
  if (!temFiltroAtivo(filtros)) return lines;

  const matriculas = [...new Set(lines.map((l) => l.matricula))];
  const colaboradoresPorMatricula = await getColaboradoresPorMatriculas(matriculas);

  return lines.filter((l) => {
    const colaborador = colaboradoresPorMatricula.get(l.matricula);
    if (!colaborador) return false;
    if (filtros.codEmp && String(colaborador.dados.cod_emp ?? "") !== filtros.codEmp) return false;
    if (filtros.descricaoCargo && String(colaborador.dados.descricao_cargo ?? "") !== filtros.descricaoCargo) return false;
    if (filtros.descricaoDpto && String(colaborador.dados.descricao_dpto ?? "") !== filtros.descricaoDpto) return false;
    if (filtros.descricaoCcusto && String(colaborador.dados.descricao_ccusto ?? "") !== filtros.descricaoCcusto) return false;
    return true;
  });
}
