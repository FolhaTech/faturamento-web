"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ResumoAcumulado } from "@/lib/calc/acumuladoLiquido";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const SEM_RESUMO: ResumoAcumulado = { provisao: 0, desconto: 0, aLancar: 0 };

/** Desconto de aviso prévio lançado pra esse colaborador nessa competência (valor digitado na tela dele) e se está sendo cobrado na fatura. */
export interface AvisoPrevioColaborador {
  /** Valor do aviso prévio (positivo) — 0 quando nada foi lançado nessa competência. */
  valor: number;
  /** true = cobrado na fatura ("Sim"); false = guardado, mas fora da fatura ("Não"). */
  aplicado: boolean;
}

export const SEM_AVISO_PREVIO: AvisoPrevioColaborador = { valor: 0, aplicado: false };

export interface ProvisaoColaborador {
  matricula: number;
  /** Já tem desconto de Prov. Férias lançado nessa competência (= "Sim"). */
  aplicadoFerias: boolean;
  aplicado13: boolean;
  /** Subtotais da Rescisão (sem contar o desconto dessa competência) e o valor que vira desconto quando marcar "Sim". */
  ferias: ResumoAcumulado;
  decimoTerceiro: ResumoAcumulado;
  /** Aviso prévio lançado nessa competência (campo "Desconto de aviso prévio" da tela do colaborador). */
  avisoPrevio: AvisoPrevioColaborador;
}

/**
 * Três seletores Sim/Não no detalhamento do colaborador: Prov. Férias, Prov. 13º e Aviso prévio. "Sim" lança como
 * desconto desse colaborador nessa competência o Subtotal desconto da Rescisão (sem abater o Subtotal
 * provisão); "Não" tira esse desconto. No Aviso prévio o valor é o digitado na tela do colaborador: "Sim" cobra esse
 * valor na fatura e "Não" tira da fatura mas guarda o valor. Salva na hora ao trocar (ver /api/faturamento/desconto-provisao).
 */
export function DescontoProvisaoColaborador({ matricula, competencia, provisao }: { matricula: number; competencia: string; provisao: ProvisaoColaborador }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<{ ferias?: string; "13"?: string; aviso?: string }>({});

  async function definir(tipo: "ferias" | "13" | "aviso", aplicar: boolean) {
    setErro(null);
    setAvisos((a) => ({ ...a, [tipo]: undefined }));
    setBusy(true);
    try {
      const res = await fetch("/api/faturamento/desconto-provisao", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matricula, competencia, tipo, aplicar }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error ?? "Falha ao salvar.");
        return;
      }
      // "Sim" sem nada a lançar não grava desconto (valor 0) — avisa em vez de parecer que não funcionou.
      if (aplicar && !(data.valor > 0)) {
        setAvisos((a) => ({
          ...a,
          [tipo]:
            tipo === "aviso"
              ? "Nenhum aviso prévio lançado nessa competência: informe o valor no campo Desconto de aviso prévio da tela do colaborador."
              : "Nenhum desconto lançado: não há Subtotal desconto nem Subtotal provisão para esse colaborador.",
        }));
      }
      router.refresh();
    } catch {
      setErro("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div>
        <h4 className="text-sm font-semibold text-neutral-900">Desconto da provisão acumulada (Rescisão)</h4>
        <p className="text-xs text-neutral-500">
          <strong>Sim</strong> lança o valor a descontar (o <strong>Subtotal desconto</strong> da Rescisão, sem abater o Subtotal provisão) como desconto
          desse colaborador em {competencia}; <strong>Não</strong> tira o desconto. No <strong>Aviso prévio</strong>, o valor é o digitado na tela do
          colaborador: <strong>Sim</strong> cobra esse valor na fatura e <strong>Não</strong> tira da fatura (o valor fica guardado). Se a fatura dessa
          competência já foi salva, descarte-a ou salve uma nova versão pra ver a mudança.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Seletor
          rotulo="Prov. Férias"
          valor={provisao.aplicadoFerias}
          resumo={provisao.ferias}
          disabled={busy}
          aviso={avisos.ferias}
          onChange={(aplicar) => definir("ferias", aplicar)}
        />
        <Seletor
          rotulo="Prov. 13º"
          valor={provisao.aplicado13}
          resumo={provisao.decimoTerceiro}
          disabled={busy}
          aviso={avisos["13"]}
          onChange={(aplicar) => definir("13", aplicar)}
        />
        <SeletorAvisoPrevio
          matricula={matricula}
          competencia={competencia}
          aviso={provisao.avisoPrevio}
          disabled={busy}
          mensagem={avisos.aviso}
          onChange={(aplicar) => definir("aviso", aplicar)}
        />
      </div>
      {erro && <span className="text-xs text-red-700">{erro}</span>}
    </div>
  );
}

/**
 * Sim/Não do desconto de aviso prévio do colaborador nessa competência. O valor é o digitado na tela do colaborador (campo
 * "Desconto de aviso prévio"); aqui só se liga ("Sim": cobra na fatura) ou desliga ("Não": tira da fatura, o valor fica guardado).
 */
function SeletorAvisoPrevio({
  matricula,
  competencia,
  aviso,
  disabled,
  mensagem,
  onChange,
}: {
  matricula: number;
  competencia: string;
  aviso: AvisoPrevioColaborador;
  disabled: boolean;
  mensagem?: string;
  onChange: (aplicar: boolean) => void;
}) {
  const semValor = aviso.valor <= 0;
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
      <span>
        Aviso prévio — desconto a lançar: <span className="font-mono tabular-nums text-neutral-900">{currency.format(aviso.valor)}</span>
      </span>
      <span className="font-normal text-neutral-400">Valor digitado na tela do colaborador (Desconto de aviso prévio)</span>
      <select
        value={aviso.aplicado ? "1" : "0"}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "1")}
        className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm font-normal text-neutral-900 disabled:bg-neutral-100"
      >
        <option value="0">Não</option>
        <option value="1">Sim</option>
      </select>
      {mensagem ? (
        <span className="text-xs font-normal text-amber-700">{mensagem}</span>
      ) : semValor ? (
        <span className="text-xs font-normal text-amber-700">
          Nenhum aviso prévio lançado nessa competência.{" "}
          <Link href={`/colaboradores/${matricula}?competencia=${encodeURIComponent(competencia)}`} className="underline hover:text-amber-900">
            Informar o valor
          </Link>
        </span>
      ) : (
        !aviso.aplicado && <span className="text-xs font-normal text-neutral-500">Valor guardado, mas fora da fatura enquanto estiver em Não.</span>
      )}
    </label>
  );
}

function Seletor({
  rotulo,
  valor,
  resumo,
  disabled,
  aviso,
  onChange,
}: {
  rotulo: string;
  valor: boolean;
  resumo: ResumoAcumulado;
  disabled: boolean;
  aviso?: string;
  onChange: (aplicar: boolean) => void;
}) {
  // O seletor fica sempre liberado (só trava enquanto salva).
  const semValor = !valor && resumo.aLancar <= 0;
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
      <span>
        {rotulo} — desconto a lançar: <span className="font-mono tabular-nums text-neutral-900">{currency.format(resumo.aLancar)}</span>
      </span>
      <span className="font-normal text-neutral-400">
        Subtotal provisão {currency.format(resumo.provisao)} · Subtotal desconto {currency.format(resumo.desconto)}
      </span>
      <select
        value={valor ? "1" : "0"}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "1")}
        className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm font-normal text-neutral-900 disabled:bg-neutral-100"
      >
        <option value="0">Não</option>
        <option value="1">Sim</option>
      </select>
      {aviso ? (
        <span className="text-xs font-normal text-amber-700">{aviso}</span>
      ) : (
        semValor && (
          <span className="text-xs font-normal text-amber-700">
            Sem Subtotal desconto nem Subtotal provisão para descontar — as provisões vêm das Folhas já enviadas deste colaborador.
          </span>
        )
      )}
    </label>
  );
}
