'use client'

import { useEffect, useState, useMemo } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Plus, Trash2, CalendarPlus, Clock, Loader2, X, ChevronDown, ShieldAlert } from 'lucide-react'
import Link from 'next/link'

type Quadra = {
  id: string
  nome: string
  ativa?: boolean
  modalidade: { id: string; nome: string }
}


type Agenda = {
  id: string
  data: string
  quadraId: string
  horarios: string[]
}

type ResumoItem = {
  id: string
  data: string
  quadraId: string
  quadra: {
    nome: string
    modalidade?: { nome: string }
  }
  horarios: string[]
}

function formatarDataLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getWeekRangeText(dateStr: string) {
  if (!dateStr) return 'Selecione uma data para conferir o período de referência.';
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setUTCDate(diff);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);

  const fmt = (date: Date) => date.toLocaleDateString('pt-BR');
  return `🗓️ Período correspondente: ${fmt(mon)} até ${fmt(sun)} (Seg a Dom)`;
}

const SLOTS_PADRAO = [
  '06:00-08:00', '08:00-10:00', '10:00-12:00', '12:00-14:00',
  '14:00-16:00', '16:00-18:00', '18:00-20:00', '20:00-21:45',
]

const SLOTS_TENIS = [
  '06:00-07:00', '07:00-08:00', '08:00-09:00', '09:00-10:00',
  '10:00-11:00', '11:00-12:00', '12:00-13:00', '13:00-14:00',
  '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00',
  '18:00-19:00', '19:00-20:00', '20:00-21:00', '21:00-21:45',
]

const SLOTS_FUTEBOL_SAB = [
  '09:00-11:00', '14:00-16:00', '16:00-18:00'
]

const SLOTS_FUTEBOL_DOM = [
  '08:00-10:00', '10:00-12:00', '15:00-17:00'
]

export default function AdminCalendarioPage() {
  const [quadras, setQuadras] = useState<Quadra[]>([])
  const [quadraId, setQuadraId] = useState('')
  const [dataSelecionada, setDataSelecionada] = useState<Date | undefined>(new Date())
  const [agendas, setAgendas] = useState<Agenda[]>([])
  
  const [isFetchingAgendas, setIsFetchingAgendas] = useState(false)
  const [isFetchingResumo, setIsFetchingResumo] = useState(false)
  const [horariosEditando, setHorariosEditando] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const [novoSlot, setNovoSlot] = useState('')

  // UI States
  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean, modalidade?: string, quadraId?: string }>({ isOpen: false })
  const [loteDataBase, setLoteDataBase] = useState('')
  const [loteTemFeriado, setLoteTemFeriado] = useState(false)
  const [loteFeriadoData, setLoteFeriadoData] = useState('')
  const [loteSalvando, setLoteSalvando] = useState(false)

  const [resumo, setResumo] = useState<ResumoItem[]>([])

  const quadraSelecionada = quadras.find(q => q.id === quadraId)
  const ehTenis = quadraSelecionada?.modalidade.nome === 'Tênis'
  const ehFutebol = quadraSelecionada?.modalidade.nome === 'Futebol'

  const agendaDoDia = useMemo(() => {
    if (!dataSelecionada || !quadraId) return null
    const str = formatarDataLocal(dataSelecionada)
    return agendas.find(a => a.data.split('T')[0] === str) || null
  }, [dataSelecionada, quadraId, agendas])

  const isSemanaAberta = useMemo(() => {
    if (!loteDataBase || resumo.length === 0) return false
    const d = new Date(loteDataBase + 'T12:00:00Z')
    const day = d.getUTCDay()
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1)
    const mon = new Date(d)
    mon.setUTCDate(diff)
    const sun = new Date(mon)
    sun.setUTCDate(mon.getUTCDate() + 6)
    
    return resumo.some(item => {
      const itemDate = new Date(item.data.split('T')[0] + 'T12:00:00Z')
      return itemDate >= mon && itemDate <= sun
    })
  }, [loteDataBase, resumo])

  useEffect(() => {
    let ignore = false
    async function carregarQuadras() {
      const res = await fetch('/api/admin/quadras')
      if (res.ok && !ignore) {
        const data: Quadra[] = await res.json()
        const ativas = data.filter((q: Quadra) => q.ativa !== false)
        setQuadras(ativas)
        if (ativas.length > 0) setQuadraId(prev => prev || ativas[0].id)
      }
    }
    carregarQuadras()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!quadraId) return
    const controller = new AbortController()
    async function carregar() {
      setIsFetchingAgendas(true)
      try {
        const res = await fetch(`/api/agenda?quadraId=${quadraId}&t=${Date.now()}`, { signal: controller.signal })
        if (res.ok) {
          const data: Agenda[] = await res.json()
          setAgendas(data)
          if (dataSelecionada) {
            const str = formatarDataLocal(dataSelecionada)
            const enc = data.find(a => a.data.split('T')[0] === str)
            setHorariosEditando(enc?.horarios || [])
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') console.error(err)
      } finally {
        setIsFetchingAgendas(false)
      }
    }
    carregar()
    return () => controller.abort()
  }, [quadraId, dataSelecionada])

  useEffect(() => {
    const controller = new AbortController()
    async function carregar() {
      setIsFetchingResumo(true)
      try {
        const res = await fetch(`/api/admin/agenda/resumo?t=${Date.now()}`, { signal: controller.signal })
        if (res.ok) {
          setResumo(await res.json())
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') console.error(err)
      } finally {
        setIsFetchingResumo(false)
      }
    }
    carregar()
    return () => controller.abort()
  }, [])

  async function carregarAgendas() {
    if (!quadraId) return
    setIsFetchingAgendas(true)
    try {
      const res = await fetch(`/api/agenda?quadraId=${quadraId}&t=${Date.now()}`)
      if (res.ok) {
        const data: Agenda[] = await res.json()
        setAgendas(data)
        if (dataSelecionada) {
          const str = formatarDataLocal(dataSelecionada)
          const enc = data.find(a => a.data.split('T')[0] === str)
          setHorariosEditando(enc?.horarios || [])
        }
      }
    } finally {
      setIsFetchingAgendas(false)
    }
  }

  async function carregarResumo() {
    setIsFetchingResumo(true)
    try {
      const res = await fetch(`/api/admin/agenda/resumo?t=${Date.now()}`)
      if (res.ok) {
        setResumo(await res.json())
      }
    } finally {
      setIsFetchingResumo(false)
    }
  }

  async function salvarAgenda() {
    if (!dataSelecionada || !quadraId) return
    if (horariosEditando.length === 0) {
      toast.error('Adicione pelo menos um horário.')
      return
    }

    setSalvando(true)
    const dataFormatada = formatarDataLocal(dataSelecionada)

    const res = await fetch('/api/admin/agenda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: dataFormatada,
        quadraId,
        horarios: horariosEditando.sort(),
      }),
    })

    setSalvando(false)

    if (res.ok) {
      toast.success(agendaDoDia ? 'Agenda atualizada!' : 'Dia aberto com sucesso!')
      carregarAgendas()
      carregarResumo()
    } else {
      const err = await res.json()
      toast.error(err.error || 'Erro ao salvar agenda.')
    }
  }

  async function removerAgenda() {
    if (!agendaDoDia) return

    if (!confirm('Tem certeza que deseja fechar este dia? Os horários serão removidos.')) return

    const res = await fetch(`/api/admin/agenda?id=${agendaDoDia.id}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      toast.success('Dia fechado com sucesso!')
      carregarAgendas()
      carregarResumo()
    } else {
      toast.error('Erro ao fechar dia.')
    }
  }

  function preencherPadrao() {
    if (ehFutebol && dataSelecionada) {
      const day = dataSelecionada.getDay()
      if (day === 6) {
        setHorariosEditando([...SLOTS_FUTEBOL_SAB])
        return
      } else if (day === 0) {
        setHorariosEditando([...SLOTS_FUTEBOL_DOM])
        return
      }
    }
    setHorariosEditando(ehTenis ? [...SLOTS_TENIS] : [...SLOTS_PADRAO])
  }

  function toggleSlot(slot: string) {
    setHorariosEditando(prev =>
      prev.includes(slot)
        ? prev.filter(s => s !== slot)
        : [...prev, slot].sort()
    )
  }

  function adicionarSlotCustom() {
    const regex = /^\d{2}:\d{2}-\d{2}:\d{2}$/
    if (!regex.test(novoSlot)) {
      toast.error('Use o formato HH:MM-HH:MM (ex: 07:00-09:00)')
      return
    }
    if (horariosEditando.includes(novoSlot)) {
      toast.error('Esse horário já está na lista.')
      return
    }
    setHorariosEditando(prev => [...prev, novoSlot].sort())
    setNovoSlot('')
  }

  async function liberarEmLote() {
    if (!loteDataBase) {
      toast.error('Selecione uma data base para a semana.')
      return
    }
    if (loteTemFeriado && !loteFeriadoData) {
      toast.error('Selecione a data do feriado.')
      return
    }

    setLoteSalvando(true)
    const res = await fetch('/api/admin/agenda/lote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataBase: loteDataBase,
        feriadoData: loteTemFeriado ? loteFeriadoData : undefined,
      }),
    })
    setLoteSalvando(false)

    if (res.ok) {
      const { agendasAfetadas } = await res.json()
      toast.success(`Lote concluído! ${agendasAfetadas} dia(s)/quadra(s) afetado(s).`)
      setLoteDataBase('')
      setLoteFeriadoData('')
      setLoteTemFeriado(false)
      carregarAgendas()
      carregarResumo()
    } else {
      const err = await res.json()
      toast.error(err.error || 'Erro ao liberar em lote.')
    }
  }

  async function fecharEmLote() {
    if (!loteDataBase) {
      toast.error('Selecione uma data base para a semana.')
      return
    }

    if (!confirm('Tem certeza que deseja LIMPAR TODA A SEMANA (Segunda a Domingo) para TODAS as quadras?')) {
      return
    }

    setLoteSalvando(true)
    const res = await fetch('/api/admin/agenda/lote', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataBase: loteDataBase,
      }),
    })
    setLoteSalvando(false)

    if (res.ok) {
      const { agendasAfetadas } = await res.json()
      toast.success(`Semana limpa! ${agendasAfetadas} registro(s) apagado(s).`)
      setLoteDataBase('')
      setLoteFeriadoData('')
      setLoteTemFeriado(false)
      carregarAgendas()
      carregarResumo()
    } else {
      const err = await res.json()
      toast.error(err.error || 'Erro ao fechar em lote.')
    }
  }

  const datasComAgenda = agendas.map(a => a.data.split('T')[0])

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Liberação de horários</h1>
          <p className="text-slate-500 mt-1">Módulo oficial para administração da grade de horários e liberação de quadras públicas.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 md:p-6 lg:p-8">
        <h2 className="text-xl font-bold text-slate-800 mb-6">Abertura Padrão (em lotes)</h2>
        <div className="flex flex-col gap-5">

          <div className="bg-slate-50 border border-slate-200 p-4 md:p-6 rounded-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-start">
              {/* Seleção de Data Base */}
              <div className="min-w-0 w-full">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Primeiro dia da semana</label>
                <input
                  type="date"
                  value={loteDataBase}
                  onChange={e => setLoteDataBase(e.target.value)}
                  className="w-full max-w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#004B87] text-slate-800 bg-white shadow-sm"
                />
                <p className="text-xs text-[#004B87] font-semibold mt-2.5 min-h-[16px] break-words">
                  {getWeekRangeText(loteDataBase)}
                </p>
              </div>

              {/* Feriado */}
              <div className="min-w-0 w-full">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Opções Adicionais</label>

                {!loteTemFeriado ? (
                  <label className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">
                    <input
                      type="checkbox"
                      checked={loteTemFeriado}
                      onChange={(e) => setLoteTemFeriado(e.target.checked)}
                      className="w-5 h-5 text-[#009A44] rounded focus:ring-[#009A44] cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-slate-700">Semana com feriado</span>
                  </label>
                ) : (
                  <div className="flex gap-2">
                    <label className="flex items-center justify-center px-4 py-3 rounded-xl border border-[#009A44] bg-emerald-50 cursor-pointer shadow-sm shrink-0">
                      <input
                        type="checkbox"
                        checked={loteTemFeriado}
                        onChange={(e) => setLoteTemFeriado(e.target.checked)}
                        className="w-5 h-5 text-[#009A44] rounded focus:ring-[#009A44] cursor-pointer"
                      />
                    </label>
                    <input
                      type="date"
                      value={loteFeriadoData}
                      onChange={e => setLoteFeriadoData(e.target.value)}
                      className="flex-1 max-w-full min-w-0 px-4 py-3 rounded-xl border border-[#009A44] focus:outline-none focus:ring-2 focus:ring-[#009A44] text-slate-800 bg-white shadow-sm w-full"
                    />
                  </div>
                )}

                <p className="text-xs text-slate-500 italic mt-2.5 min-h-[16px]">
                  {loteTemFeriado
                    ? "Selecione a data exata do feriado."
                    : "Autoriza a abertura de grade excepcional em dia útil."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 mt-2">
            <button
              onClick={liberarEmLote}
              disabled={loteSalvando || !loteDataBase || isSemanaAberta}
              className="flex justify-center items-center gap-2 bg-[#009A44] hover:bg-[#008A3D] disabled:bg-slate-400 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-sm flex-1"
            >
              {loteSalvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarPlus className="w-5 h-5" />}
              <span className="truncate">{loteTemFeriado ? 'Abrir com Feriado' : 'Abrir Semana'}</span>
            </button>

            <button
              onClick={fecharEmLote}
              disabled={loteSalvando || !loteDataBase || resumo.length === 0}
              className="flex justify-center items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-sm flex-1"
            >
              {loteSalvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
              <span className="truncate">Fechar Semana</span>
            </button>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:ml-auto">
              <button
                onClick={() => setModalConfig({ isOpen: true })}
                className="flex justify-center items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-6 py-3 rounded-xl font-bold transition-colors shadow-sm w-full sm:w-auto"
              >
                Ajustes Manuais
              </button>
              
              <Link 
                href="/admin/reservas/nova-interna"
                className="flex justify-center items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-sm w-full sm:w-auto"
              >
                <ShieldAlert className="w-5 h-5" />
                Nova Reserva Interna
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Visão Geral (Confirmação Visual) */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-6 lg:p-8 relative">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-3">
          Painel de Controle - Datas Vigentes
          {isFetchingResumo && <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />}
        </h3>
        {resumo.length === 0 ? (
          <p className="text-sm text-slate-500 bg-white p-4 rounded-xl border border-slate-100">Não constam registros de liberação no calendário futuro.</p>
        ) : (
          <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 transition-opacity duration-300 ${isFetchingResumo ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
            {Object.entries(
              resumo.reduce((acc, item) => {
                const str = item.data.split('T')[0]
                if (!acc[str]) acc[str] = []
                acc[str].push(item)
                return acc
              }, {} as Record<string, ResumoItem[]>)
            ).map(([dataStr, items]) => {
              const d = new Date(dataStr + 'T12:00:00Z') // Forçar UTC noon para renderizar dia correto
              return (
                <div key={dataStr} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-[#009A44] border-b border-emerald-100 pb-2 mb-3 capitalize">
                    {d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </h4>
                  <div className="space-y-4">
                    {Object.entries(
                      items.reduce((accMod, item) => {
                        const mod = item.quadra.modalidade?.nome || 'Outros'
                        if (!accMod[mod]) accMod[mod] = []
                        accMod[mod].push(item)
                        return accMod
                      }, {} as Record<string, ResumoItem[]>)
                    ).map(([mod, modItems]) => (
                      <details key={mod} className="group">
                        <summary className="list-none flex items-center justify-between mb-2 select-none">
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              setQuadraId(modItems[0].quadraId)
                              setDataSelecionada(new Date(dataStr + 'T12:00:00Z'))
                              setModalConfig({ isOpen: true, modalidade: mod })
                            }}
                            className="text-xs font-bold text-slate-500 hover:text-emerald-600 uppercase tracking-wider transition-colors text-left"
                            title={`Gerenciar todas as quadras de ${mod}`}
                          >
                            {mod}
                          </button>
                          <div className="flex items-center cursor-pointer text-slate-400 hover:text-slate-600 px-2">
                            <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                          </div>
                        </summary>
                        <ul className="space-y-0.5 text-sm text-slate-700 font-medium pb-3 border-l-2 border-slate-100 ml-1 pl-2">
                          {modItems.sort((a, b) => a.quadra.nome.localeCompare(b.quadra.nome, undefined, { numeric: true })).map(i => (
                            <li key={i.id}>
                              <button
                                onClick={() => {
                                  setQuadraId(i.quadraId)
                                  setDataSelecionada(new Date(dataStr + 'T12:00:00Z'))
                                  setModalConfig({ isOpen: true, quadraId: i.quadraId })
                                }}
                                className="flex items-center justify-between w-full hover:bg-emerald-50 px-2 py-1.5 rounded transition-colors text-left group/item"
                              >
                                <span className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover/item:bg-[#009A44] transition-colors" />
                                  {i.quadra.nome}
                                </span>
                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-bold group-hover/item:bg-emerald-100 group-hover/item:text-emerald-700 transition-colors">
                                  {i.horarios.length} horários
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL: Ajustes Manuais */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-50 w-full max-w-6xl max-h-[95vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

            {/* Header do Modal */}
            <div className="bg-white px-6 py-5 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Ajustes Manuais</h2>
                <p className="text-sm text-slate-500">
                  {modalConfig.quadraId
                    ? 'Foco: Quadra Específica'
                    : 'Foco: Por Modalidade'}
                </p>
              </div>
              <button
                onClick={() => setModalConfig({ isOpen: false })}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Corpo do Modal com Scroll */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
              
              {/* Navegação por Modalidades (se não estiver forçando uma quadra específica) */}
              {!modalConfig.quadraId && quadras.length > 0 && (
                <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
                  {Array.from(new Set(quadras.map(q => q.modalidade.nome))).sort().map(mod => {
                    const activeMod = modalConfig.modalidade || Array.from(new Set(quadras.map(q => q.modalidade.nome))).sort()[0]
                    const isActive = activeMod === mod
                    
                    return (
                      <button
                        key={mod}
                        onClick={() => {
                          setModalConfig({ ...modalConfig, modalidade: mod })
                          setQuadraId('') // Reseta a quadra selecionada ao trocar de aba
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                          isActive
                            ? 'bg-slate-800 text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {mod}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Seleção de Quadra Filtrada */}
              <div className="flex flex-wrap gap-3">
                {quadras.filter(q => {
                  if (modalConfig.quadraId) return q.id === modalConfig.quadraId
                  const activeMod = modalConfig.modalidade || Array.from(new Set(quadras.map(q => q.modalidade.nome))).sort()[0]
                  return q.modalidade.nome === activeMod
                }).sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true })).map((q) => (
                  <button
                    key={q.id}
                    onClick={() => setQuadraId(q.id)}
                    className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${quadraId === q.id
                        ? 'bg-[#009A44] text-white shadow-md'
                        : 'bg-white text-slate-700 border border-slate-200 hover:border-[#009A44] hover:text-[#009A44]'
                      }`}
                  >
                    {q.nome}
                  </button>
                ))}
                {quadras.length === 0 && (
                  <p className="text-slate-400 text-sm">Nenhuma quadra cadastrada. Cadastre uma quadra primeiro.</p>
                )}
              </div>

              {quadraId && (
                <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
                  {/* Calendário */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-900 text-white p-5">
                      <h2 className="text-lg font-semibold">Consulta de Datas</h2>
                      <p className="text-slate-300 text-sm mt-1">Datas com grade de horários ativas estão destacadas.</p>
                    </div>
                    <div className="p-6 flex justify-center">
                      <Calendar
                        locale={ptBR}
                        mode="single"
                        selected={dataSelecionada}
                        onSelect={setDataSelecionada}
                        className="rounded-xl border border-slate-100 shadow-sm p-4 bg-white"
                        modifiers={{
                          agendaAberta: (date) => {
                            const str = formatarDataLocal(date)
                            return datasComAgenda.includes(str)
                          },
                        }}
                        modifiersClassNames={{
                          agendaAberta: 'bg-emerald-100 text-emerald-800 font-bold',
                        }}
                      />
                    </div>
                    <div className="px-6 pb-6">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="w-3 h-3 rounded-full bg-emerald-200 border border-emerald-400" />
                        Data vigente (horários disponíveis ao público)
                      </div>
                    </div>
                  </div>

                  {/* Editor de Horários */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full">
                    <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-bold text-slate-800">
                          {dataSelecionada
                            ? dataSelecionada.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                            : 'Selecione uma data'}
                        </h2>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {agendaDoDia ? '✅ Status: Ativo — Editando grade horária' : '🔒 Status: Inativo — Necessário inserir grade para ativação'}
                        </p>
                      </div>

                      {agendaDoDia && (
                        <button
                          onClick={removerAgenda}
                          className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Suspender Operação
                        </button>
                      )}
                    </div>

                    <div className="p-6 space-y-6 flex-1 flex flex-col">
                      {/* Quick Actions */}
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={preencherPadrao}
                          className="flex items-center gap-2 text-sm font-semibold text-[#004B87] bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-xl transition-colors"
                        >
                          <CalendarPlus className="w-4 h-4" />
                          Aplicar Grade Padrão {ehTenis ? '(Tênis 1h)' : ehFutebol ? '(Futebol)' : '(2h)'}
                        </button>

                        <button
                          onClick={() => setHorariosEditando([])}
                          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 rounded-xl transition-colors"
                        >
                          Remover Grade
                        </button>
                      </div>

                      {/* Toggle de Slots */}
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Grade Horária ({horariosEditando.length} períodos definidos)
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                          {(ehTenis ? SLOTS_TENIS : ehFutebol ? (dataSelecionada?.getDay() === 6 ? SLOTS_FUTEBOL_SAB : dataSelecionada?.getDay() === 0 ? SLOTS_FUTEBOL_DOM : SLOTS_PADRAO) : SLOTS_PADRAO).map((slot) => {
                            const ativo = horariosEditando.includes(slot)
                            return (
                              <button
                                key={slot}
                                onClick={() => toggleSlot(slot)}
                                className={`px-3 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${ativo
                                    ? 'border-[#009A44] bg-emerald-50 text-emerald-800'
                                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                  }`}
                              >
                                {slot}
                              </button>
                            )
                          })}
                        </div>

                        {/* Slot customizado */}
                        <div className="flex gap-2 items-end mt-6">
                          <div className="flex-1">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                              Inserir período excepcional
                            </label>
                            <input
                              type="text"
                              placeholder="Ex: 07:00-09:00"
                              value={novoSlot}
                              onChange={(e) => setNovoSlot(e.target.value)}
                              className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#004B87] focus:border-transparent"
                            />
                          </div>
                          <button
                            onClick={adicionarSlotCustom}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Horários Selecionados que não são padrão */}
                        {horariosEditando.filter(h => !(ehTenis ? SLOTS_TENIS : ehFutebol ? [...SLOTS_FUTEBOL_SAB, ...SLOTS_FUTEBOL_DOM, ...SLOTS_PADRAO] : SLOTS_PADRAO).includes(h)).length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Períodos excepcionais inseridos</h4>
                            <div className="flex flex-wrap gap-2">
                              {horariosEditando.filter(h => !(ehTenis ? SLOTS_TENIS : ehFutebol ? [...SLOTS_FUTEBOL_SAB, ...SLOTS_FUTEBOL_DOM, ...SLOTS_PADRAO] : SLOTS_PADRAO).includes(h)).map(slot => (
                                <span key={slot} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 text-sm font-semibold border border-violet-200">
                                  {slot}
                                  <button onClick={() => toggleSlot(slot)} className="hover:text-red-600">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Botão Salvar (Fixo embaixo) */}
                      <div className="pt-4 mt-auto">
                        <button
                          onClick={salvarAgenda}
                          disabled={salvando || horariosEditando.length === 0}
                          className="w-full flex items-center justify-center gap-2 bg-[#009A44] hover:bg-[#008A3D] disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl text-base transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                        >
                          {salvando ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <CalendarPlus className="w-5 h-5" />
                          )}
                          {salvando ? 'Processando...' : agendaDoDia ? 'Confirmar Alterações' : 'Ativar Data'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
