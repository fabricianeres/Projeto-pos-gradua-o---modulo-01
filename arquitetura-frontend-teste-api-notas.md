# Arquitetura em camadas — Frontend para testar a API de notas

**Versão:** 1.0  
**Base:** requisitos da API de cadastro de notas

## 1. Objetivo e escopo

Este documento descreve uma página web local para exercitar as operações da API de cadastro de notas. A página monta requisições, visualiza respostas e testa os fluxos de cadastro, consulta, atualização, listagem e exclusão lógica sem autenticação.

Esta ferramenta é um cliente de teste, não o portal de produção do professor. A API e o frontend não exigem autenticação e devem permanecer restritos à máquina local; não são adequados para produção.

## 2. Visão geral

```text
Professor / pessoa testadora (na máquina local)
                 |
                 v
     Página local em Vue.js 3
       / Apresentação
       / Estado e casos de uso
       / Cliente HTTP tipado
                   |
         HTTP/HTTPS para localhost
                   |
                   v
       API local de notas /api/v1
```

A página será implementada em Vue.js 3 e executada somente na máquina local. Ela chamará a API local diretamente, sem proxy; a URL base será configurada para `localhost`/`127.0.0.1`. A API também deve escutar somente na interface de loopback e não ser exposta à rede. Se frontend e API usarem portas diferentes, a API deve permitir via CORS somente a origem local da página. No MVP, não há chave de API.

## 3. Camadas do frontend

### 3.1. Apresentação

Responsável pela página e interação:

- seleção da operação a testar;
- formulários com campos adequados à rota selecionada;
- exibição de carregamento, sucesso, erro e conteúdo retornado;
- apresentação clara do status HTTP e do corpo JSON;
- controles para paginação das listagens.

Os formulários devem usar rótulos acessíveis e informar os limites relevantes: nota de 0 a 10, até uma casa decimal, N1 ou N2 e identificadores necessários. A interface deve exibir erros de validação por campo quando a API os fornecer.

### 3.2. Estado e casos de uso da página

Coordena os fluxos acionados pela interface, sem montar URLs nem acessar diretamente o transporte:

- cadastrar nota para uma oferta;
- consultar por identificador;
- listar notas de uma oferta ou de um estudante na oferta;
- atualizar parcialmente uma nota;
- excluir logicamente uma nota;
- manter o resultado da última chamada e o estado de carregamento.

Cada operação deve impedir envios acidentais duplicados enquanto estiver em andamento e limpar ou substituir resultados de forma previsível quando uma nova chamada começar. A interface deve confirmar a exclusão antes de enviar o `DELETE`.

### 3.3. Cliente da API

Centraliza as chamadas HTTP e o contrato usado pela tela:

- prefixo `/api/v1` e URL da API configuráveis por ambiente;
- serialização e leitura JSON;
- tipos para nota, comandos, paginação e erro `{ codigo, mensagem, detalhes }`;
- conversão explícita de respostas não-2xx em erros exibíveis;
- envio direto à API local, sem proxy ou chave de API;
- tratamento de `204 No Content` sem tentar interpretar um corpo JSON.

Não duplicar regras de negócio como fonte de verdade no cliente. Validações simples no formulário ajudam a pessoa usuária, mas a API continua responsável por validar e rejeitar a entrada.

### 3.4. Configuração local

Configura a URL base da API local por ambiente de execução. A aplicação de teste deve estar vinculada a `localhost`/`127.0.0.1`; não deve escutar em interfaces de rede externas nem disponibilizar chamadas para produção. A API deve permitir CORS apenas para a origem local efetivamente usada pelo servidor de desenvolvimento Vue, se as portas forem diferentes.

## 4. Operações e campos da interface

| Operação | Entrada principal | Resultado esperado |
|---|---|---|
| Cadastrar nota | `ofertaId`, `estudanteId`, `numeroNota` (1 ou 2), `valor`, observação opcional | `201 Created` e nota criada |
| Consultar nota | `notaId` | Nota encontrada ou erro informado |
| Listar notas da oferta | `ofertaId`, página e tamanho limitado a 10 | Lista paginada, incluindo média quando aplicável |
| Listar notas do estudante | `estudanteId`, `ofertaId`, página | Notas e média da oferta |
| Atualizar nota | `notaId` e propriedades que serão alteradas | Nota atualizada |
| Excluir logicamente | `notaId` e confirmação | `204 No Content`; nota deixa de aparecer em consultas regulares |

As rotas e o formato exato dos parâmetros devem ser obtidos do contrato OpenAPI publicado, evitando que a tela mantenha uma versão divergente da API.

## 5. Fluxo de uma chamada

1. A pessoa testadora seleciona uma operação e preenche os campos; a página verifica campos obrigatórios e limites básicos.
2. O caso de uso chama o cliente HTTP, que envia a requisição diretamente à API local sem credenciais.
3. A API executa a operação e atribui mutações ao ator técnico `api-local` nos registros de auditoria.
4. A resposta volta à página, que apresenta status HTTP, JSON ou erro de forma legível.

## 6. Segurança e privacidade

- Executar a página e a API somente na máquina local; vincular os servidores a `localhost`/`127.0.0.1` e não expor portas à rede.
- Não solicitar nem enviar senhas ou tokens.
- Não incluir botões ou chamadas para produção na configuração da ferramenta.
- Se as portas forem diferentes, permitir CORS somente para a origem local da página. CORS não é mecanismo de autenticação nem substitui a restrição a loopback.
- Não publicar o frontend ou a API na rede: as rotas aceitam requisições sem autenticação.
- Evitar manter dados acadêmicos além do necessário para o teste e não registrar respostas com dados pessoais em ferramentas de telemetria.
- Exibir os dados devolvidos pela API sem inserir HTML não confiável na página.

## 7. Tratamento de erros e experiência de uso

A página deve diferenciar erros de transporte (API indisponível ou falha de rede) de respostas HTTP com erro. Quando a API retornar o formato padronizado, exibir `codigo`, `mensagem` e detalhes por campo; caso contrário, apresentar o status HTTP e uma mensagem genérica sem ocultar a falha. Não apresentar sucesso quando a chamada falhar.

Após operações de escrita, atualizar ou permitir recarregar as consultas relevantes para que o resultado exibido reflita o estado persistido. Para listagens, mostrar página atual e controles de navegação sem solicitar mais de 10 registros por página.

## 8. Testes recomendados

- Testes de componentes para campos, validações auxiliares, estado de carregamento e exibição de erros.
- Testes do cliente HTTP para métodos, caminhos, parâmetros de paginação, serialização, respostas não-2xx e `204`.
- Testar chamadas às operações sem cabeçalho de autorização.
- Testes de integração com a API local para cada operação.
- Verificação de que frontend e API escutam somente em loopback e de que não são enviadas credenciais institucionais.
- Teste de acessibilidade dos formulários e mensagens de estado.

## 9. Decisões a fechar antes da implementação

As decisões de execução já estão definidas: página local em Vue.js 3, acesso somente por loopback, chamadas diretas à API sem proxy e sem autenticação. Permanecem pendentes:

1. Confirmar portas locais e configurar CORS para a origem exata do servidor de desenvolvimento, se necessário.
2. Finalizar o contrato OpenAPI das operações de notas, incluindo parâmetros de paginação e formatos de resposta.
