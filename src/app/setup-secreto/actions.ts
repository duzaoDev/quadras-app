"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { addDays, startOfDay, getDay } from "date-fns";
import { revalidatePath } from "next/cache";

async function verifyAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Não autorizado");
  }
}

function gerarCpfValido(): string {
  const calc = (n: number[]) => {
    const s = n.reduce((acc, val, i) => acc + val * (n.length + 1 - i), 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  n.push(calc(n));
  n.push(calc(n));
  return n.join('');
}

const SLOTS_GERAL = [
  '06:00-08:00', '08:00-10:00', '10:00-12:00', '12:00-14:00',
  '14:00-16:00', '16:00-18:00', '18:00-20:00', '20:00-21:45'
];

const SLOTS_TENIS = [
  '06:00-07:00', '07:00-08:00', '08:00-09:00', '09:00-10:00',
  '10:00-11:00', '11:00-12:00', '12:00-13:00', '13:00-14:00',
  '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00',
  '18:00-19:00', '19:00-20:00', '20:00-21:00', '21:00-21:45'
];

const SLOTS_FUTEBOL_SAB = [
  '09:00-11:00', '14:00-16:00', '16:00-18:00'
];

const SLOTS_FUTEBOL_DOM = [
  '08:00-10:00', '10:00-12:00', '15:00-17:00'
];

export async function cleanDatabaseAction() {
  await verifyAdmin();

  await prisma.passwordResetToken.deleteMany();
  await prisma.reserva.deleteMany();
  await prisma.agenda.deleteMany();
  await prisma.responsavelTime.deleteMany();
  await prisma.time.deleteMany();

  // Preservar Admin e cidadao teste
  await prisma.user.deleteMany({
    where: {
      email: {
        notIn: ['admin@futel.mg.gov.br', 'cidadao@teste.com']
      }
    }
  });

  const remainingUsers = await prisma.user.findMany({
    where: { pessoaId: { not: null } },
    select: { pessoaId: true }
  });
  
  const keepPessoaIds = remainingUsers.map(u => u.pessoaId).filter(Boolean) as string[];

  if (keepPessoaIds.length > 0) {
    await prisma.pessoa.deleteMany({
      where: {
        id: { notIn: keepPessoaIds }
      }
    });
  } else {
    await prisma.pessoa.deleteMany();
  }

  revalidatePath("/", "layout");
  return { success: true, message: "Banco de dados limpo com sucesso! (Quadras, Admin e Usuário Teste mantidos)" };
}

export async function runDemoSeedAction() {
  await verifyAdmin();

  const pwd = await bcrypt.hash('123456', 10);
  
  // Garantir a recriação do admin e teste se alguém os deletou manualmente
  await prisma.user.upsert({
    where: { email: 'admin@futel.mg.gov.br' },
    update: {},
    create: {
      id: 'admin',
      name: 'Admin FUTEL',
      email: 'admin@futel.mg.gov.br',
      password: pwd,
      role: 'ADMIN',
    }
  });

  await prisma.user.upsert({
    where: { email: 'cidadao@teste.com' },
    update: {},
    create: {
      id: '12345678900',
      name: 'Cidadão / Usuário Teste',
      email: 'cidadao@teste.com',
      password: pwd,
      role: 'USER',
      telefone: '34999999999',
    }
  });

  const quadras = await prisma.quadra.findMany({ include: { modalidade: true } });
  if (quadras.length === 0) {
    throw new Error('Nenhuma quadra encontrada. Certifique-se de rodar o seed base localmente.');
  }

  const hoje = startOfDay(new Date());
  let diasParaSabado = 6 - getDay(hoje);
  if (diasParaSabado <= 0) diasParaSabado += 7; 
  const sabado = addDays(hoje, diasParaSabado);
  const domingo = addDays(sabado, 1);
  const datasFinalSemana = [sabado, domingo];

  const timesCriados = [];
  const cpfsUsados = new Set<string>();

  for (let i = 1; i <= 20; i++) {
    const nomeTime = `Time Teste FC ${i}`;
    const time = await prisma.time.upsert({
      where: { nome: nomeTime },
      update: {},
      create: {
        nome: nomeTime,
        status: 'APTO',
      }
    });
    timesCriados.push(time);
    
    for(let j = 1; j <= 2; j++) {
      let cpfResp = gerarCpfValido();
      while(cpfsUsados.has(cpfResp)) cpfResp = gerarCpfValido();
      cpfsUsados.add(cpfResp);
      
      const p = await prisma.pessoa.create({
        data: {
          cpf: cpfResp,
          nome: `Responsável ${j} do Time ${i}`,
          telefone: `349999999${(i * j) % 10}`,
          comprovanteResidencia: true,
          antecedentesCriminais: true,
        }
      });
      await prisma.responsavelTime.create({
        data: { pessoaId: p.id, timeId: time.id }
      });
    }
  }

  let totalReservas = 0;
  
  for (const quadra of quadras) {
    const isTenis = quadra.modalidade.nome.toLowerCase() === 'tênis';
    const isFutebol = quadra.modalidade.nome.toLowerCase() === 'futebol';
    let slotsPadrao = isTenis ? SLOTS_TENIS : SLOTS_GERAL;

    for (const data of datasFinalSemana) {
      let slots = slotsPadrao;
      if (isFutebol) {
        if (data.getDay() === 6) slots = SLOTS_FUTEBOL_SAB;
        else if (data.getDay() === 0) slots = SLOTS_FUTEBOL_DOM;
      }

      await prisma.agenda.upsert({
        where: { data_quadraId: { data, quadraId: quadra.id } },
        update: {},
        create: {
          data,
          quadraId: quadra.id,
          horarios: slots,
        }
      });

      for (const slot of slots) {
        let cpfUnico = gerarCpfValido();
        while(cpfsUsados.has(cpfUnico)) cpfUnico = gerarCpfValido();
        cpfsUsados.add(cpfUnico);

        const userUnico = await prisma.user.create({
          data: {
            id: cpfUnico,
            name: `Usuário ${totalReservas + 1}`,
            email: `teste${totalReservas + 1}@futel.mg.gov.br`,
            password: pwd,
            telefone: `34999999999`,
            role: 'USER',
          }
        });

        let timeId = null;
        if (isFutebol) {
          timeId = timesCriados[totalReservas % timesCriados.length].id;
        }

        await prisma.reserva.upsert({
          where: { data_slot_quadraId_cancelToken: { data, slot, quadraId: quadra.id, cancelToken: '' } },
          update: {},
          create: {
            userId: userUnico.id,
            quadraId: quadra.id,
            data,
            slot,
            status: 'CONFIRMADA',
            timeId,
          }
        });
        totalReservas++;
      }
    }
  }

  revalidatePath("/", "layout");
  return { success: true, message: `Seed finalizado! ${totalReservas} reservas criadas no FDS.` };
}
