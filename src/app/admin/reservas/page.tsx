'use client'

import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { XCircle, Filter, Loader2, Download, Printer, Mail, CalendarClock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDataCivilBR } from '@/lib/dateUtils'

type Quadra = {
  id: string
  nome: string
  modalidade: { nome: string }
}

type Reserva = {
  id: string
  data: string
  slot: string
  status: string
  user: { id: string; name: string; email: string }
  quadra: { id: string; nome: string; modalidade: { nome: string } }
  time?: {
    nome: string
    responsaveis: { pessoa: { nome: string; telefone: string; cpf?: string } }[]
  }
  operador?: { name: string }
  isAdminReserva?: boolean
  motivo?: string
}
function highlightCpf(cpfFormatado: string, searchFilter: string) {
  if (!searchFilter) return cpfFormatado;
  const searchDigits = searchFilter.replace(/\D/g, '');
  if (!searchDigits) return cpfFormatado;

  let matchCount = 0;
  const elements = [];

  for (let i = 0; i < cpfFormatado.length; i++) {
    const char = cpfFormatado[i];
    const isDigit = /\d/.test(char);
    
    if (matchCount < searchDigits.length) {
      elements.push(<strong key={i} className="font-black text-slate-900 bg-yellow-200/50 rounded-sm">{char}</strong>);
      if (isDigit) matchCount++;
    } else {
      elements.push(<span key={i}>{char}</span>);
    }
  }

  return <>{elements}</>;
}

export default function AdminReservasPage() {
  const [reservas, setReservas] = useState<Reserva[]>([])
  
  // Estados de carregamento refinados
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isFetching, setIsFetching] = useState(false)

  const [cancelando, setCancelando] = useState<string | null>(null)

  // Modal Cancelamento
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [reservaParaCancelar, setReservaParaCancelar] = useState<Reserva | null>(null)
  const [motivoCancelamento, setMotivoCancelamento] = useState('Condições climáticas (chuva, etc.)')
  const [motivoOutro, setMotivoOutro] = useState('')

  // Modal Mensagem
  const [mensagemModalOpen, setMensagemModalOpen] = useState(false)
  const [reservaSelecionada, setReservaSelecionada] = useState<Reserva | null>(null)
  const [mensagemTexto, setMensagemTexto] = useState('')
  const [enviandoMsg, setEnviandoMsg] = useState(false)

  // Modal Reagendamento
  const [reagendarModalOpen, setReagendarModalOpen] = useState(false)
  const [reservaParaReagendar, setReservaParaReagendar] = useState<Reserva | null>(null)
  const [reagendarData, setReagendarData] = useState('')
  const [reagendarSlot, setReagendarSlot] = useState('')
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<string[]>([])
  const [buscandoHorarios, setBuscandoHorarios] = useState(false)
  const [reagendando, setReagendando] = useState(false)

  // Filtros
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroModalidade, setFiltroModalidade] = useState('todas')
  const [filtroQuadra, setFiltroQuadra] = useState('todas')
  const [filtroStatus, setFiltroStatus] = useState('todas')
  const [filtroCpf, setFiltroCpf] = useState('')

  const [quadras, setQuadras] = useState<Quadra[]>([])
  const [modalidades, setModalidades] = useState<string[]>([])

  // 1. Carregar Dados de Filtro (Quadras e Modalidades)
  useEffect(() => {
    async function carregarFiltros() {
      const res = await fetch('/api/admin/quadras')
      if (res.ok) {
        const data: Quadra[] = await res.json()
        setQuadras(data)
        const mods = Array.from(new Set(data.map(q => q.modalidade.nome))).sort()
        setModalidades(mods)
      }
    }
    carregarFiltros()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal

    async function carregar() {
      setIsFetching(true)
      const params = new URLSearchParams()
      if (filtroDataInicio) params.set('dataInicio', filtroDataInicio)
      if (filtroDataFim) params.set('dataFim', filtroDataFim)
      if (filtroModalidade !== 'todas') params.set('modalidade', filtroModalidade)
      if (filtroQuadra !== 'todas') params.set('quadraId', filtroQuadra)
      if (filtroStatus !== 'todas') params.set('status', filtroStatus)
      if (filtroCpf) params.set('cpf', filtroCpf)

      try {
        const res = await fetch(`/api/admin/reservas?${params.toString()}`, { signal })
        if (res.ok) {
          const data = await res.json()
          setReservas(data)
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Erro ao buscar reservas:', err)
        }
      } finally {
        setIsFetching(false)
        setIsInitialLoad(false)
      }
    }
    carregar()
    
    return () => { controller.abort() }
  }, [filtroDataInicio, filtroDataFim, filtroModalidade, filtroQuadra, filtroStatus, filtroCpf])

  async function carregarReservasSilencioso() {
    setIsFetching(true)
    const params = new URLSearchParams()
    if (filtroDataInicio) params.set('dataInicio', filtroDataInicio)
    if (filtroDataFim) params.set('dataFim', filtroDataFim)
    if (filtroModalidade !== 'todas') params.set('modalidade', filtroModalidade)
    if (filtroQuadra !== 'todas') params.set('quadraId', filtroQuadra)
    if (filtroStatus !== 'todas') params.set('status', filtroStatus)
    if (filtroCpf) params.set('cpf', filtroCpf)

    try {
      const res = await fetch(`/api/admin/reservas?${params.toString()}`)
      if (res.ok) {
        setReservas(await res.json())
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsFetching(false)
    }
  }

  async function confirmarCancelamento() {
    if (!reservaParaCancelar) return
    
    let motivoFinal = motivoCancelamento
    if (motivoCancelamento === 'Outro') {
      if (!motivoOutro.trim()) {
        toast.error('Por favor, informe o motivo do cancelamento.')
        return
      }
      motivoFinal = motivoOutro.trim()
    }

    setCancelando(reservaParaCancelar.id)
    const res = await fetch('/api/admin/reservas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id: reservaParaCancelar.id, 
        status: 'CANCELADA_ADMIN',
        motivo: motivoFinal
      }),
    })
    setCancelando(null)

    if (res.ok) {
      toast.success('Reserva cancelada com sucesso e e-mail enviado!')
      setCancelModalOpen(false)
      setReservaParaCancelar(null)
      carregarReservasSilencioso()
    } else {
      toast.error('Erro ao cancelar reserva.')
    }
  }

  async function handleEnviarMensagem() {
    if (!reservaSelecionada || !mensagemTexto.trim()) return

    setEnviandoMsg(true)
    try {
      const res = await fetch('/api/admin/reservas/mensagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservaId: reservaSelecionada.id,
          mensagem: mensagemTexto
        })
      })

      if (!res.ok) throw new Error()
      
      toast.success('Mensagem enviada com sucesso ao e-mail do cidadão!')
      setMensagemModalOpen(false)
      setMensagemTexto('')
      setReservaSelecionada(null)
    } catch (e) {
      toast.error('Erro ao enviar mensagem.')
    } finally {
      setEnviandoMsg(false)
    }
  }

  // Buscar horários ao trocar a data de reagendamento
  useEffect(() => {
    async function buscarHorariosLivres() {
      if (!reagendarData || !reservaParaReagendar) return
      setBuscandoHorarios(true)
      setHorariosDisponiveis([])
      setReagendarSlot('')

      try {
        const resAgenda = await fetch(`/api/agenda?quadraId=${reservaParaReagendar.quadra.id}&dataInicio=${reagendarData}&dataFim=${reagendarData}`)
        if (!resAgenda.ok) throw new Error()
        const agendas = await resAgenda.json()
        if (agendas.length === 0) {
          toast.info('Não há agenda aberta para esta data.')
          return
        }

        const resReservas = await fetch(`/api/reservas?quadraId=${reservaParaReagendar.quadra.id}&data=${reagendarData}`)
        if (!resReservas.ok) throw new Error()
        const reservasOcupadas = await resReservas.json()

        const horariosAgenda: string[] = agendas[0].horarios
        const horariosOcupados = reservasOcupadas
          .filter((r: any) => r.id !== reservaParaReagendar.id)
          .map((r: any) => r.slot)

        const livres = horariosAgenda.filter(h => !horariosOcupados.includes(h))
        setHorariosDisponiveis(livres)

        if (livres.length === 0) {
          toast.warning('Todos os horários desta data já estão ocupados.')
        }
      } catch (err) {
        toast.error('Erro ao buscar horários disponíveis.')
      } finally {
        setBuscandoHorarios(false)
      }
    }
    buscarHorariosLivres()
  }, [reagendarData, reservaParaReagendar])

  async function confirmarReagendamento() {
    if (!reservaParaReagendar || !reagendarData || !reagendarSlot) return

    setReagendando(true)
    try {
      const res = await fetch('/api/admin/reservas/reagendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservaId: reservaParaReagendar.id,
          novaData: reagendarData,
          novoSlot: reagendarSlot
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao reagendar')
      }

      toast.success('Reserva reagendada com sucesso!')
      setReagendarModalOpen(false)
      setReservaParaReagendar(null)
      carregarReservasSilencioso()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setReagendando(false)
    }
  }

  // Exportação CSV com BOM para Excel (UTF-8)
  const exportarCSV = () => {
    const BOM = '\uFEFF'
    const cabecalho = ['Data', 'Horário', 'Modalidade', 'Quadra', 'Status', 'Tipo', 'Responsável', 'Contato/Time']
    
    const linhas = reservas.map(r => {
      const data = formatDataCivilBR(r.data)
      const isTime = !!r.time
      const tipo = isTime ? 'Time' : 'Cidadão'
      
      const cpfFormatado = r.user?.id ? r.user.id.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : ''
      let responsavel = r.user?.name || (r.operador ? `Operador: ${r.operador.name}` : 'N/A')
      let contato = r.user?.email || 'Sem e-mail'
      let cpfExport = cpfFormatado

      if (r.time && r.time.responsaveis.length > 0) {
        responsavel = r.time.responsaveis[0].pessoa.nome
        contato = `Time: ${r.time.nome} | Tel: ${r.time.responsaveis[0].pessoa.telefone || ''}`
        const timeCpf = r.time.responsaveis[0].pessoa.cpf
        cpfExport = timeCpf ? timeCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : ''
      }
      
      const infoContatoECpf = `${contato}${cpfExport ? ` | CPF: ${cpfExport}` : ''}`

      return [
        data,
        r.slot,
        r.quadra.modalidade.nome,
        r.quadra.nome,
        r.status,
        tipo,
        responsavel,
        infoContatoECpf
      ].map(campo => `"${String(campo).replace(/"/g, '""')}"`).join(';')
    })

    const csvContent = BOM + [cabecalho.join(';'), ...linhas].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `relatorio_reservas_${new Date().getTime()}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }


  const limparFiltros = () => {
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroModalidade('todas')
    setFiltroQuadra('todas')
    setFiltroStatus('todas')
    setFiltroCpf('')
  }

  const quadrasFiltradas = useMemo(() => {
    if (filtroModalidade === 'todas') return quadras
    return quadras.filter(q => q.modalidade.nome === filtroModalidade)
  }, [quadras, filtroModalidade])

  const printStyles = `
    @media print {
      body * { visibility: hidden; }
      #print-area, #print-area * { visibility: visible; }
      #print-area {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        margin: 0;
      }
      .no-print { display: none !important; }
      @page { size: landscape; margin: 10mm; }
    }
  `

  return (
    <div className="p-4 md:p-8 space-y-6">
      <style>{printStyles}</style>

      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Gestão de Reservas</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            {reservas.length} reserva(s) encontrada(s)
            {(!filtroDataInicio && !filtroDataFim && reservas.length === 1000) && (
              <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                LIMITE: 1000 RECENTES
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-wrap gap-4 items-end no-print">
        
        <div className="w-full md:w-auto flex flex-col justify-end">
          <label className="text-xs font-bold uppercase tracking-wider block mb-1 opacity-0 hidden md:block">&nbsp;</label>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 h-[42px]">
            <Filter className="w-4 h-4" />
            Filtros:
          </div>
        </div>
        
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1 ml-1">Data Início</label>
          <input
            type="date"
            value={filtroDataInicio}
            onChange={(e) => setFiltroDataInicio(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#004B87]"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1 ml-1">Data Fim</label>
          <input
            type="date"
            value={filtroDataFim}
            onChange={(e) => setFiltroDataFim(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#004B87]"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1 ml-1">Modalidade</label>
          <select
            value={filtroModalidade}
            onChange={(e) => {
              setFiltroModalidade(e.target.value)
              setFiltroQuadra('todas')
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#004B87] min-w-[140px]"
          >
            <option value="todas">Todas</option>
            {modalidades.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1 ml-1">Quadra</label>
          <select
            value={filtroQuadra}
            onChange={(e) => setFiltroQuadra(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#004B87] min-w-[140px]"
          >
            <option value="todas">Todas</option>
            {quadrasFiltradas.map(q => (
              <option key={q.id} value={q.id}>{q.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1 ml-1">Status</label>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#004B87]"
          >
            <option value="todas">Ativas (Não Canceladas)</option>
            <option value="CONFIRMADA">Confirmada</option>
            <option value="CONCLUIDA">Concluída</option>
            <option value="CANCELADA_ADMIN">Cancelada</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1 ml-1">CPF Responsável</label>
          <input
            type="text"
            placeholder="000.000.000-00"
            value={filtroCpf}
            onChange={(e) => setFiltroCpf(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#004B87] min-w-[140px]"
          />
        </div>

        {(filtroDataInicio || filtroDataFim || filtroModalidade !== 'todas' || filtroQuadra !== 'todas' || filtroStatus !== 'todas' || filtroCpf) && (
          <button
            onClick={limparFiltros}
            className="text-sm text-slate-500 hover:text-slate-700 underline px-2 py-2"
          >
            Limpar
          </button>
        )}

        <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full sm:w-auto sm:ml-auto">
          <button
            onClick={exportarCSV}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-semibold transition-all shadow-sm h-11"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-semibold transition-all shadow-sm h-11"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </div>

      {/* Tabela de Relatório */}
      <div id="print-area" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">
        
        <div className="hidden print:block p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800">Relatório de Reservas</h2>
          <p className="text-slate-500">Período: {filtroDataInicio || 'Sempre'} até {filtroDataFim || 'Sempre'} | Total: {reservas.length} registros.</p>
        </div>

        {/* Indicador de atualização em background */}
        <div className={`h-1 w-full bg-slate-100 overflow-hidden no-print transition-opacity duration-300 ${isFetching && !isInitialLoad ? 'opacity-100' : 'opacity-0'}`}>
          <div className="h-full bg-blue-500 w-1/3 animate-[slide_1.5s_ease-in-out_infinite]"></div>
        </div>
        <style>{`
          @keyframes slide {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(300%); }
          }
        `}</style>

        {isInitialLoad ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 no-print">
            <Loader2 className="w-8 h-8 animate-spin text-slate-300 mb-4" />
            <p className="text-sm">Carregando registros...</p>
          </div>
        ) : reservas.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium">
            Nenhuma reserva encontrada para os filtros selecionados.
          </div>
        ) : (
          <div className={`transition-opacity duration-300 ${isFetching ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
            
            {/* Mobile Cards View */}
            <div className="md:hidden flex flex-col divide-y divide-slate-100">
              {reservas.map((r) => {
                const isTime = !!r.time
                const isAdmin = !!r.isAdminReserva
                const tipoTexto = isAdmin ? 'Reserva Interna' : (isTime ? 'Time' : 'Cidadão')
                
                const cpfFormatado = r.user?.id ? r.user.id.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : ''
                let responsavelNome = isAdmin ? (r.motivo || 'Reserva Interna') : (r.user?.name || (r.operador ? `Op: ${r.operador.name}` : 'N/A'))
                let responsavelEmail = isAdmin ? (r.user?.name ? `Criado por: ${r.user.name}` : 'Ação Administrativa') : (r.user?.email || 'Sem e-mail')
                let responsavelCpf = isAdmin ? '' : cpfFormatado

                if (r.time && r.time.responsaveis.length > 0) {
                  responsavelNome = r.time.nome
                  responsavelEmail = `Resp: ${r.time.responsaveis[0].pessoa.nome}`
                  const timeCpf = r.time.responsaveis[0].pessoa.cpf
                  responsavelCpf = timeCpf ? timeCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : ''
                }

                return (
                  <div key={r.id} className={`p-4 flex flex-col gap-3 transition-colors border-l-4 ${isAdmin ? 'bg-orange-50/60 border-orange-500' : 'border-transparent hover:bg-slate-50/50 border-b border-b-slate-100'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-slate-800 text-base">{r.quadra.nome}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-wide">{r.quadra.modalidade.nome}</div>
                      </div>
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        r.status === 'CONFIRMADA'
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.status === 'CONCLUIDA'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {r.status === 'CONFIRMADA' ? 'Confirmada' : r.status === 'CONCLUIDA' ? 'Concluída' : 'Cancelada'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{formatDataCivilBR(r.data)}</span>
                      <span className="text-slate-300">•</span>
                      <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md text-xs font-bold whitespace-nowrap inline-block">
                        {r.slot}
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex flex-col gap-1 mt-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-sm truncate pr-2">{responsavelNome}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${isAdmin ? 'bg-orange-100 text-orange-800 border border-orange-200' : isTime ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-700'}`}>
                          {tipoTexto}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 truncate" title={responsavelEmail}>{responsavelEmail}</span>
                      {responsavelCpf && (
                        <span className="text-xs font-mono text-slate-500 truncate mt-0.5" title={responsavelCpf}>CPF: {highlightCpf(responsavelCpf, filtroCpf)}</span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 justify-end mt-2">
                      {r.user?.email && !isAdmin && (
                        <button
                          onClick={() => {
                            setReservaSelecionada(r)
                            setMensagemTexto('')
                            setMensagemModalOpen(true)
                          }}
                          className="inline-flex items-center gap-1.5 text-[#004B87] hover:text-[#003666] hover:bg-blue-50 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors border border-slate-200 hover:border-blue-200"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          Mensagem
                        </button>
                      )}

                      {r.status === 'CONFIRMADA' && !isAdmin && (
                        <button
                          onClick={() => {
                            setReservaParaReagendar(r)
                            setReagendarData('')
                            setReagendarSlot('')
                            setHorariosDisponiveis([])
                            setReagendarModalOpen(true)
                          }}
                          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors border border-slate-200 hover:border-blue-200"
                        >
                          <CalendarClock className="w-3.5 h-3.5" />
                          Reagendar
                        </button>
                      )}

                      {r.status === 'CONFIRMADA' && (
                        <button
                          onClick={() => {
                            setReservaParaCancelar(r)
                            setMotivoCancelamento('Condições climáticas (chuva, etc.)')
                            setMotivoOutro('')
                            setCancelModalOpen(true)
                          }}
                          disabled={cancelando === r.id}
                          className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors border border-slate-200 hover:border-red-200"
                        >
                          {cancelando === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-4">Data</th>
                    <th className="p-4">Horário</th>
                    <th className="p-4">Quadra/Modalidade</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Responsável</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right no-print">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                  {reservas.map((r) => {
                    const isTime = !!r.time
                    const isAdmin = !!r.isAdminReserva
                    const tipoTexto = isAdmin ? 'Reserva Admin' : (isTime ? 'Time' : 'Cidadão')
                    
                    const cpfFormatado = r.user?.id ? r.user.id.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : ''
                    let responsavelNome = isAdmin ? (r.motivo || 'Sem motivo') : (r.user?.name || (r.operador ? `Op: ${r.operador.name}` : 'N/A'))
                    let responsavelEmail = isAdmin ? 'Bloqueio administrativo' : (r.user?.email || 'Sem e-mail')
                    let responsavelCpf = isAdmin ? '' : cpfFormatado

                    if (r.time && r.time.responsaveis.length > 0) {
                      responsavelNome = r.time.nome
                      responsavelEmail = `Resp: ${r.time.responsaveis[0].pessoa.nome}`
                      const timeCpf = r.time.responsaveis[0].pessoa.cpf
                      responsavelCpf = timeCpf ? timeCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : ''
                    }

                    return (
                    <tr key={r.id} className={`transition-colors ${isAdmin ? 'bg-orange-50/60' : 'hover:bg-slate-50/50'}`}>
                      <td className="p-4 font-semibold whitespace-nowrap text-slate-800">
                        {formatDataCivilBR(r.data)}
                      </td>
                      <td className="p-4">
                        <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap inline-block">
                          {r.slot}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{r.quadra.nome}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-wide">{r.quadra.modalidade.nome}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-md text-xs font-semibold ${isAdmin ? 'bg-orange-100 text-orange-800 border border-orange-200' : isTime ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                          {tipoTexto}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{responsavelNome}</div>
                        <div className="text-xs text-slate-500 truncate max-w-[200px]" title={responsavelEmail}>{responsavelEmail}</div>
                        {responsavelCpf && (
                          <div className="text-xs font-mono text-slate-500 mt-0.5">CPF: {highlightCpf(responsavelCpf, filtroCpf)}</div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          r.status === 'CONFIRMADA'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'CONCLUIDA'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {r.status === 'CONFIRMADA' ? 'Confirmada' : r.status === 'CONCLUIDA' ? 'Concluída' : 'Cancelada'}
                        </span>
                      </td>
                      <td className="p-4 text-right no-print flex justify-end gap-2">
                        {r.user?.email && !isAdmin && (
                          <button
                            onClick={() => {
                              setReservaSelecionada(r)
                              setMensagemTexto('')
                              setMensagemModalOpen(true)
                            }}
                            className="inline-flex items-center gap-1.5 text-[#004B87] hover:text-[#003666] hover:bg-blue-50 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors border border-slate-200 hover:border-blue-200"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            Mensagem
                          </button>
                        )}

                        {r.status === 'CONFIRMADA' && !isAdmin && (
                          <button
                            onClick={() => {
                              setReservaParaReagendar(r)
                              setReagendarData('')
                              setReagendarSlot('')
                              setHorariosDisponiveis([])
                              setReagendarModalOpen(true)
                            }}
                            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors border border-slate-200 hover:border-blue-200"
                          >
                            <CalendarClock className="w-3.5 h-3.5" />
                            Reagendar
                          </button>
                        )}

                        {r.status === 'CONFIRMADA' && (
                          <button
                            onClick={() => {
                              setReservaParaCancelar(r)
                              setMotivoCancelamento('Condições climáticas (chuva, etc.)')
                              setMotivoOutro('')
                              setCancelModalOpen(true)
                            }}
                            disabled={cancelando === r.id}
                            className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors disabled:opacity-50 border border-transparent hover:border-red-200"
                          >
                            {cancelando === r.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={mensagemModalOpen} onOpenChange={setMensagemModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar E-mail</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-500">
              Escreva uma mensagem para o cidadão responsável por esta reserva. Ele receberá um e-mail em nome da Administração.
            </p>
            {reservaSelecionada && (
              <div className="bg-slate-50 p-3 rounded-lg text-xs font-mono text-slate-600">
                Reserva: {reservaSelecionada.quadra.nome} - {formatDataCivilBR(reservaSelecionada.data)} às {reservaSelecionada.slot}
                <br/>
                Para: {reservaSelecionada.user?.name || 'Time/Cidadão'} ({reservaSelecionada.user?.email || 'Sem e-mail'})
              </div>
            )}
            <Textarea 
              placeholder="Digite sua mensagem aqui..." 
              value={mensagemTexto}
              onChange={(e) => setMensagemTexto(e.target.value)}
              className="min-h-[150px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMensagemModalOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleEnviarMensagem} 
              disabled={enviandoMsg || !mensagemTexto.trim()}
              className="bg-[#004B87] hover:bg-[#003666]"
            >
              {enviandoMsg ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
              Enviar Mensagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Cancelamento */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Confirmar Cancelamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-500">
              Esta ação enviará um e-mail automático ao cidadão informando o cancelamento da reserva.
            </p>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Motivo do Cancelamento</label>
              <Select value={motivoCancelamento} onValueChange={setMotivoCancelamento}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Condições climáticas (chuva, etc.)">Condições climáticas (chuva, etc.)</SelectItem>
                  <SelectItem value="Manutenção emergencial no local">Manutenção emergencial no local</SelectItem>
                  <SelectItem value="Evento oficial da Prefeitura/FUTEL">Evento oficial da Prefeitura/FUTEL</SelectItem>
                  <SelectItem value="Problemas de segurança na quadra">Problemas de segurança na quadra</SelectItem>
                  <SelectItem value="Outro">Outro (digitar)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {motivoCancelamento === 'Outro' && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Especifique o motivo</label>
                <Textarea 
                  placeholder="Descreva o motivo que será enviado no e-mail..."
                  value={motivoOutro}
                  onChange={(e) => setMotivoOutro(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelModalOpen(false)}>Voltar</Button>
            <Button 
              onClick={confirmarCancelamento} 
              disabled={cancelando === reservaParaCancelar?.id || (motivoCancelamento === 'Outro' && !motivoOutro.trim())}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelando === reservaParaCancelar?.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Reagendamento */}
      <Dialog open={reagendarModalOpen} onOpenChange={setReagendarModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reagendar Reserva</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-500">
              Selecione a nova data e horário para a reserva. O cidadão receberá um e-mail informando a mudança.
            </p>
            
            {reservaParaReagendar && (
              <div className="bg-slate-50 p-3 rounded-lg text-xs font-mono text-slate-600 space-y-1">
                <div><strong>Quadra:</strong> {reservaParaReagendar.quadra.nome}</div>
                <div><strong>Atual:</strong> {formatDataCivilBR(reservaParaReagendar.data)} às {reservaParaReagendar.slot}</div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Nova Data</label>
              <input
                type="date"
                value={reagendarData}
                onChange={(e) => setReagendarData(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#004B87]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Novo Horário</label>
              {buscandoHorarios ? (
                <div className="flex items-center text-sm text-slate-500 gap-2 px-1">
                  <Loader2 className="w-4 h-4 animate-spin" /> Buscando horários...
                </div>
              ) : (
                <Select value={reagendarSlot} onValueChange={setReagendarSlot} disabled={!reagendarData || horariosDisponiveis.length === 0}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={
                      !reagendarData ? "Selecione a data primeiro" : 
                      horariosDisponiveis.length === 0 ? "Sem horários livres" : "Selecione o horário"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {horariosDisponiveis.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReagendarModalOpen(false)}>Cancelar</Button>
            <Button 
              onClick={confirmarReagendamento} 
              disabled={reagendando || !reagendarData || !reagendarSlot}
              className="bg-[#004B87] hover:bg-[#003666]"
            >
              {reagendando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CalendarClock className="w-4 h-4 mr-2" />}
              Confirmar Reagendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
