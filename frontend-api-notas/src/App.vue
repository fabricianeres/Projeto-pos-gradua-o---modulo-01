<script setup lang="ts">
import { computed, ref } from 'vue'
import { api } from './api'
import type {
  ApiProblem,
  ApiResult,
  CreateNoteRequest,
  UpdateNoteRequest,
} from './types'

type Operation = 'create' | 'get' | 'offer-list' | 'student-list' | 'update' | 'delete'

const busy = ref(false)
const operationError = ref<ApiProblem | null>(null)
const result = ref<ApiResult | null>(null)
const selectedOperation = ref<Operation>('create')

const offerId = ref('')
const studentId = ref('')
const noteId = ref('')
const noteNumber = ref<1 | 2>(1)
const grade = ref('')
const observation = ref('')
const page = ref(1)
const pageSize = 10

const operationTitle = computed(() => {
  const titles: Record<Operation, string> = {
    create: 'Cadastrar nota',
    get: 'Consultar nota',
    'offer-list': 'Listar notas da oferta',
    'student-list': 'Listar notas do estudante',
    update: 'Atualizar nota',
    delete: 'Excluir nota',
  }
  return titles[selectedOperation.value]
})

const hasNextPage = computed(() => {
  if (selectedOperation.value !== 'offer-list' && selectedOperation.value !== 'student-list') {
    return false
  }

  const responseBody = result.value?.body
  if (!responseBody || typeof responseBody !== 'object') {
    return true
  }

  const metadata = responseBody as Record<string, unknown>
  if (typeof metadata.temProximaPagina === 'boolean') return metadata.temProximaPagina
  if (typeof metadata.hasNext === 'boolean') return metadata.hasNext
  if (typeof metadata.totalPaginas === 'number') return page.value < metadata.totalPaginas
  if (typeof metadata.totalPages === 'number') return page.value < metadata.totalPages
  return true
})

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? ''
}

function reportError(error: unknown): ApiProblem {
  if (error instanceof Error) return error as ApiProblem
  return new Error('Ocorreu um erro inesperado.') as ApiProblem
}

function selectOperation(operation: Operation): void {
  selectedOperation.value = operation
  operationError.value = null
  result.value = null
  page.value = 1
}

function requireValue(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`Preencha o campo ${label}.`)
  return encodeURIComponent(trimmed)
}

function gradeValue(): number {
  const parsed = Number(grade.value.replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10 || !/^\d+([.,]\d)?$/.test(grade.value.trim())) {
    throw new Error('A nota deve ser um número entre 0 e 10 com no máximo uma casa decimal.')
  }
  return parsed
}

async function runOperation(): Promise<void> {
  busy.value = true
  operationError.value = null
  result.value = null

  try {
    let response: ApiResult
    switch (selectedOperation.value) {
      case 'create': {
        const payload: CreateNoteRequest = {
          estudanteId: studentId.value.trim(),
          numeroNota: noteNumber.value,
          valor: gradeValue(),
          ...(observation.value.trim() ? { observacao: observation.value.trim() } : {}),
        }
        if (!payload.estudanteId) throw new Error('Preencha o campo estudante.')
        response = await api.execute(
          `/ofertas/${requireValue(offerId.value, 'oferta')}/notas`,
          'POST',
          payload,
        )
        break
      }
      case 'get':
        response = await api.execute(
          `/notas/${requireValue(noteId.value, 'identificador da nota')}`,
          'GET',
        )
        break
      case 'offer-list':
        response = await api.execute(
          `/ofertas/${requireValue(offerId.value, 'oferta')}/notas?pagina=${page.value}&tamanhoPagina=${pageSize}`,
          'GET',
        )
        break
      case 'student-list':
        response = await api.execute(
          `/estudantes/${requireValue(studentId.value, 'estudante')}/notas?ofertaId=${requireValue(offerId.value, 'oferta')}&pagina=${page.value}&tamanhoPagina=${pageSize}`,
          'GET',
        )
        break
      case 'update': {
        const payload: UpdateNoteRequest = {}
        if (grade.value.trim()) payload.valor = gradeValue()
        if (observation.value.trim()) payload.observacao = observation.value.trim()
        if (Object.keys(payload).length === 0) {
          throw new Error('Informe ao menos o novo valor ou uma observação para atualizar.')
        }
        response = await api.execute(
          `/notas/${requireValue(noteId.value, 'identificador da nota')}`,
          'PATCH',
          payload,
        )
        break
      }
      case 'delete': {
        const targetId = requireValue(noteId.value, 'identificador da nota')
        if (!window.confirm('Confirma a exclusão lógica desta nota?')) return
        response = await api.execute(`/notas/${targetId}`, 'DELETE')
        break
      }
    }
    result.value = response
  } catch (error) {
    operationError.value = reportError(error)
  } finally {
    busy.value = false
  }
}

async function changePage(direction: -1 | 1): Promise<void> {
  if (busy.value) return
  const nextPage = page.value + direction
  if (nextPage < 1 || (direction > 0 && !hasNextPage.value)) return
  page.value = nextPage
  await runOperation()
}
</script>

<template>
  <main class="page-shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Teste local da API de notas">
        <span class="brand-mark" aria-hidden="true">N</span>
        <span>Notas<span class="brand-light"> / API local</span></span>
      </a>
      <span class="environment"><span class="status-dot"></span> ambiente local</span>
    </header>

    <section class="intro">
      <p class="eyebrow">FERRAMENTA DE DESENVOLVIMENTO</p>
      <h1>Teste a API de notas</h1>
      <p class="intro-copy">Execute operações de cadastro e consulta usando a API local. As requisições não exigem login; mantenha a ferramenta e a API restritas ao ambiente local.</p>
    </section>

    <section class="workspace">
        <nav class="operation-nav" aria-label="Operações da API">
          <p class="nav-label">OPERAÇÕES</p>
          <button :class="{ active: selectedOperation === 'create' }" @click="selectOperation('create')"><span class="nav-icon">＋</span>Cadastrar nota</button>
          <button :class="{ active: selectedOperation === 'get' }" @click="selectOperation('get')"><span class="nav-icon">⌕</span>Consultar nota</button>
          <button :class="{ active: selectedOperation === 'offer-list' }" @click="selectOperation('offer-list')"><span class="nav-icon">▤</span>Notas da oferta</button>
          <button :class="{ active: selectedOperation === 'student-list' }" @click="selectOperation('student-list')"><span class="nav-icon">♙</span>Notas do estudante</button>
          <span class="nav-divider"></span>
          <button :class="{ active: selectedOperation === 'update' }" @click="selectOperation('update')"><span class="nav-icon">✎</span>Atualizar nota</button>
          <button :class="{ active: selectedOperation === 'delete' }" @click="selectOperation('delete')"><span class="nav-icon">⌫</span>Excluir nota</button>
        </nav>

        <section class="panel operation-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">REQUISIÇÃO</p>
              <h2>{{ operationTitle }}</h2>
            </div>
            <span class="method-badge" :class="`method-${selectedOperation}`">{{ selectedOperation === 'create' ? 'POST' : selectedOperation === 'get' || selectedOperation.endsWith('list') ? 'GET' : selectedOperation === 'update' ? 'PATCH' : 'DELETE' }}</span>
          </div>

          <form class="form-grid operation-form" @submit.prevent="runOperation">
            <template v-if="selectedOperation === 'create'">
              <label class="field">
                <span>Oferta <b>*</b></span>
                <input v-model="offerId" required placeholder="Identificador da oferta" />
              </label>
              <label class="field">
                <span>Estudante <b>*</b></span>
                <input v-model="studentId" required placeholder="Identificador do estudante" />
              </label>
              <label class="field">
                <span>Nota institucional <b>*</b></span>
                <select v-model.number="noteNumber">
                  <option :value="1">N1</option>
                  <option :value="2">N2</option>
                </select>
              </label>
              <label class="field">
                <span>Valor <b>*</b></span>
                <input v-model="grade" inputmode="decimal" required placeholder="0,0 a 10,0" />
                <small>De 0 a 10, até uma casa decimal.</small>
              </label>
              <label class="field field-full">
                <span>Observação <small>(opcional)</small></span>
                <textarea v-model="observation" rows="3" maxlength="500" placeholder="Informação adicional sobre a nota"></textarea>
              </label>
            </template>

            <template v-else-if="selectedOperation === 'get' || selectedOperation === 'update' || selectedOperation === 'delete'">
              <label class="field field-full">
                <span>Identificador da nota <b>*</b></span>
                <input v-model="noteId" required placeholder="Identificador retornado no cadastro" />
              </label>
              <template v-if="selectedOperation === 'update'">
                <label class="field">
                  <span>Novo valor <small>(opcional)</small></span>
                  <input v-model="grade" inputmode="decimal" placeholder="0,0 a 10,0" />
                  <small>Deixe em branco se não for alterar o valor.</small>
                </label>
                <label class="field">
                  <span>Nova observação <small>(opcional)</small></span>
                  <input v-model="observation" maxlength="500" placeholder="Observação atualizada" />
                </label>
              </template>
              <div v-if="selectedOperation === 'delete'" class="notice warning field-full">
                A exclusão é lógica: o registro e a auditoria são preservados, mas a nota deixa de aparecer nas consultas regulares.
              </div>
            </template>

            <template v-else-if="selectedOperation === 'offer-list'">
              <label class="field field-full">
                <span>Oferta <b>*</b></span>
                <input v-model="offerId" required placeholder="Identificador da oferta" />
              </label>
            </template>

            <template v-else>
              <label class="field">
                <span>Estudante <b>*</b></span>
                <input v-model="studentId" required placeholder="Identificador do estudante" />
              </label>
              <label class="field">
                <span>Oferta <b>*</b></span>
                <input v-model="offerId" required placeholder="Identificador da oferta" />
              </label>
            </template>

            <div class="form-actions field-full">
              <span v-if="selectedOperation === 'offer-list' || selectedOperation === 'student-list'" class="helper-text">Página {{ page }} · até {{ pageSize }} registros</span>
              <span v-else class="helper-text">Campos marcados com * são obrigatórios.</span>
              <button class="button primary" type="submit" :disabled="busy">
                {{ busy ? 'Enviando…' : 'Enviar requisição' }}
              </button>
            </div>
          </form>

          <div v-if="operationError" class="error-box" role="alert">
            <strong>{{ operationError.code ? `${operationError.code} — ` : '' }}{{ operationError.message }}</strong>
            <p v-if="operationError.status">HTTP {{ operationError.status }}</p>
            <ul v-if="operationError.details?.length">
              <li v-for="(detail, index) in operationError.details" :key="`${detail.campo ?? 'campo'}-${index}`">
                <strong v-if="detail.campo">{{ detail.campo }}:</strong> {{ detail.mensagem }}
              </li>
            </ul>
          </div>

          <section v-if="result" class="response" aria-live="polite">
            <div class="response-heading">
              <div>
                <p class="eyebrow">RESPOSTA DA API</p>
                <h3>Resultado</h3>
              </div>
              <span class="status-badge" :class="result.status < 300 ? 'success' : 'neutral'">HTTP {{ result.status }}</span>
            </div>
            <pre v-if="result.body !== null">{{ formatJson(result.body) }}</pre>
            <p v-else class="empty-response">Sem conteúdo na resposta.</p>
            <div v-if="selectedOperation === 'offer-list' || selectedOperation === 'student-list'" class="pagination">
              <button class="button subtle" :disabled="page <= 1 || busy" @click="changePage(-1)">← Anterior</button>
              <span>Página {{ page }}</span>
              <button class="button subtle" :disabled="!hasNextPage || busy" @click="changePage(1)">Próxima →</button>
            </div>
          </section>
        </section>
    </section>

    <footer class="footer">
      <span>API de cadastro de notas · ferramenta de desenvolvimento</span>
      <span>Somente localhost</span>
    </footer>
  </main>
</template>
