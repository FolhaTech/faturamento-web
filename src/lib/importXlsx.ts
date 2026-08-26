import { CAMPOS_COLABORADOR } from "./colaboradorFields";
import { upsertColaborador } from "./repo/colaboradores";
import { getEncargo, upsertEncargo } from "./repo/encargos";
import { createInformativa, findInformativaByEvento, updateInformativa } from "./repo/informativas";
import { upsertTomador } from "./repo/tomadores";
import type { DadosColaborador, TipoEvento } from "./types";
import { readWorkbookGrid } from "./xlsx/grid";
import { asDateString, asNumber, asString, detectHeaderRow, headerMap, iterateRows } from "./xlsx/readTable";

const ACCENTS: [string, string][] = [
  ["ç", "c"],
  ["ã", "a"],
  ["á", "a"],
  ["à", "a"],
  ["â", "a"],
  ["é", "e"],
  ["ê", "e"],
  ["í", "i"],
  ["ó", "o"],
  ["õ", "o"],
  ["ô", "o"],
  ["ú", "u"],
  ["ü", "u"],
];

/** Mesma regra usada para gerar colaboradorFields.ts — mantém as chaves em sincronia com os cabeçalhos reais da planilha. */
function slugify(header: string): string {
  let k = header.toLowerCase();
  for (const [a, b] of ACCENTS) k = k.split(a).join(b);
  return k.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const TIPO_CAMPO = new Map(CAMPOS_COLABORADOR.map((c) => [c.key, c.tipo]));

export interface ImportResult {
  tomadores: number;
  encargos: number;
  informativas: number;
  colaboradores: number;
  avisos: string[];
}

export async function importReferenceBase(buffer: Buffer): Promise<ImportResult> {
  const grid = await readWorkbookGrid(buffer);
  const avisos: string[] = [];

  let nTomadores = 0;
  let nEncargos = 0;
  let nInformativas = 0;
  let nColaboradores = 0;

  const tomadoresSheet = grid.getSheet(["Tomadores"]);
  if (tomadoresSheet) {
    const headerRow = detectHeaderRow(tomadoresSheet, ["CÓD", "TOMADOR"]);
    const h = headerMap(tomadoresSheet, headerRow);
    for (const { get } of iterateRows(tomadoresSheet, headerRow)) {
      const codigo = asNumber(get(h.get("CÓD")!));
      const nome = asString(get(h.get("TOMADOR")!));
      if (!codigo || !nome) continue;
      const fpasNum = asNumber(get(h.get("FPAS")!));
      await upsertTomador({ codigo, nome, fpas: fpasNum === 515 ? 515 : 655, taxaAdm: asNumber(get(h.get("TAXA ADM")!)) });
      nTomadores++;
    }
  } else {
    avisos.push('Aba "Tomadores" não encontrada no arquivo — nenhum tomador importado.');
  }

  const encargosSheet = grid.getSheet(["Encargos"]);
  if (encargosSheet) {
    const headerRow = detectHeaderRow(encargosSheet, ["CÓD", "CÓD."]);
    const h = headerMap(encargosSheet, headerRow);
    const seen = new Set<number>();
    for (const { get } of iterateRows(encargosSheet, headerRow)) {
      const codigo = asNumber(get(h.get("CÓD")!));
      if (!codigo || seen.has(codigo)) continue;
      seen.add(codigo);
      const tipoRaw = (asString(get(h.get("tipo")!)) ?? "P").toUpperCase();
      const tipo = (["P", "D", "I", "R", "FGTS", "INSS"].includes(tipoRaw) ? tipoRaw : "P") as TipoEvento;
      // A planilha de referência não tem coluna pra "abate saldo de férias" (é uma marcação
      // manual feita depois em Encargos) — preserva o que já estava salvo em vez de resetar.
      const existente = await getEncargo(codigo);
      await upsertEncargo({
        codigo,
        evento: asString(get(h.get("EVENTO")!)) ?? "",
        tipo,
        inss655: asNumber(get(h.get("INSS 655")!)),
        inss515: asNumber(get(h.get("INSS 515")!)),
        fgts: asNumber(get(h.get("FGTS")!)),
        provFerias: asNumber(get(h.get("PROV FÉR")!)),
        prov13: asNumber(get(h.get("PROV 13º")!)),
        abateSaldoFerias: existente?.abateSaldoFerias ?? false,
      });
      nEncargos++;
    }
  } else {
    avisos.push('Aba "Encargos" não encontrada no arquivo — nenhum encargo importado.');
  }

  const informativasSheet = grid.getSheet(["Informativas"]);
  if (informativasSheet) {
    const headerRow = detectHeaderRow(informativasSheet, ["CÓD", "EVENTO"]);
    const h = headerMap(informativasSheet, headerRow);
    for (const { get } of iterateRows(informativasSheet, headerRow)) {
      const evento = asString(get(h.get("EVENTO")!));
      if (!evento) continue;
      const codNum = asNumber(get(h.get("CÓD")!));
      const input = {
        codigo: codNum > 0 ? codNum : null,
        evento,
        valor: asNumber(get(h.get("VALOR")!)),
        recorrencia: asString(get(h.get("RECORRÊNCIA")!)),
        inicio: asDateString(get(h.get("INÍCIO")!)),
        obs: asString(get(h.get("OBS")!)),
      };
      const existing = await findInformativaByEvento(evento);
      if (existing) await updateInformativa(existing.id, input);
      else await createInformativa(input);
      nInformativas++;
    }
  } else {
    avisos.push('Aba "Informativas" não encontrada no arquivo — nenhuma informativa importada.');
  }

  const colaboradoresSheet = grid.getSheet(["Colaboradores"]);
  if (colaboradoresSheet) {
    const headerRow = detectHeaderRow(colaboradoresSheet, ["Cód Epr", "Nome"]);
    const headerRowValues = colaboradoresSheet.rows[headerRow] ?? [];
    const columnKeys = headerRowValues.map((v) => (typeof v === "string" && v.trim() ? slugify(v.trim()) : null));

    for (const { get } of iterateRows(colaboradoresSheet, headerRow)) {
      const dados: DadosColaborador = {};
      columnKeys.forEach((key, col) => {
        if (!key) return;
        const raw = get(col);
        const tipo = TIPO_CAMPO.get(key) ?? "text";
        dados[key] = tipo === "number" ? asNumber(raw) : tipo === "date" ? asDateString(raw) : asString(raw);
      });
      const matricula = asNumber(dados.cod_epr);
      if (!matricula) continue;
      await upsertColaborador({ matricula, dados });
      nColaboradores++;
    }
  } else {
    avisos.push('Aba "Colaboradores" não encontrada no arquivo — nenhum colaborador importado.');
  }

  return { tomadores: nTomadores, encargos: nEncargos, informativas: nInformativas, colaboradores: nColaboradores, avisos };
}
