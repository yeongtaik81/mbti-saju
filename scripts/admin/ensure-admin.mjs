#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, '..', '..');
const ENV_PATH = resolve(ROOT_DIR, '.env');
const DEFAULT_ADMIN_EMAIL = 'admin@mbti-saju.local';
const DEFAULT_ADMIN_PASSWORD = 'Admin1234!';
const SALT_ROUNDS = 12;
const DEFAULT_ADMIN_PROFILE = {
  name: '관리자',
  birthDate: '1984-03-11',
  birthTime: '12:00',
  birthDateTime: new Date(Date.UTC(1984, 2, 11, 12, 0, 0)),
  gender: 'FEMALE',
  mbtiType: 'INTJ'
};

function loadEnvFile() {
  if (!existsSync(ENV_PATH)) {
    return;
  }

  const content = readFileSync(ENV_PATH, 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (process.env[key]) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile();

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL).toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: 'ADMIN',
      credential: {
        upsert: {
          update: {
            passwordHash
          },
          create: {
            passwordHash
          }
        }
      },
      wallet: {
        upsert: {
          update: {},
          create: {
            balance: 0
          }
        }
      }
    },
    create: {
      email,
      role: 'ADMIN',
      credential: {
        create: {
          passwordHash
        }
      },
      wallet: {
        create: {
          balance: 0
        }
      }
    },
    select: {
      id: true,
      email: true,
      role: true
    }
  });

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {
      name: DEFAULT_ADMIN_PROFILE.name,
      birthDateTime: DEFAULT_ADMIN_PROFILE.birthDateTime,
      birthDate: DEFAULT_ADMIN_PROFILE.birthDate,
      birthTime: DEFAULT_ADMIN_PROFILE.birthTime,
      isBirthTimeUnknown: false,
      birthCalendarType: 'SOLAR',
      isLeapMonth: false,
      birthCountryType: 'KOREA',
      birthCountry: '대한민국',
      birthPlace: '대한민국',
      gender: DEFAULT_ADMIN_PROFILE.gender
    },
    create: {
      userId: user.id,
      name: DEFAULT_ADMIN_PROFILE.name,
      birthDateTime: DEFAULT_ADMIN_PROFILE.birthDateTime,
      birthDate: DEFAULT_ADMIN_PROFILE.birthDate,
      birthTime: DEFAULT_ADMIN_PROFILE.birthTime,
      isBirthTimeUnknown: false,
      birthCalendarType: 'SOLAR',
      isLeapMonth: false,
      birthCountryType: 'KOREA',
      birthCountry: '대한민국',
      birthPlace: '대한민국',
      gender: DEFAULT_ADMIN_PROFILE.gender
    }
  });

  await prisma.mbtiProfile.upsert({
    where: { userId: user.id },
    update: {
      mbtiType: DEFAULT_ADMIN_PROFILE.mbtiType,
      sourceType: 'DIRECT'
    },
    create: {
      userId: user.id,
      mbtiType: DEFAULT_ADMIN_PROFILE.mbtiType,
      sourceType: 'DIRECT'
    }
  });

  console.log('[admin] local admin account is ready');
  console.log(`[admin] email: ${user.email}`);
  console.log(`[admin] password: ${password}`);
  console.log(`[admin] role: ${user.role}`);
}

main()
  .catch((error) => {
    console.error('[admin] failed to ensure admin account');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
