# Arquitetura em camadas — Backend da API de notas

**Versão:** 1.0  
**Base:** requisitos da API de cadastro de notas

## 1. Objetivo e escopo

Este documento propõe uma organização em camadas para implementar a API REST de cadastro de notas. A arquitetura não depende de uma linguagem, framework ou banco de dados específicos; essas tecnologias podem ser escolhidas durante a implementação sem alterar as responsabilidades descritas aqui.

A API atende ao portal do professor. Ela valida a existência da oferta e da matrícula e aplica as regras de negócio das notas. A autenticação do professor e a autorização por perfil permanecem sob responsabilidade do portal, conforme os requisitos. A página de testes descrita em `arquitetura-frontend-teste-api-notas.md` é uma interface de desenvolvimento e não substitui o portal de produção.

## 2. Visão geral

As dependências apontam para dentro: a camada de domínio não depende de HTTP, banco de dados, framework ou interface externa. As camadas externas traduzem as entradas e saídas e conectam os casos de uso às tecnologias concretas.

```text
Portal do professor / página de testes
                 |
                 v
       Borda HTTP e segurança
                 |
                 v
      Apresentação (rotas/DTOs)
                 |
                 v
       Aplicação (casos de uso)
                 |
                 v
           Domínio
                 |
                 v
       Portas e adaptadores
          /             \
         v               v
 Repositórios        Integrações
         \               /
          v             v
 Banco de dados    Serviço acadêmico
                   (oferta/matrícula)
```

## 3. Camadas e responsabilidades

### 3.1. Borda HTTP e segurança

Responsável por receber requisições HTTPS e aplicar controles transversais antes de encaminhá-las à aplicação:

- no MVP, não exigir nem validar chave de API;
- manter a API acessível somente em ambiente controlado, com restrição de rede e sem exposição pública;
- identificar a identidade do professor em um contexto confiável, quando fornecida pelo portal;
- atribuir identificador de correlação à requisição;
- aplicar limites de tamanho e, se necessário, de taxa;

O portal autentica o professor e aplica as permissões por perfil. A retirada da chave no MVP não transfere essas responsabilidades para a API nem deve resultar em exposição pública do serviço. A identidade do professor usada na auditoria não deve ser aceita de um cabeçalho arbitrário enviado diretamente pelo navegador. O mecanismo confiável de propagação dessa identidade (por exemplo, token assinado validado pela API ou infraestrutura de gateway protegida) é uma decisão pendente e deve ser definido antes da implementação. Não registrar tokens, credenciais ou outros segredos nos logs.

### 3.2. Apresentação

Responsável pelo contrato REST versionado em `/api/v1`:

- declarar rotas, métodos, parâmetros e esquemas JSON;
- converter a requisição para comandos ou consultas da aplicação;
- validar estrutura e tipos da entrada, inclusive propriedades desconhecidas;
- converter os resultados em respostas HTTP;
- mapear erros conhecidos para o formato consistente de erro da API.

Rotas previstas:

| Método | Rota | Responsabilidade |
|---|---|---|
| `POST` | `/api/v1/ofertas/{ofertaId}/notas` | Cadastrar N1 ou N2 |
| `GET` | `/api/v1/notas/{notaId}` | Consultar uma nota |
| `GET` | `/api/v1/ofertas/{ofertaId}/notas` | Listar notas da oferta |
| `GET` | `/api/v1/estudantes/{estudanteId}/notas?ofertaId={ofertaId}` | Listar notas do estudante na oferta |
| `PATCH` | `/api/v1/notas/{notaId}` | Atualizar parcialmente uma nota |
| `DELETE` | `/api/v1/notas/{notaId}` | Excluir logicamente uma nota |

As listagens devem aceitar paginação e retornar no máximo 10 registros por página. Os parâmetros de paginação e ordenação devem ser documentados no OpenAPI.

### 3.3. Aplicação

Responsável por coordenar os casos de uso, sem conter detalhes de protocolo ou persistência:

- `CadastrarNota`: valida oferta e matrícula, impede duplicidade de N1/N2 e persiste a nota;
- `ConsultarNota`: recupera uma nota ativa;
- `ListarNotasDaOferta` e `ListarNotasDoEstudante`: consultam dados paginados e calculam a média quando aplicável;
- `AtualizarNota`: aplica a atualização parcial permitida e registra auditoria;
- `ExcluirNotaLogicamente`: marca a nota como excluída sem apagar o registro;
- `RegistrarAcesso`: registra o acesso conforme a política de auditoria.

Os casos de uso coordenam transações quando a alteração da nota e seu evento de auditoria precisam ser persistidos juntos. A camada também decide quais portas de repositório ou integração chamar e trata conflitos de persistência como erros de negócio conhecidos.

### 3.4. Domínio

Responsável pelas regras acadêmicas que devem ser verdadeiras independentemente da tecnologia:

- nota válida entre 0 e 10, inclusive, com no máximo uma casa decimal;
- posição restrita a N1 ou N2;
- no máximo uma nota de cada posição por estudante e oferta;
- média calculada somente quando N1 e N2 existem e estão ativas;
- arredondamento aritmético da média para uma casa decimal;
- exclusão lógica, mantendo o histórico;
- bloqueio de escrita quando o lançamento estiver encerrado, se essa informação estiver disponível.

Entidades e conceitos principais: `Nota`, `Matricula`, `OfertaDisciplina`, `PosicaoNota` e `EventoAuditoria`. O domínio não decide autenticação por perfil, que pertence ao portal.

### 3.5. Infraestrutura e adaptadores

Implementa as portas definidas para a aplicação:

- repositórios para notas e eventos de auditoria;
- adaptador de integração para consultar a existência da oferta e da matrícula no sistema acadêmico;
- unidade de trabalho/transação para gravar nota e auditoria de forma consistente;
- mecanismo de paginação e ordenação estável;
- implementação de relógio em UTC;
- configuração de logs, métricas e armazenamento.

A camada de domínio e os casos de uso dependem de interfaces; a infraestrutura fornece as implementações concretas. Uma restrição única no armazenamento deve proteger a combinação estudante, oferta e posição da nota, inclusive sob requisições simultâneas. O desenho do armazenamento deve permitir exclusão lógica sem perder o registro nem o histórico.

## 4. Fluxo de cadastro

1. O cliente envia `POST /api/v1/ofertas/{ofertaId}/notas` por HTTPS.
2. A borda recebe a chamada somente por uma origem/rede autorizada e obtém, de contexto confiável, a identidade do professor para auditoria, se disponível.
3. A apresentação valida o formato e cria o comando de cadastro.
4. O caso de uso consulta a oferta e a matrícula pelo adaptador acadêmico.
5. O domínio valida posição e valor; o repositório verifica duplicidade.
6. Em uma transação, o sistema persiste a nota e o evento de criação com responsável e horário UTC.
7. A apresentação retorna `201 Created` com o recurso criado. Erros conhecidos são mapeados para o código HTTP e o esquema de erro documentados.

## 5. Persistência e auditoria

O modelo persistido deve representar a nota, sua situação ativa/excluída e os eventos de auditoria. Cada evento deve conter, conforme o tipo de operação, recurso, tipo de evento, responsável autenticado pelo portal, instante UTC e alterações relevantes (por exemplo, valor anterior e novo). A auditoria de acesso não deve registrar segredos ou conteúdo desnecessário.

Consultas regulares não devem retornar notas excluídas logicamente nem incluí-las no cálculo da média. A retenção de auditoria segue o requisito de tempo indeterminado. Erros ao registrar auditoria devem ser tratados explicitamente; uma alteração não deve aparentar sucesso se a persistência transacional exigida falhar.

## 6. Erros, documentação e observabilidade

- Publicar o contrato em OpenAPI, incluindo parâmetros, esquemas, paginação e respostas de erro; documentar que o MVP não exige chave de API.
- Usar o formato consistente `{ codigo, mensagem, detalhes }` para erros de validação e negócio.
- Mapear erros de forma previsível: `400` para entrada malformada, `404` para recurso inexistente conforme a política, `409` para duplicidade, `422` para regra incompatível e `500` para falha inesperada.
- Não expor stack traces ou detalhes internos em respostas `500`.
- Registrar erros e métricas operacionais sem dados pessoais ou segredos; usar identificador de correlação para relacionar logs.
- Monitorar disponibilidade e latência conforme os limites especificados nos requisitos.

## 7. Testes recomendados

- **Domínio:** limites e precisão da nota, posição, duplicidade, exclusão lógica e cálculo/arredondamento da média.
- **Aplicação:** casos de uso com portas substituídas por implementações de teste, incluindo falhas de oferta, matrícula, persistência e auditoria.
- **Contrato/API:** códigos HTTP, esquemas JSON, erros e paginação conforme OpenAPI.
- **Integração:** persistência transacional, restrição contra duplicidade concorrente e integração com o sistema acadêmico.
- **Ponta a ponta:** operações chamadas pela página de testes em ambiente não produtivo.

## 8. Decisões a fechar antes da implementação

1. Linguagem, framework HTTP, banco de dados e mecanismo de migração.
2. Como validar oferta e matrícula (acesso ao mesmo banco ou serviço acadêmico).
3. Como transmitir e validar com segurança a identidade do professor autenticado pelo portal.
4. Controles de rede e ambientes que limitarão o acesso à API sem chave no MVP.
5. Parâmetros exatos de paginação, ordenação e política de exposição de recursos inexistentes.
