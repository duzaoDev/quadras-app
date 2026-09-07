'use client'

import { useEffect, useState, useMemo } from 'react'
import { Printer, Loader2, FileText, FileSpreadsheet } from 'lucide-react'
import { CellFechado, CellLivre, CellReserva } from '@/components/AgendaCells'
import { prepareExportData, downloadCSV, downloadExcel } from '@/lib/exportUtils'

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

type Responsavel = {
  pessoa: {
    nome: string
    cpf: string
    telefone: string
  }
}

type Time = {
  id: string
  nome: string
  responsaveis: Responsavel[]
}

type Reserva = {
  id: string
  data: string
  slot: string
  status: string
  quadraId: string
  user?: { id: string; name: string; email: string; telefone?: string }
  time?: Time
  isAdminReserva?: boolean
  motivo?: string | null
}

// Utilitários de data
function getMonday(d: Date) {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d.setDate(diff))
  mon.setHours(0, 0, 0, 0)
  return mon
}

function formatarDataLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function gerarSlotsUnicos(reservas: Reserva[]) {
  const slots = new Set<string>()
  reservas.forEach(r => slots.add(r.slot))
  return Array.from(slots).sort()
}

function formatarCPF(cpf?: string) {
  if (!cpf) return '';
  const num = cpf.replace(/\D/g, '');
  if (num.length === 11) {
    return num.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return cpf;
}

export default function AgendaSemanalPage() {
  const [dataBase, setDataBase] = useState<string>(formatarDataLocal(getMonday(new Date())))
  
  const [modalidadeSelecionada, setModalidadeSelecionada] = useState<string>('todas')
  const [quadraSelecionada, setQuadraSelecionada] = useState<string>('todas')

  const [modalidades, setModalidades] = useState<string[]>([])
  const [todasQuadras, setTodasQuadras] = useState<Quadra[]>([])
  
  const [agendas, setAgendas] = useState<Agenda[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  
  const [carregando, setCarregando] = useState(true)
  const [isFetching, setIsFetching] = useState(false)

  // 1. Carregar Quadras (Para preencher filtros)
  useEffect(() => {
    async function carregarFiltros() {
      const res = await fetch('/api/admin/quadras')
      if (res.ok) {
        const data: Quadra[] = await res.json()
        const ativas = data.filter((q: Quadra) => q.ativa !== false)
        setTodasQuadras(ativas)

        const mods = Array.from(new Set(ativas.map(q => q.modalidade.nome))).sort()
        setModalidades(mods)
      }
    }
    carregarFiltros()
  }, [])

  // 2. Carregar Agenda da Semana (Com filtro de Quadra opcional)
  useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal

    async function carregarSemana() {
      if (!dataBase) return
      setIsFetching(true)
      
      const queryParams = new URLSearchParams({ dataBase })
      if (quadraSelecionada !== 'todas') queryParams.append('quadraId', quadraSelecionada)

      try {
        const res = await fetch(`/api/admin/agenda-semanal?${queryParams.toString()}`, { signal })
        if (res.ok) {
          const data = await res.json()
          setAgendas(data.agendas || [])
          setReservas(data.reservas || [])
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Erro ao buscar agenda da semana:', err)
        }
      } finally {
        setIsFetching(false)
        setCarregando(false)
      }
    }
    carregarSemana()

    return () => { controller.abort() }
  }, [dataBase, quadraSelecionada])

  const handlePrint = () => {
    window.print()
  }

  // Filtrar quadras baseado na seleção (modalidade e quadra específica)
  const quadrasFiltradas = useMemo(() => {
    return todasQuadras.filter(q => {
      const matchModalidade = modalidadeSelecionada === 'todas' || q.modalidade.nome === modalidadeSelecionada;
      const matchQuadra = quadraSelecionada === 'todas' || q.id === quadraSelecionada;
      return matchModalidade && matchQuadra;
    });
  }, [todasQuadras, modalidadeSelecionada, quadraSelecionada])

  // Preparação de dados para a Grid
  const allSlots = useMemo(() => {
    const resFiltradas = reservas.filter(r => quadrasFiltradas.some(q => q.id === r.quadraId))
    return gerarSlotsUnicos(resFiltradas)
  }, [reservas, quadrasFiltradas])

  // Dias Dinâmicos baseados nas reservas abertas
  const weekDays = useMemo(() => {
    // Pega as datas únicas no formato "YYYY-MM-DD" que têm alguma reserva
    const datasComReserva = reservas
      .filter(a => quadrasFiltradas.some(q => q.id === a.quadraId))
      .map(a => a.data.split('T')[0])

    const datasUnicasStr = Array.from(new Set(datasComReserva)).sort()
    
    return datasUnicasStr.map(str => {
      const [ano, mes, dia] = str.split('-').map(Number)
      return new Date(ano, mes - 1, dia, 12, 0, 0) // Usar meio-dia local para evitar problemas de timezone
    })
  }, [reservas, quadrasFiltradas])

  // O(1) Lookups
  const agendasMap = useMemo(() => {
    const map = new Map<string, Agenda>()
    agendas.forEach(a => {
      const dataStr = a.data.split('T')[0]
      map.set(`${dataStr}-${a.quadraId}`, a)
    })
    return map
  }, [agendas])

  const reservasMap = useMemo(() => {
    const map = new Map<string, Reserva>()
    reservas.forEach(r => {
      const dataStr = r.data.split('T')[0]
      map.set(`${dataStr}-${r.slot}-${r.quadraId}`, r)
    })
    return map
  }, [reservas])

  // Agrupar quadras por modalidade
  const quadrasPorModalidade = useMemo(() => {
    const grupos: Record<string, Quadra[]> = {}
    quadrasFiltradas.forEach(q => {
      const mod = q.modalidade.nome
      if (!grupos[mod]) grupos[mod] = []
      grupos[mod].push(q)
    })
    return Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0]))
  }, [quadrasFiltradas])

  // CSS for printing - landscape, full width, compact
  const printStyles = `
    @media print {
      body * {
        visibility: hidden;
      }
      #print-area, #print-area * {
        visibility: visible;
      }
      #print-area {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
      }
      .no-print {
        display: none !important;
      }
      @page {
        size: landscape;
        margin: 5mm;
      }
      .overflow-x-auto {
        overflow: visible !important;
      }
      table { 
        page-break-inside: auto; 
        width: 100% !important; 
        min-width: 0 !important;
        table-layout: fixed;
      }
      th, td, th *, td * {
        padding: 1px !important;
        margin: 0 !important;
        font-size: 8px !important;
        line-height: 1.1 !important;
        word-wrap: break-word;
      }
      h2, h3 { margin: 0 !important; padding: 2px 0 !important; font-size: 12px !important; }
      .p-4, .py-3, .px-4, .p-8, .p-3, .p-2.5, .p-2 { padding: 1px !important; }
      .mb-6, .mt-12, .mb-12, .mt-8, .mb-4, .space-y-12 > :not([hidden]) ~ :not([hidden]), .space-y-6 > :not([hidden]) ~ :not([hidden]) { margin-top: 0 !important; margin-bottom: 2px !important; }
      tr    { page-break-inside: avoid; page-break-after: auto }
      thead { display: table-header-group }
      tfoot { display: table-footer-group }
    }
  `

  return (
    <div className="p-4 md:p-8 space-y-6">
      <style>{printStyles}</style>
      
      {/* Controles (não aparecem na impressão) */}
      <div className="no-print space-y-6">
        {/* Cabeçalho e Botões */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 no-print">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Agenda Geral</h1>
            <p className="text-slate-500 mt-1">Ocupação das quadras e campos.</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-wrap gap-4 items-end no-print">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Semana Base</label>
            <input
              type="date"
              value={dataBase}
              onChange={e => setDataBase(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#004B87] text-slate-800 bg-white min-w-[160px]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Modalidade</label>
            <select
              value={modalidadeSelecionada}
              onChange={e => {
                setModalidadeSelecionada(e.target.value)
                setQuadraSelecionada('todas') // Reseta a quadra ao mudar modalidade
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#004B87] text-slate-800 bg-white min-w-[140px]"
            >
              <option value="todas">Todas</option>
              {modalidades.map(mod => (
                <option key={mod} value={mod}>{mod}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Quadra</label>
            <select
              value={quadraSelecionada}
              onChange={e => setQuadraSelecionada(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#004B87] text-slate-800 bg-white min-w-[140px]"
            >
              <option value="todas">Todas</option>
              {todasQuadras
                .filter(q => modalidadeSelecionada === 'todas' || q.modalidade.nome === modalidadeSelecionada)
                .map(q => (
                <option key={q.id} value={q.id}>{q.nome}</option>
              ))}
            </select>
          </div>
          
          <div className="flex gap-2 items-center ml-auto">
            <button
              onClick={() => {
                const [ano, mes, dia] = dataBase.split('-');
                const filename = `quadras-app-${dia}-${mes}-${ano}`;
                const data = prepareExportData(weekDays, allSlots, quadrasFiltradas, agendasMap, reservasMap);
                downloadCSV(data, filename);
              }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-semibold transition-all shadow-sm h-11"
              title="Exportar para CSV"
            >
              <FileText className="w-4 h-4" /> CSV
            </button>
            <button
              onClick={() => {
                const [ano, mes, dia] = dataBase.split('-');
                const filename = `quadras-app-${dia}-${mes}-${ano}`;
                downloadExcel(weekDays, allSlots, quadrasFiltradas, agendasMap, reservasMap, filename);
              }}
              className="flex items-center gap-2 bg-[#004B87] hover:bg-blue-800 text-white px-4 py-2 rounded-xl font-semibold transition-all shadow-sm h-11"
              title="Exportar para Excel"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-semibold transition-all shadow-sm h-11"
              title="Imprimir Relatório"
            >
              <Printer className="w-4 h-4" /> Imprimir
            </button>
          </div>
        </div>
      </div>

      {/* Área de Impressão */}
      <div id="print-area" className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-x-auto print:border-none print:shadow-none">
        
        {/* Indicador visual de background fetching */}
        <div className={`h-1 w-full bg-slate-100 overflow-hidden no-print transition-opacity duration-300 ${isFetching && !carregando ? 'opacity-100' : 'opacity-0'}`}>
          <div className="h-full bg-blue-500 w-1/3 animate-[slide_1.5s_ease-in-out_infinite]"></div>
        </div>

        {carregando ? (
          <div className="flex justify-center p-12 no-print">
            <Loader2 className="w-8 h-8 animate-spin text-[#004B87]" />
          </div>
        ) : quadrasFiltradas.length === 0 || allSlots.length === 0 ? (
          <div className="text-center p-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl m-6">
            Nenhuma reserva encontrada para a semana selecionada.
          </div>
        ) : (
          <div className={`transition-opacity duration-300 ${isFetching ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
            
            {/* Mobile Cards View */}
            <div className="md:hidden print:hidden flex flex-col divide-y divide-slate-100 mb-6">
              {reservas.filter(r => quadrasFiltradas.some(q => q.id === r.quadraId)).sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime() || a.slot.localeCompare(b.slot)).map((r) => {
                const isTime = !!r.time
                const tipoTexto = isTime ? 'Time' : 'Cidadão'
                const quadra = todasQuadras.find(q => q.id === r.quadraId)
                if (!quadra) return null;
                
                let responsavelNome = r.user?.name || 'N/A'
                let responsavelSub = ''
                let responsavelTel = r.user?.telefone || ''
                let responsavelCpf = formatarCPF(r.user?.id)
                let responsaveisHtml: React.ReactNode = null;

                if (r.time && r.time.responsaveis && r.time.responsaveis.length > 0) {
                  responsavelNome = r.time.nome
                  responsaveisHtml = r.time.responsaveis.map((respLink, idx) => {
                    const p = respLink.pessoa;
                    if (!p) return null;
                    const cpf = formatarCPF(p.cpf);
                    const tel = p.telefone;
                    return (
                      <div key={idx} className="text-xs text-slate-500 mt-2 flex flex-col gap-0.5 border-t border-slate-200/60 pt-2 first:mt-1 first:border-t-0 first:pt-0">
                        <span className="font-semibold text-slate-700">Resp {idx + 1}: {p.nome}</span>
                        {cpf && <span>CPF: {cpf}</span>}
                        {tel && <span>Tel: {tel}</span>}
                      </div>
                    )
                  })
                }

                return (
                  <div key={r.id} className="p-4 flex flex-col gap-3 hover:bg-slate-50/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-slate-800 text-base">{quadra.nome}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-wide">{quadra.modalidade.nome}</div>
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
                      <span className="text-sm font-semibold text-slate-800">
                        {r.data.split('T')[0].split('-').reverse().join('/')}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md text-xs font-bold whitespace-nowrap inline-block">
                        {r.slot}
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex flex-col gap-1 mt-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-800 text-sm truncate pr-2">{responsavelNome}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${isTime ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-700'}`}>
                          {tipoTexto}
                        </span>
                      </div>
                      
                      {responsaveisHtml ? (
                        <div className="flex flex-col gap-1">
                          {responsaveisHtml}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 flex flex-col gap-0.5">
                          {responsavelSub && <span className="font-semibold text-slate-700 truncate" title={responsavelSub}>{responsavelSub}</span>}
                          {responsavelCpf && <span>CPF: {responsavelCpf}</span>}
                          {responsavelTel && <span>Tel: {responsavelTel}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {reservas.filter(r => quadrasFiltradas.some(q => q.id === r.quadraId)).length === 0 && (
                <div className="p-8 text-center text-slate-500 font-medium">Nenhuma reserva encontrada na semana.</div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block print:block space-y-12">
              {quadrasPorModalidade.filter(([mod]) => mod.toLowerCase() !== 'futebol').map(([modalidade, quadrasModalidade], idx) => (
                <div key={modalidade} className={`break-inside-avoid bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none print:rounded-none ${idx > 0 ? 'print:break-before-page' : ''}`}>
                  <div className="bg-[#004B87] border-b-[3px] border-[#FFD100] px-4 py-3 print:bg-transparent print:border-b-2 print:border-slate-800 print:text-black">
                    <h2 className="text-lg font-black text-white uppercase tracking-widest print:text-slate-800">
                      {modalidade}
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-max border-collapse text-xs">
                  <thead>
                    {/* Dias da Semana (Primeira Linha) */}
                    <tr>
                      <th className="border border-slate-200 bg-slate-50 p-3 text-center font-bold text-slate-500 uppercase w-20">
                        Horário
                      </th>
                      {weekDays.map((day, dIdx) => (
                        <th 
                          key={formatarDataLocal(day)} 
                          colSpan={quadrasModalidade.length} 
                          className={`border border-slate-200 bg-slate-100 p-3 text-center font-bold text-slate-700 uppercase ${dIdx > 0 ? 'border-l-4 border-l-black' : ''}`}
                        >
                          {day.toLocaleDateString('pt-BR', { weekday: 'long' })}, {String(day.getDate()).padStart(2, '0')}/{String(day.getMonth() + 1).padStart(2, '0')}
                        </th>
                      ))}
                    </tr>
                    {/* Nomes das Quadras (Segunda Linha) */}
                    {weekDays.length > 0 && (
                      <tr>
                        <th className="border border-slate-200 bg-white p-1"></th>
                        {weekDays.map((day, dIdx) => (
                          quadrasModalidade.map((q, qIdx) => (
                            <th 
                              key={`${formatarDataLocal(day)}-${q.id}-header`} 
                              className={`border border-slate-200 bg-white p-2.5 text-center font-bold text-slate-600 uppercase text-[11px] ${dIdx > 0 && qIdx === 0 ? 'border-l-4 border-l-black' : ''}`}
                            >
                              {q.nome}
                            </th>
                          ))
                        ))}
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {allSlots.map(slot => {
                      // Verifica se o slot tem alguma atividade em qualquer dia/quadra desta modalidade
                      const hasAnyActivityInSlot = weekDays.some(day => {
                        const dataStr = formatarDataLocal(day)
                        return quadrasModalidade.some(quadra => {
                          const reserva = reservasMap.get(`${dataStr}-${slot}-${quadra.id}`)
                          return !!reserva
                        })
                      })

                      if (!hasAnyActivityInSlot) return null;

                      return (
                      <tr key={slot}>
                        <td className="border border-slate-200 bg-slate-50 font-bold p-3 text-center whitespace-nowrap text-slate-700">
                          {slot.split(' - ')[0] || slot}
                        </td>
                        {weekDays.map((day, dIdx) => {
                          const dataStr = formatarDataLocal(day)
                          
                          return quadrasModalidade.map((quadra, qIdx) => {
                            const agenda = agendasMap.get(`${dataStr}-${quadra.id}`)
                            const isAberto = agenda?.horarios.includes(slot)
                            const reserva = reservasMap.get(`${dataStr}-${slot}-${quadra.id}`)

                            // Célula vazia/fechada
                            if (!reserva) {
                              return <td key={`${dataStr}-${quadra.id}`} className={`bg-white border border-slate-200 ${dIdx > 0 && qIdx === 0 ? 'border-l-4 border-l-black' : ''}`}></td>
                            }

                            // Célula com Reserva
                            let infoTexto: React.ReactNode = ''
                            let subInfo: React.ReactNode = ''
                            
                            if (reserva.isAdminReserva) {
                              infoTexto = <>{(reserva.motivo?.toUpperCase() || 'RESERVA INTERNA')} <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded ml-1 font-bold">INTERNA</span></>
                              subInfo = (
                                <div className="flex flex-col gap-0.5 mt-1 leading-tight text-slate-500">
                                  <span>{reserva.user?.name ? `Por: ${reserva.user.name}` : 'Ação Administrativa'}</span>
                                </div>
                              )
                            } else if (reserva.time && reserva.time.responsaveis && reserva.time.responsaveis.length > 0) {
                              infoTexto = <>{reserva.time.nome.toUpperCase()} <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded ml-1 font-bold">TIME</span></>
                              subInfo = (
                                <div className="flex flex-col gap-2 mt-1 leading-tight">
                                  {reserva.time.responsaveis.map((rLink, idx) => {
                                    const p = rLink.pessoa;
                                    if (!p) return null;
                                    const c = formatarCPF(p.cpf);
                                    const t = p.telefone;
                                    const telDisp = t ? <a href={`tel:${t}`} className="hover:underline text-primary ml-1">{t}</a> : <span className="text-slate-400 ml-1">[Sem Tel]</span>;
                                    
                                    return (
                                      <div key={idx} className="flex flex-col gap-0.5 pb-1.5 border-b border-slate-200/60 last:border-0 last:pb-0">
                                        <span className="font-semibold text-slate-700">Resp {idx + 1}: {p.nome.toUpperCase()}</span>
                                        <span className="text-[10px]">CPF: {c || 'N/A'}</span>
                                        <span className="text-[10px]">Tel: {telDisp}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            } else {
                              const telClean = reserva.user?.telefone || ''
                              const cpfClean = formatarCPF(reserva.user?.id || '')
                              const telDisplay = telClean ? (
                                <a href={`tel:${telClean}`} className="hover:underline text-primary ml-1">{telClean}</a>
                              ) : (
                                <span className="text-slate-400 ml-1">[Sem Telefone]</span>
                              )
                              
                              infoTexto = reserva.user?.name?.toUpperCase() || 'ADMIN'
                              subInfo = (
                                <div className="flex flex-col gap-0.5 mt-1 leading-tight">
                                  <span>CPF: {cpfClean || 'N/A'}</span>
                                  <span>Tel: {telDisplay}</span>
                                </div>
                              )
                            }

                              return (
                                <CellReserva 
                                  key={`${dataStr}-${quadra.id}`}
                                  infoTexto={infoTexto}
                                  subInfo={subInfo}
                                  className={dIdx > 0 && qIdx === 0 ? 'border-l-4 border-l-black' : ''}
                                />
                              )
                          })
                        })}
                      </tr>
                      )
                    })}
                    {allSlots.length === 0 && (
                      <tr>
                        <td colSpan={(weekDays.length * quadrasModalidade.length) + 1} className="p-8 text-center text-slate-500 border border-slate-200 font-medium">
                          Nenhuma agenda disponível para a semana base selecionada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                  </div>
                </div>
            ))}
            
            {/* Renderizar FUTEBOL separadamente com grande margem */}
            {quadrasPorModalidade.filter(([mod]) => mod.toLowerCase() === 'futebol').map(([modalidade, quadrasModalidade]) => (
              <div key={modalidade} className="mt-12 break-inside-avoid bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:break-before-page print:mt-0 print:border-none print:shadow-none print:rounded-none">
                  <div className="bg-[#009A44] border-b-[3px] border-[#FFD100] px-4 py-3 print:bg-transparent print:border-b-2 print:border-slate-800 print:text-black">
                    <h2 className="text-lg font-black text-white uppercase tracking-widest print:text-slate-800">
                      {modalidade}
                    </h2>
                  </div>
                  {/* FUTEBOL SEPARADO POR DIA */}
                  <div className="mt-4">
                    {weekDays.map((singleDay, sdIdx) => {
                      const dataStrSingle = formatarDataLocal(singleDay);
                      
                      // Filtra os slots para verificar se há alguma reserva nesse dia
                      const slotsForDay = allSlots.filter(slot => {
                        return quadrasModalidade.some(quadra => !!reservasMap.get(`${dataStrSingle}-${slot}-${quadra.id}`))
                      });

                      if (slotsForDay.length === 0) return null;

                      return (
                        <div key={dataStrSingle} className={`mb-12 ${sdIdx > 0 ? 'print:break-before-page' : ''}`}>
                          <h3 className="text-xl font-bold text-slate-800 mb-4 uppercase border-b-2 border-slate-200 pb-2 px-4">
                            {singleDay.toLocaleDateString('pt-BR', { weekday: 'long' })}, {String(singleDay.getDate()).padStart(2, '0')}/{String(singleDay.getMonth() + 1).padStart(2, '0')}
                          </h3>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-max border-collapse text-xs">
                              <thead>
                              <tr>
                                <th className="border border-slate-200 bg-slate-50 p-2 text-center font-bold text-slate-500 uppercase w-20">
                                  Horário
                                </th>
                                {quadrasModalidade.map(q => (
                                  <th key={`${dataStrSingle}-${q.id}-header`} className="border border-slate-200 bg-slate-100 p-2 text-center font-bold text-slate-700 uppercase text-[10px]">
                                    {q.nome}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {slotsForDay.map(slot => (
                                <tr key={slot}>
                                  <td className="border border-slate-200 bg-slate-50 font-bold p-2 text-center whitespace-nowrap text-slate-700">
                                    {slot.split(' - ')[0] || slot}
                                  </td>
                                  {quadrasModalidade.map(quadra => {
                                    const reserva = reservasMap.get(`${dataStrSingle}-${slot}-${quadra.id}`)
                                    if (!reserva) return <td key={`${dataStrSingle}-${quadra.id}`} className="bg-white border border-slate-200"></td>
                                    
                                    let infoTexto: React.ReactNode = ''
                                    let subInfo: React.ReactNode = ''
                                    
                                    if (reserva.isAdminReserva) {
                                      infoTexto = <>{(reserva.motivo?.toUpperCase() || 'RESERVA INTERNA')} <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded ml-1 font-bold">INTERNA</span></>
                                      subInfo = (
                                        <div className="flex flex-col gap-0.5 mt-1 leading-tight text-slate-500">
                                          <span>{reserva.user?.name ? `Por: ${reserva.user.name}` : 'Ação Administrativa'}</span>
                                        </div>
                                      )
                                    } else if (reserva.time && reserva.time.responsaveis && reserva.time.responsaveis.length > 0) {
                                      infoTexto = <>{reserva.time.nome.toUpperCase()} <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded ml-1 font-bold">TIME</span></>
                                      subInfo = (
                                        <div className="flex flex-col gap-2 mt-1 leading-tight">
                                          {reserva.time.responsaveis.map((rLink, idx) => {
                                            const p = rLink.pessoa;
                                            if (!p) return null;
                                            const c = formatarCPF(p.cpf);
                                            const t = p.telefone;
                                            const telDisp = t ? <a href={`tel:${t}`} className="hover:underline text-primary ml-1">{t}</a> : <span className="text-slate-400 ml-1">[Sem Tel]</span>;
                                            
                                            return (
                                              <div key={idx} className="flex flex-col gap-0.5 pb-1.5 border-b border-slate-200/60 last:border-0 last:pb-0">
                                                <span className="font-semibold text-slate-700">Resp {idx + 1}: {p.nome.toUpperCase()}</span>
                                                <span className="text-[10px]">CPF: {c || 'N/A'}</span>
                                                <span className="text-[10px]">Tel: {telDisp}</span>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      )
                                    } else {
                                      const telClean = reserva.user?.telefone || ''
                                      const cpfClean = formatarCPF(reserva.user?.id || '')
                                      const telDisplay = telClean ? <a href={`tel:${telClean}`} className="hover:underline text-primary ml-1">{telClean}</a> : <span className="text-slate-400 ml-1">[Sem Telefone]</span>
                                      
                                      infoTexto = reserva.user?.name?.toUpperCase() || 'ADMIN'
                                      subInfo = (
                                        <div className="flex flex-col gap-0.5 mt-1 leading-tight">
                                          <span>CPF: {cpfClean || 'N/A'}</span>
                                          <span>Tel: {telDisplay}</span>
                                        </div>
                                      )
                                    }
                                    return <CellReserva key={`${dataStrSingle}-${quadra.id}`} infoTexto={infoTexto} subInfo={subInfo} />
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
            ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
