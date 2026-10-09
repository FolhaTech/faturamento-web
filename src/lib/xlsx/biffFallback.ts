import * as XLSX from "xlsx";
import type { CellValue } from "./grid";

/**
 * Leitor de reserva para .xls (BIFF8) que a biblioteca de planilhas lê com a aba VAZIA.
 *
 * O arquivo "Empregados em Excel" exportado pelo sistema de folha tem o ponteiro da aba (BoundSheet8) apontando
 * para um byte que não é o início da aba, e a biblioteca devolve o nome da aba sem nenhuma célula. Os dados estão
 * lá (quase tudo texto, em LABELSST), então aqui as abas são localizadas pelos próprios marcadores de início
 * (BOF de worksheet) e as células lidas direto: texto compartilhado (SST + CONTINUE), números e RK.
 * Só é usado quando a leitura normal não trouxe conteúdo — ver readWorkbookGrid em grid.ts.
 */

const REC_SST = 0x00fc;
const REC_CONTINUE = 0x003c;
const REC_BOF = 0x0809;
const REC_EOF = 0x000a;
const REC_LABELSST = 0x00fd;
const REC_LABEL = 0x0204;
const REC_NUMBER = 0x0203;
const REC_RK = 0x027e;
const REC_MULRK = 0x00bd;
const BOF_WORKSHEET = 0x0010;

export function pareceContainerOle(buffer: Buffer): boolean {
  return buffer.length > 8 && buffer.readUInt32BE(0) === 0xd0cf11e0 && buffer.readUInt32BE(4) === 0xa1b11ae1;
}

/** Leitor de bytes do SST: a lista de strings pode atravessar os registros CONTINUE, que repetem o byte de codificação. */
class LeitorSst {
  private seg = 0;
  private pos = 0;
  constructor(private readonly segmentos: Buffer[]) {}

  private proximoSegmentoSePreciso(): boolean {
    while (this.seg < this.segmentos.length && this.pos >= this.segmentos[this.seg].length) {
      this.seg++;
      this.pos = 0;
    }
    return this.seg < this.segmentos.length;
  }

  temMais(): boolean {
    return this.proximoSegmentoSePreciso();
  }

  pular(n: number): void {
    while (n > 0 && this.proximoSegmentoSePreciso()) {
      const take = Math.min(n, this.segmentos[this.seg].length - this.pos);
      this.pos += take;
      n -= take;
    }
  }

  private u8(): number {
    this.proximoSegmentoSePreciso();
    return this.segmentos[this.seg][this.pos++];
  }

  private u16(): number {
    const lo = this.u8();
    return lo | (this.u8() << 8);
  }

  private u32(): number {
    const lo = this.u16();
    return (lo | (this.u16() << 16)) >>> 0;
  }

  /** Uma XLUnicodeRichExtendedString. */
  lerString(): string {
    const cch = this.u16();
    const flags = this.u8();
    const rico = (flags & 0x08) !== 0;
    const ext = (flags & 0x04) !== 0;
    let alto = (flags & 0x01) !== 0;
    const runs = rico ? this.u16() : 0;
    const bytesExt = ext ? this.u32() : 0;

    let texto = "";
    let restantes = cch;
    while (restantes > 0 && this.seg < this.segmentos.length) {
      if (this.pos >= this.segmentos[this.seg].length) {
        // Continuação do texto num CONTINUE: o primeiro byte do novo registro diz de novo se é 1 ou 2 bytes por letra.
        this.seg++;
        this.pos = 0;
        if (this.seg >= this.segmentos.length) break;
        alto = (this.segmentos[this.seg][this.pos++] & 0x01) !== 0;
        continue;
      }
      const seg = this.segmentos[this.seg];
      const porLetra = alto ? 2 : 1;
      const cabem = Math.floor((seg.length - this.pos) / porLetra);
      const take = Math.min(cabem, restantes);
      if (take <= 0) {
        this.pos = seg.length;
        continue;
      }
      texto += alto ? seg.toString("utf16le", this.pos, this.pos + take * 2) : seg.toString("latin1", this.pos, this.pos + take);
      this.pos += take * porLetra;
      restantes -= take;
    }
    this.pular(runs * 4 + bytesExt);
    return texto;
  }
}

function decodificarRk(rk: number): number {
  const dividePor100 = (rk & 0x01) !== 0;
  let valor: number;
  if (rk & 0x02) {
    valor = rk >> 2; // inteiro de 30 bits com sinal
  } else {
    const b = Buffer.alloc(8);
    b.writeUInt32LE(0, 0);
    b.writeUInt32LE((rk & 0xfffffffc) >>> 0, 4);
    valor = b.readDoubleLE(0);
  }
  return dividePor100 ? valor / 100 : valor;
}

function lerStringSimples(dados: Buffer, offset: number): string {
  const cch = dados.readUInt16LE(offset);
  const flags = dados[offset + 2];
  return (flags & 0x01) !== 0 ? dados.toString("utf16le", offset + 3, offset + 3 + cch * 2) : dados.toString("latin1", offset + 3, offset + 3 + cch);
}

/**
 * Lê todas as abas de planilha (worksheets) de um .xls BIFF8 pela ordem em que aparecem, sem depender do ponteiro
 * do BoundSheet8. Devolve uma grade (linhas x colunas, 0-indexado, vazio = null) por aba, ou null quando o arquivo
 * não é um .xls legível desse jeito.
 */
export function lerAbasBiff8(buffer: Buffer): CellValue[][][] | null {
  if (!pareceContainerOle(buffer)) return null;
  let stream: Buffer;
  try {
    const cfb = XLSX.CFB.read(buffer, { type: "buffer" });
    const entrada = XLSX.CFB.find(cfb, "/Workbook") ?? XLSX.CFB.find(cfb, "/Book");
    if (!entrada?.content) return null;
    stream = Buffer.from(entrada.content as Uint8Array);
  } catch {
    return null;
  }

  const strings: string[] = [];
  const abas: Map<number, Map<number, CellValue>>[] = [];
  let aba: Map<number, Map<number, CellValue>> | null = null;
  let profundidade = 0;

  let off = 0;
  while (off + 4 <= stream.length) {
    const tipo = stream.readUInt16LE(off);
    const tamanho = stream.readUInt16LE(off + 2);
    const ini = off + 4;
    const fim = Math.min(ini + tamanho, stream.length);
    const dados = stream.subarray(ini, fim);
    off = ini + tamanho;

    if (tipo === REC_BOF) {
      profundidade++;
      if (dados.length >= 4 && dados.readUInt16LE(2) === BOF_WORKSHEET) {
        aba = new Map();
        abas.push(aba);
      }
      continue;
    }
    if (tipo === REC_EOF) {
      profundidade--;
      if (profundidade <= 0) {
        profundidade = 0;
        aba = null;
      }
      continue;
    }

    if (tipo === REC_SST) {
      const segmentos: Buffer[] = [dados.subarray(8)];
      // Junta os CONTINUE que vêm logo depois do SST.
      while (off + 4 <= stream.length && stream.readUInt16LE(off) === REC_CONTINUE) {
        const t = stream.readUInt16LE(off + 2);
        segmentos.push(stream.subarray(off + 4, Math.min(off + 4 + t, stream.length)));
        off += 4 + t;
      }
      const total = dados.length >= 8 ? dados.readUInt32LE(4) : 0;
      const leitor = new LeitorSst(segmentos);
      while (strings.length < total && leitor.temMais()) strings.push(leitor.lerString());
      continue;
    }

    if (!aba) continue;
    const celula = (r: number, c: number, v: CellValue) => {
      let linha = aba!.get(r);
      if (!linha) aba!.set(r, (linha = new Map()));
      linha.set(c, v);
    };

    if (tipo === REC_LABELSST && dados.length >= 10) {
      celula(dados.readUInt16LE(0), dados.readUInt16LE(2), strings[dados.readUInt32LE(6)] ?? null);
    } else if (tipo === REC_LABEL && dados.length >= 8) {
      celula(dados.readUInt16LE(0), dados.readUInt16LE(2), lerStringSimples(dados, 6));
    } else if (tipo === REC_NUMBER && dados.length >= 14) {
      celula(dados.readUInt16LE(0), dados.readUInt16LE(2), dados.readDoubleLE(6));
    } else if (tipo === REC_RK && dados.length >= 10) {
      celula(dados.readUInt16LE(0), dados.readUInt16LE(2), decodificarRk(dados.readUInt32LE(6)));
    } else if (tipo === REC_MULRK && dados.length >= 6) {
      const linha = dados.readUInt16LE(0);
      const colIni = dados.readUInt16LE(2);
      const n = Math.floor((dados.length - 6) / 6);
      for (let i = 0; i < n; i++) celula(linha, colIni + i, decodificarRk(dados.readUInt32LE(4 + i * 6 + 2)));
    }
  }

  if (abas.length === 0) return null;
  return abas.map((celulas) => {
    let maxLinha = -1;
    let maxCol = -1;
    for (const [r, linha] of celulas) {
      maxLinha = Math.max(maxLinha, r);
      for (const c of linha.keys()) maxCol = Math.max(maxCol, c);
    }
    const grade: CellValue[][] = [];
    for (let r = 0; r <= maxLinha; r++) {
      const linha = celulas.get(r);
      const out: CellValue[] = new Array(maxCol + 1).fill(null);
      if (linha) for (const [c, v] of linha) out[c] = v;
      grade.push(out);
    }
    return grade;
  });
}
