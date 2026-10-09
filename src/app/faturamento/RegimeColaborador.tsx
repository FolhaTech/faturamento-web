"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface TomadorOpcao {
  codigo: number;
  nome: string;
  fpas: 515 | 655;
  /** Taxa administrativa do Tomador como fração (0,12 = 12%) — mostrada no seletor pra ver na hora qual taxa o colaborador/centro de custo vai pagar. */
  taxaAdm: number;
  pendente: boolean;
}

function regimeLabel(fpas: 515 | 655): string {
  return fpas === 655 ? "Temporário" : "Terceiro (CLT)";
}

/** "GRUPO CHAMA DE DISTRIBUICAO LTDA — Temporário · taxa adm 12% (cód. 36)" — texto de cada Tomador nos seletores. */
export function descricaoTomador(t: TomadorOpcao): string {
  const taxa = `${(t.taxaAdm * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  return `${t.nome} — ${regimeLabel(t.fpas)} · taxa adm ${taxa} (cód. ${t.codigo})${t.pendente ? " · pendente" : ""}`;
}

/**
 * Seletor de regime do colaborador no detalhamento do Faturamento. O regime vem do Tomador dele
 * (FPAS 655 = Temporário, 515 = Terceiro), então cada opção é um Tomador mostrado com o regime —
 * escolher troca o Cód Serviço do colaborador sem precisar digitar o número no cadastro (ver
 * /api/colaboradores/[matricula]/tomador).
 */
export function RegimeColaborador({ matricula, codServicoAtual, tomadores }: { matricula: number; codServicoAtual: number | null; tomadores: TomadorOpcao[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const atualCadastrado = tomadores.some((t) => t.codigo === codServicoAtual);
  const ordenados = [...tomadores].sort((a, b) => a.nome.localeCompare(b.nome) || a.fpas - b.fpas || a.codigo - b.codigo);

  async function trocar(codServico: number) {
    setErro(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/colaboradores/${matricula}/tomador`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codServico }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.error ?? "Falha ao salvar.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
        Regime do colaborador (Tomador)
        <select
          value={codServicoAtual ?? ""}
          disabled={busy}
          onChange={(e) => trocar(Number(e.target.value))}
          className="max-w-md rounded-md border border-neutral-300 px-2 py-1.5 text-sm font-normal text-neutral-900 disabled:bg-neutral-100"
        >
          {codServicoAtual == null && <option value="">— sem Tomador —</option>}
          {codServicoAtual != null && !atualCadastrado && <option value={codServicoAtual}>Tomador cód. {codServicoAtual} (não cadastrado)</option>}
          {ordenados.map((t) => (
            <option key={t.codigo} value={t.codigo}>
              {descricaoTomador(t)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-neutral-500">
        Muda o regime (FPAS), a taxa administrativa e o gross-up da fatura desse colaborador. Se a fatura dessa competência já foi salva, descarte-a ou
        salve uma nova versão pra ver a mudança.
      </p>
      {erro && <span className="text-xs text-red-700">{erro}</span>}
    </div>
  );
}
