import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Cria uma Date UTC midnight a partir de "YYYY-MM-DD", evitando deslocamento de timezone.
 * Garante que "2026-06-28" sempre se torne 2026-06-28T00:00:00.000Z independente do timezone do servidor.
 */
function parseDataUTC(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia))
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { data, quadraId, horarios } = body

    if (!data || !quadraId || !horarios || !Array.isArray(horarios)) {
      return NextResponse.json(
        { error: 'Dados incompletos. Envie data, quadraId e horarios[].' },
        { status: 400 }
      )
    }

    const dataAgenda = parseDataUTC(data)

    // Verifica se a agenda já existe para encontrar horários removidos
    const existingAgenda = await prisma.agenda.findUnique({
      where: {
        data_quadraId: {
          data: dataAgenda,
          quadraId,
        },
      },
    })

    if (existingAgenda) {
      // Encontra horários que estavam na agenda mas não estão mais na nova requisição
      const removedSlots = existingAgenda.horarios.filter(
        (slot) => !horarios.includes(slot)
      )

      if (removedSlots.length > 0) {
        // Cancela as reservas atreladas aos horários removidos
        await prisma.reserva.updateMany({
          where: {
            quadraId,
            data: dataAgenda,
            slot: {
              in: removedSlots,
            },
          },
          data: {
            status: 'CANCELADA_ADMIN',
            motivo: 'Horário suspenso pela administração',
          },
        })
      }
    }

    const agenda = await prisma.agenda.upsert({
      where: {
        data_quadraId: {
          data: dataAgenda,
          quadraId,
        },
      },
      update: {
        horarios,
      },
      create: {
        data: dataAgenda,
        quadraId,
        horarios,
      },
    })

    return NextResponse.json(agenda, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar/atualizar agenda:', error)
    return NextResponse.json(
      { error: 'Erro ao criar/atualizar agenda' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID da agenda é obrigatório' },
        { status: 400 }
      )
    }

    const agenda = await prisma.agenda.findUnique({ where: { id } })
    if (agenda) {
      // Se a agenda do dia todo foi excluída, cancelamos também todas as reservas desse dia e quadra
      await prisma.reserva.updateMany({
        where: {
          quadraId: agenda.quadraId,
          data: agenda.data,
        },
        data: {
          status: 'CANCELADA_ADMIN',
          motivo: 'Dia suspenso pela administração',
        },
      })
    }

    await prisma.agenda.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao remover agenda:', error)
    return NextResponse.json(
      { error: 'Erro ao remover agenda' },
      { status: 500 }
    )
  }
}
