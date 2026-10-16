# Frontend local — API de cadastro de notas

Aplicação de teste em Vue.js 3 + TypeScript + Vite, conforme [arquitetura-frontend-teste-api-notas.md](../arquitetura-frontend-teste-api-notas.md). A página chama a API diretamente, não usa proxy, não contém chave de API e não solicita login.

## Executar

Requer Node.js 20.19+ ou 22.12+.

```powershell
Set-Location frontend-api-notas
npm install
Copy-Item .env.example .env.local
npm run dev
```

Abra `http://127.0.0.1:5173`. O servidor de desenvolvimento e o preview do Vite estão vinculados a loopback. A API também deve escutar somente em `localhost`/`127.0.0.1`.

O padrão da URL da API é `http://127.0.0.1:3000/api/v1`. Ajuste `VITE_API_BASE_URL` em `.env.local` para a porta local real da API. A aplicação recusa hosts diferentes de `localhost`, `127.0.0.1` ou `::1`. Se frontend e API estiverem em portas diferentes, permita CORS somente para `http://127.0.0.1:5173` na API.

## Contrato esperado da API

O contrato OpenAPI publicado pelo backend está em [`backend-api-notas/openapi.yaml`](../backend-api-notas/openapi.yaml) e é servido pela API em `GET /api/v1/openapi.yaml`. A implementação usa as seguintes convenções:

- Cadastro: `POST /ofertas/{ofertaId}/notas` com `estudanteId`, `numeroNota`, `valor` e `observacao` opcional.
- Atualização: `PATCH /notas/{notaId}` com `valor` e/ou `observacao`.
- Listagens: parâmetros `pagina` e `tamanhoPagina`; o frontend fixa o tamanho máximo em 10. A resposta pode indicar próxima página por `temProximaPagina` ou `hasNext`, e total de páginas por `totalPaginas` ou `totalPages`.
- Erro: `{ "codigo": "...", "mensagem": "...", "detalhes": [{ "campo": "...", "mensagem": "..." }] }`.

A interface mostra o corpo JSON de sucesso sem impor uma forma específica ao modelo da nota. As rotas não exigem autenticação; a auditoria identifica as mutações pelo ator técnico `api-local`.

## Limites do MVP

- O frontend e a API aceitam chamadas sem autenticação. Não publique a página nem a API na rede; mantenha ambas restritas a loopback e use somente dados de teste locais.
