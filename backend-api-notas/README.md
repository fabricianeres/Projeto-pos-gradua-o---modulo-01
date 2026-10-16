# Backend — API de cadastro de notas

API em camadas com Node.js, TypeScript, Express e PostgreSQL, conforme [arquitetura-backend-api-notas.md](../arquitetura-backend-api-notas.md). As rotas não exigem autenticação; a API é exclusivamente local e não implementa autorização por perfil.

## Requisitos

- Node.js 20.19+ ou 22.12+
- npm
- PostgreSQL 16 instalado e em execução localmente

## Inicialização local

Crie um usuário e um banco de dados locais no PostgreSQL. Por exemplo, conecte-se como administrador pelo `psql` ou pgAdmin e execute:

```sql
CREATE ROLE notas_app WITH LOGIN PASSWORD 'defina-uma-senha-local';
CREATE DATABASE notas_dev OWNER notas_app;
```

Copie `.env.example` para `.env` e ajuste `DATABASE_URL` com a senha definida. Se a senha contiver caracteres especiais, codifique-os para uso na URL. O exemplo usa a porta padrão `5432`; ajuste-a se o PostgreSQL local estiver configurado em outra porta.

Depois, execute os comandos abaixo no PowerShell, dentro desta pasta:

```powershell
npm install
Copy-Item .env.example .env
npm run db:migrate
npm run db:seed
npm run enrollment:seed -- estudante-456 oferta-123 ATIVA
npm run dev
```

O servidor escuta por padrão em `http://127.0.0.1:3000`. Ele valida a configuração e se recusa a iniciar se `HOST` não for `localhost`, `127.0.0.1` ou `::1`. O Vite do frontend local usa a origem `http://127.0.0.1:5173`; `FRONTEND_ORIGINS` pode ser ajustado para a origem local necessária. Não altere a configuração para disponibilizar a API pela rede no MVP: as rotas não têm autenticação.

O comando `enrollment:seed` existe para desenvolvimento local. Em um ambiente integrado, `matricula` deve ser uma projeção somente leitura sincronizada do sistema acadêmico. A API não cadastra matrícula nem oferta.

`npm run db:seed` insere uma carga sintética e repetível na oferta `oferta-teste-2026-1`: 12 matrículas ativas e até 24 notas (N1/N2), com auditoria para as notas criadas. Reexecutar não duplica as notas ativas. Os identificadores `estudante-001` a `estudante-012` são fictícios e destinados somente a testes locais. As notas já inseridas não são sobrescritas; para repetir testes de alteração/exclusão, use a API com outro banco local descartável ou remova os dados de demonstração manualmente após avaliar seus efeitos.

O arquivo [`test-data/massa-teste.json`](./test-data/massa-teste.json) contém uma massa fictícia com cenários de médias, valores-limite, nota ausente e matrícula inativa, além de casos inválidos esperados. Carregue matrículas e notas iniciais com `npm run db:seed:test-data`. O comando pode ser reexecutado: atualiza o estado das matrículas desta oferta, mas não substitui notas ativas já existentes. Os cenários adicionais no JSON servem para verificar respostas de erro e não são inseridos.

Para cadastrar manualmente uma nota pela API, o estudante precisa ter matrícula `ATIVA` na oferta. Sem esse vínculo, a API retorna `422 MATRICULA_INATIVA`; carregue a massa de teste ou cadastre a matrícula local antes de enviar a nota. Isso preserva a regra de negócio e evita inserir notas sem matrícula.

## Operações

O contrato completo está em [`openapi.yaml`](./openapi.yaml) e é servido também em `GET /api/v1/openapi.yaml`. Rotas principais:

- `POST /api/v1/ofertas/{ofertaId}/notas`;
- `GET /api/v1/notas/{notaId}`;
- `GET /api/v1/ofertas/{ofertaId}/notas`;
- `GET /api/v1/estudantes/{estudanteId}/notas?ofertaId={ofertaId}`;
- `PATCH /api/v1/notas/{notaId}`;
- `DELETE /api/v1/notas/{notaId}` — exclusão lógica;
- `GET /api/v1/health`.

As rotas de notas não exigem login nem cabeçalho de autorização. A auditoria atribui mutações ao identificador técnico `api-local`, não a um professor autenticado. As listas aceitam `pagina` e `tamanhoPagina` de 1 a 10 (padrão 10) e retornam ordenação estável, `itens`, `pagina`, `tamanhoPagina` e `temProximaPagina`.

O armazenamento garante atomicamente a gravação da nota e da auditoria de negócio, impede duplicidade concorrente com índice único parcial e mantém logs de acesso. A auditoria é imutável por trigger. Registros de acesso são tentados após a resposta; falhas são reportadas no log de servidor com `requestId`. Nenhum segredo ou corpo da requisição é escrito no log.

## Integração com o frontend

Configure o frontend `VITE_API_BASE_URL=http://127.0.0.1:3000/api/v1`. O frontend chama diretamente as rotas de notas sem credenciais. CORS permite por padrão somente as duas origens locais de desenvolvimento definidas em `.env.example`.

## Validação

```powershell
npm test
npm run build
```

O projeto inclui testes de domínio para escala, precisão, posição N1/N2 e cálculo/arredondamento da média. Testes de integração exigem PostgreSQL local.
