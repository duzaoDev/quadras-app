import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function parseDataUTCInicio(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia, 0, 0, 0, 0))
}

function parseDataUTCFim(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia, 23, 59, 59, 999))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const quadraId = searchParams.get('quadraId')
  const dataInicioStr = searchParams.get('dataInicio')
  const dataFimStr = searchParams.get('dataFim')

  if (!quadraId) {
    return NextResponse.json(
      { error: 'Parâmetro quadraId é obrigatório' },
      { status: 400 }
    )
  }

  try {
    const agendas = await prisma.agenda.findMany({
      where: {
        quadraId,
        ...(dataInicioStr && dataFimStr
          ? {
              data: {
                gte: parseDataUTCInicio(dataInicioStr),
                lte: parseDataUTCFim(dataFimStr),
              },
            }
          : {}),
      },
      orderBy: {
        data: 'asc',
      },
    })

    return NextResponse.json(agendas)
  } catch (error) {
    console.error('Erro ao buscar agendas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar agendas' },
      { status: 500 }
    )
  }
}
