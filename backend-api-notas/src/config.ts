import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadLocalEnv(): void {
  const envPath = resolve(process.cwd(), '.env')
  try {
    const contents = readFileSync(envPath, 'utf8')
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const separator = trimmed.indexOf('=')
      if (separator < 1) continue
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
      if (process.env[key] === undefined) process.env[key] = value
    }
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
  }
}

loadLocalEnv()

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} deve ser um inteiro positivo.`)
  return parsed
}

const host = process.env.HOST ?? '127.0.0.1'
if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
  throw new Error('HOST deve ser localhost, 127.0.0.1 ou ::1. A API MVP nao pode escutar na rede.')
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('Defina DATABASE_URL no arquivo .env.')

export const config = {
  host,
  port: positiveInteger(process.env.PORT, 3000, 'PORT'),
  databaseUrl,
  databasePoolSize: positiveInteger(process.env.DATABASE_POOL_SIZE, 10, 'DATABASE_POOL_SIZE'),
  frontendOrigins: new Set(
    (process.env.FRONTEND_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ),
}
