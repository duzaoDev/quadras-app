import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SetupButtons } from "./SetupButtons";

export default async function SetupSecretoPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 flex items-center justify-center">
      <div className="max-w-2xl w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Painel de Setup (Dev)</h1>
          <p className="text-slate-400">
            Use essas ferramentas para limpar ou popular o banco de dados. 
            O usuário Admin e o Usuário Teste jamais serão apagados.
          </p>
        </div>
        <SetupButtons />
      </div>
    </div>
  );
}
