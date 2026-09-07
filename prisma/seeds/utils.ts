import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { fakerPT_BR as faker } from '@faker-js/faker';

export const prisma = new PrismaClient();

export function ensureDevEnvironment() {
  // Comentado para permitir rodar em produção temporariamente
  /*
  if (process.env.NODE_ENV === 'production') {
    console.error('⛔ ERRO: Seed não pode ser executado em ambiente de produção!');
    process.exit(1);
  }
  */
  if (process.env.ALLOW_DEMO_SEED !== 'true') {
    console.error('⛔ ERRO: Variável ALLOW_DEMO_SEED=true é obrigatória para rodar seeds fakes.');
    process.exit(1);
  }
}

export function gerarCpfValido(): string {
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

export async function getDefaultPasswordHash() {
  return await bcrypt.hash('123456', 10);
}

export const SLOTS_GERAL = [
  '06:00-08:00', '08:00-10:00', '10:00-12:00', '12:00-14:00',
  '14:00-16:00', '16:00-18:00', '18:00-20:00', '20:00-21:45'
];

export const SLOTS_TENIS = [
  '06:00-07:00', '07:00-08:00', '08:00-09:00', '09:00-10:00',
  '10:00-11:00', '11:00-12:00', '12:00-13:00', '13:00-14:00',
  '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00',
  '18:00-19:00', '19:00-20:00', '20:00-21:00', '21:00-21:45'
];

export const SLOTS_FUTEBOL_SAB = [
  '09:00-11:00', '14:00-16:00', '16:00-18:00'
];

export const SLOTS_FUTEBOL_DOM = [
  '08:00-10:00', '10:00-12:00', '15:00-17:00'
];

export { faker };
