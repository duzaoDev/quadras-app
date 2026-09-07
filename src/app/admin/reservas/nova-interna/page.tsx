'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, CalendarDays, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDataCivilBR } from '@/lib/dateUtils'

type Quadra = {
  id: string
  nome: string
  modalidade: { nome: string }
}

export default function NovaReservaInternaPage() {
  const router = useRouter()
  
  const [quadras, setQuadras] = useState<Quadra[]>([])
  const [loadingQuadras, setLoadingQuadras] = useState(true)

  const [dataSelecionada, setDataSelecionada] = useState('')
  const [quadraId, setQuadraId] = useState('')
  const [motivo, setMotivo] = useState('')

  const [horarios, setHorarios] = useState<{ slot: string; disponivel: boolean }[]>([])
  const [buscandoHorarios, setBuscandoHorarios] = useState(false)
  
  const [horariosSelecionados, setHorariosSelecionados] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    async function fetchQuadras() {
      try {
        const res = await fetch('/api/admin/quadras')
        if (res.ok) {
          const data = await res.json()
          setQuadras(data)
        }
      } catch (err) {
        toast.error('Erro ao buscar quadras')
      } finally {
        setLoadingQuadras(false)
      }
    }
    fetchQuadras()
  }, [])

  useEffect(() => {
    async function buscarAgenda() {
      if (!quadraId || !dataSelecionada) {
        setHorarios([])
        setHorariosSelecionados([])
        return
      }

      setBuscandoHorarios(true)
      setHorarios([])
      setHorariosSelecionados([])

      try {
        const resAgenda = await fetch(`/api/agenda?quadraId=${quadraId}&dataInicio=${dataSelecionada}&dataFim=${dataSelecionada}`)
        if (!resAgenda.ok) throw new Error()
        const agendas = await resAgenda.json()
        
        if (agendas.length === 0) {
          toast.info('Não há agenda aberta para esta data.')
          return
        }

        const resReservas = await fetch(`/api/reservas?quadraId=${quadraId}&data=${dataSelecionada}`)
        if (!resReservas.ok) throw new Error()
        const reservasOcupadas = await resReservas.json()

        const horariosAgenda: string[] = agendas[0].horarios
        const slotsOcupados = reservasOcupadas.map((r: any) => r.slot)

        const lista = horariosAgenda.map(h => ({
          slot: h,
          disponivel: !slotsOcupados.includes(h)
        }))

        setHorarios(lista)
      } catch (err) {
        toast.error('Erro ao carregar horários')
      } finally {
        setBuscandoHorarios(false)
      }
    }

    buscarAgenda()
  }, [quadraId, dataSelecionada])

  const toggleSlot = (slot: string, disponivel: boolean) => {
    if (!disponivel) return
    if (horariosSelecionados.includes(slot)) {
      setHorariosSelecionados(prev => prev.filter(s => s !== slot))
    } else {
      setHorariosSelecionados(prev => [...prev, slot])
    }
  }

  const handleSalvar = async () => {
    if (!quadraId || !dataSelecionada || !motivo.trim() || horariosSelecionados.length === 0) return

    setSalvando(true)
    try {
      const res = await fetch('/api/admin/reservas/internas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quadraId,
          data: dataSelecionada,
          slots: horariosSelecionados,
          motivo: motivo.trim()
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao criar reserva')
      }

      toast.success('Reserva administrativa criada com sucesso!')
      router.push('/admin/calendario')
    } catch (err: any) {
      toast.error(err.message)
      setSalvando(false)
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h1 className="hidden md:block text-3xl font-bold text-slate-800">Nova Reserva Interna</h1>
          <p className="text-slate-500 mt-1">Reserve horários na agenda para eventos internos, aulas ou manutenção.</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/admin/calendario')} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Quadra / Local</label>
            <select
              value={quadraId}
              onChange={(e) => setQuadraId(e.target.value)}
              disabled={loadingQuadras}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white"
            >
              <option value="">Selecione um local...</option>
              {quadras.map(q => (
                <option key={q.id} value={q.id}>{q.nome} ({q.modalidade.nome})</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Data</label>
            <Input
              type="date"
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="rounded-xl border-slate-200 px-4 py-5"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Nome do Evento / Motivo</label>
          <Input
            placeholder="Ex: Torneio Municipal, Manutenção da Rede, etc."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="rounded-xl border-slate-200 px-4 py-5"
          />
          <p className="text-xs text-slate-500">Este motivo aparecerá na gestão de reservas.</p>
        </div>

        {dataSelecionada && quadraId && (
          <div className="pt-4 border-t border-slate-100">
            <label className="text-sm font-bold text-slate-700 mb-4 block flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Selecione os Horários
            </label>

            {buscandoHorarios ? (
              <div className="flex items-center text-slate-500 py-8 justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Carregando agenda...
              </div>
            ) : horarios.length === 0 ? (
              <div className="text-center py-8 text-slate-400 font-medium bg-slate-50 rounded-xl">
                Nenhum horário configurado para esta data.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {horarios.map(({ slot, disponivel }) => (
                  <button
                    key={slot}
                    disabled={!disponivel}
                    onClick={() => toggleSlot(slot, disponivel)}
                    className={`
                      py-3 px-2 rounded-xl text-sm font-bold border-2 transition-all
                      ${!disponivel ? 'bg-slate-100 text-slate-400 border-slate-100 cursor-not-allowed line-through' :
                        horariosSelecionados.includes(slot)
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                      }
                    `}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pt-6 flex flex-wrap sm:flex-nowrap justify-end gap-3">
          <Button variant="outline" onClick={() => router.push('/admin/calendario')} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={salvando || !quadraId || !dataSelecionada || !motivo.trim() || horariosSelecionados.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 w-full sm:w-auto"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar Reserva ({horariosSelecionados.length} horários)
          </Button>
        </div>
      </div>
    </div>
  )
}
