import { PrismaClient } from '@prisma/client';

function parseArgs(argv) {
  const args = {
    limit: 20,
    stage: undefined,
    userId: undefined,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--json') {
      args.json = true;
      continue;
    }

    if (token === '--limit') {
      const value = argv[index + 1];
      if (value) {
        args.limit = Number.parseInt(value, 10);
        index += 1;
      }
      continue;
    }

    if (token === '--stage') {
      const value = argv[index + 1];
      if (value) {
        args.stage = value;
        index += 1;
      }
      continue;
    }

    if (token === '--user') {
      const value = argv[index + 1];
      if (value) {
        args.userId = value;
        index += 1;
      }
    }
  }

  if (!Number.isFinite(args.limit) || args.limit <= 0) {
    throw new Error('`--limit` must be a positive integer.');
  }

  return args;
}

function formatFailureRow(item) {
  return {
    createdAt: item.createdAt.toISOString(),
    stage: item.stage,
    reasonCode: item.reasonCode,
    readingType: item.readingType,
    subjectType: item.subjectType,
    userId: item.userId,
    cacheKey: item.cacheKey ?? '-',
    period: item.periodKey ?? '-',
    message: item.reasonMessage
  };
}

const prisma = new PrismaClient();

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const failures = await prisma.sajuGenerationFailure.findMany({
    where: {
      stage: args.stage,
      userId: args.userId
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: args.limit
  });

  if (args.json) {
    process.stdout.write(`${JSON.stringify(failures, null, 2)}\n`);
    return;
  }

  if (failures.length === 0) {
    process.stdout.write('No saju generation failures found.\n');
    return;
  }

  console.table(failures.map((item) => formatFailureRow(item)));
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
