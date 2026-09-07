"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cleanDatabaseAction, runDemoSeedAction } from "./actions";

export function SetupButtons() {
  const [isPending, startTransition] = useTransition();

  const handleClean = () => {
    if (window.confirm("CUIDADO: Isso apagará todas as reservas, times e pessoas! Quer mesmo continuar?")) {
      startTransition(async () => {
        try {
          const res = await cleanDatabaseAction();
          if (res.success) toast.success(res.message);
        } catch (error: any) {
          toast.error(error.message || "Erro ao limpar o banco");
        }
      });
    }
  };

  const handleSeed = () => {
    if (window.confirm("Isso irá gerar 20 times e lotar as quadras no próximo final de semana. Continuar?")) {
      startTransition(async () => {
        try {
          const res = await runDemoSeedAction();
          if (res.success) toast.success(res.message);
        } catch (error: any) {
          toast.error(error.message || "Erro ao rodar seed");
        }
      });
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
        <h3 className="text-xl font-semibold text-white mb-2">Limpar Dados</h3>
        <p className="text-sm text-slate-400 mb-6">
          Apaga todas as reservas, agendas e times. Mantém apenas Quadras, Admin e Teste.
        </p>
        <button 
          onClick={handleClean}
          disabled={isPending}
          className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors cursor-pointer"
        >
          {isPending ? "Processando..." : "Limpar Banco"}
        </button>
      </div>

      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
        <h3 className="text-xl font-semibold text-white mb-2">Popular Fim de Semana</h3>
        <p className="text-sm text-slate-400 mb-6">
          Preenche o próximo sábado e domingo com times e usuários gerados na hora.
        </p>
        <button 
          onClick={handleSeed}
          disabled={isPending}
          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors cursor-pointer"
        >
          {isPending ? "Processando..." : "Rodar Seed"}
        </button>
      </div>
    </div>
  );
}
