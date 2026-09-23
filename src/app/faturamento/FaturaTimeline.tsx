import { listTimelineFaturas } from "@/lib/repo/faturasSalvas";

function fmtData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Timeline de todas as faturas salvas dessa competência, de todos os usuários — cada "Salvar
 * Fatura" vira uma entrada aqui, nunca apaga a de outro usuário (ver faturasSalvas.ts). As
 * entradas de outros usuários aparecem, mas fecham: são só histórico/referência, não afetam o
 * que o usuário atual vê ou calcula (ver getFaturaSalvaDoUsuario).
 */
export async function FaturaTimeline({ competencia, usuarioEmail }: { competencia: string; usuarioEmail: string | null }) {
  const timeline = await listTimelineFaturas(competencia);
  if (timeline.length === 0) return null;

  // A entrada mais recente de cada usuário é a "ativa" dele (se não tiver sido descartada) — as
  // demais são só histórico, sem efeito em ninguém mais.
  const maisRecentePorUsuario = new Map<string, string>();
  for (const f of timeline) {
    if (!maisRecentePorUsuario.has(f.usuarioEmail)) maisRecentePorUsuario.set(f.usuarioEmail, f.id);
  }

  return (
    <details className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-700">
      <summary className="cursor-pointer font-medium text-neutral-800">Timeline de faturas salvas nessa competência ({timeline.length})</summary>
      <ul className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3">
        {timeline.map((f) => {
          const éMinha = f.usuarioEmail === usuarioEmail;
          const éAtiva = !f.descartada && maisRecentePorUsuario.get(f.usuarioEmail) === f.id;
          return (
            <li key={f.id} className={`flex flex-wrap items-center gap-2 rounded-md px-2.5 py-1.5 ${éMinha ? "bg-emerald-50" : "bg-neutral-50"}`}>
              <span className="font-medium text-neutral-800">{f.usuarioNome}</span>
              {éMinha && <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-700">você</span>}
              <span className="text-neutral-500">salvou em {fmtData(f.salvoEm)}</span>
              {éAtiva ? (
                <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-800">
                  {éMinha ? "sua versão ativa" : "ativa — fechada, só quem salvou vê"}
                </span>
              ) : (
                <span className="ml-auto rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-600">
                  {f.descartada ? "descartada" : "substituída"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
