import 'dotenv/config'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const migrate = require('node-pg-migrate').default

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }
  await migrate({
    databaseUrl,
    dir: 'migrations',
    direction: 'up',
    count: Infinity,
    migrationsTable: 'pgmigrations',
    log: () => {},
  })
  // eslint-disable-next-line no-console
  console.log('Migrations completed')
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exit(1)
})


