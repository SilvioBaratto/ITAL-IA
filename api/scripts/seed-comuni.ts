/**
 * Seed all Italian comuni from kb/{region}/comuni.csv into the database.
 *
 * Usage:
 *   npm run seed:comuni                  # All regions
 *   ts-node -r tsconfig-paths/register scripts/seed-comuni.ts piemonte  # Single region
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const { readFileSync, readdirSync, existsSync } = fs;
const { join } = path;

dotenv.config({ path: join(__dirname, '..', '.env') });

const ROOT = join(__dirname, '..', '..');
const KB_DIR = join(ROOT, 'kb');
const UPSERT_BATCH_SIZE = 50;

async function main(): Promise<void> {
  const regionFilter = process.argv[2];

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();
    console.log('Connected to database\n');

    // Discover region directories that have comuni.csv
    const regionDirs = readdirSync(KB_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
      .map(d => d.name)
      .filter(d => existsSync(join(KB_DIR, d, 'comuni.csv')))
      .sort();

    const regions = regionFilter ? [regionFilter] : regionDirs;

    if (regionFilter && !regionDirs.includes(regionFilter)) {
      console.error(`Region not found: ${regionFilter}`);
      console.error(`Available: ${regionDirs.join(', ')}`);
      process.exit(1);
    }

    let totalInserted = 0;
    let totalUpdated = 0;

    for (const regionId of regions) {
      const csvPath = join(KB_DIR, regionId, 'comuni.csv');
      const raw = readFileSync(csvPath, 'utf-8');
      const lines = raw.trim().split('\n').slice(1); // skip header

      const rows = lines
        .filter(l => l.trim())
        .map(line => {
          const parts = line.split(',');
          return {
            name: parts[0]?.trim() || '',
            province: parts[1]?.trim() || '',
            latitude: parts[2]?.trim() || '',
            longitude: parts[3]?.trim() || '',
          };
        })
        .filter(r => r.name && r.latitude && r.longitude);

      let inserted = 0;
      let updated = 0;

      // Process in batches
      for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
        const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);

        await prisma.$transaction(
          batch.map(row =>
            prisma.comune.upsert({
              where: {
                name_regionId: { name: row.name, regionId },
              },
              create: {
                name: row.name,
                province: row.province,
                regionId,
                latitude: parseFloat(row.latitude),
                longitude: parseFloat(row.longitude),
              },
              update: {
                province: row.province,
                latitude: parseFloat(row.latitude),
                longitude: parseFloat(row.longitude),
              },
            }),
          ),
        );

        // Count: if the comune already existed, it's an update; otherwise, it's an insert
        // For simplicity, count all as processed
        inserted += batch.length;
      }

      console.log(`  [${regionId}] ${rows.length} comuni processed`);
      totalInserted += rows.length;
    }

    console.log(`\nDone: ${totalInserted} comuni across ${regions.length} regions`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
