import { createInterface } from 'node:readline'
import { pool } from '../src/infrastructure/database.js'
import { hashTestPassword } from '../src/application/use-cases.js'

function prompt(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const terminal = createInterface({ input: process.stdin, output: process.stdout })
    terminal.question(question, (answer) => {
      terminal.close()
      resolve(answer.trim())
    })
    terminal.on('SIGINT', () => {
      terminal.close()
      reject(new Error('Operacao cancelada.'))
    })
  })
}

function promptHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    return Promise.reject(new Error('Execute este comando em um terminal interativo para ocultar a senha.'))
  }

  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    const stdout = process.stdout
    const previousRawMode = stdin.isRaw
    let answer = ''
    stdout.write(question)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')

    const cleanup = () => {
      stdin.removeListener('data', onData)
      stdin.setRawMode(previousRawMode ?? false)
      stdout.write('\n')
    }

    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          cleanup()
          reject(new Error('Operacao cancelada.'))
          return
        }
        if (character === '\r' || character === '\n') {
          cleanup()
          resolve(answer)
          return
        }
        if (character === '\u0008' || character === '\u007f') {
          answer = answer.slice(0, -1)
        } else if (character >= ' ') {
          answer += character
        }
      }
    }

    stdin.on('data', onData)
  })
}

try {
  const professorId = await prompt('Identificador local do professor: ')
  if (!professorId || professorId.length > 100) {
    throw new Error('O identificador deve ter entre 1 e 100 caracteres.')
  }
  const password = await promptHidden('Senha local de teste (entrada oculta): ')
  if (password.length < 12) {
    throw new Error('Use uma senha local de teste com pelo menos 12 caracteres.')
  }

  const passwordHash = await hashTestPassword(password)
  await pool.query(
    `INSERT INTO professor_teste (professor_id, senha_hash)
     VALUES ($1, $2)
     ON CONFLICT (professor_id)
     DO UPDATE SET senha_hash = EXCLUDED.senha_hash, criada_em = CURRENT_TIMESTAMP`,
    [professorId, passwordHash],
  )
  console.log(`Credencial local criada/atualizada para ${professorId}.`)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha ao cadastrar credencial local.')
  process.exitCode = 1
} finally {
  await pool.end()
}
