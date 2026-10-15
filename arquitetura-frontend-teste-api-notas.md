# Arquitetura em camadas — Frontend para testar a API de notas

**Versão:** 1.0  
**Base:** requisitos da API de cadastro de notas

## 1. Objetivo e escopo

Este documento descreve uma página web local para exercitar as operações da API de cadastro de notas. A página permite autenticar um professor para identificar o responsável pela auditoria, montar requisições, visualizar respostas e testar os fluxos de cadastro, consulta, atualização, listagem e exclusão lógica.

Esta ferramenta é um cliente de teste, não o portal de produção do professor. A autenticação local é simples e existe somente para identificar o professor nos registros de auditoria; não implementa autenticação institucional nem autorização por perfil. Em produção, essas responsabilidades continuam no portal do professor.

## 2. Visão geral

```text
Professor / pessoa testadora (na máquina local)
                 |
                 v
     Página local em Vue.js 3
       / Apresentação
       / Autenticação de teste
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
- tela de entrada do identificador do professor e da senha de teste;
- exibição do professor autenticado e ação para encerrar a sessão;
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
- autenticar e encerrar a sessão local de teste;
- manter o resultado da última chamada e o estado de carregamento.

Cada operação deve impedir envios acidentais duplicados enquanto estiver em andamento e limpar ou substituir resultados de forma previsível quando uma nova chamada começar. A interface deve confirmar a exclusão antes de enviar o `DELETE`.

### 3.3. Cliente da API

Centraliza as chamadas HTTP e o contrato usado pela tela:

- prefixo `/api/v1` e URL da API configuráveis por ambiente;
- serialização e leitura JSON;
- tipos para nota, comandos, paginação e erro `{ codigo, mensagem, detalhes }`;
- conversão explícita de respostas não-2xx em erros exibíveis;
- envio direto à API local, sem proxy ou chave de API;
- envio do token de sessão retornado após o login nas chamadas que precisam identificar o professor;
- tratamento de `204 No Content` sem tentar interpretar um corpo JSON.

Não duplicar regras de negócio como fonte de verdade no cliente. Validações simples no formulário ajudam a pessoa usuária, mas a API continua responsável por validar e rejeitar a entrada.

### 3.4. Autenticação local para auditoria

O fluxo de login usa um identificador de professor e uma senha de teste validados pela API local. Após autenticação, a API retorna uma sessão/token de curta duração associado ao identificador autenticado; o frontend mantém o token somente em memória e o envia nas chamadas para que a API registre o responsável pela operação. A API não usa esse login para conceder perfis ou permissões acadêmicas. Credenciais de teste devem ser criadas para uso local e não podem ser credenciais institucionais.

O frontend não deve tratar um identificador digitado no formulário de nota como prova de identidade. A identidade para auditoria deve ser derivada pela API da sessão/token autenticado, nunca de um campo livre ou cabeçalho arbitrário. O login usa `POST /api/v1/auth/sessao`; o encerramento usa `DELETE /api/v1/auth/sessao`. O formato e o prazo da sessão/token devem ser definidos no contrato OpenAPI.

### 3.5. Configuração local

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

1. O professor informa seu identificador e senha de teste na tela de login.
2. O cliente envia as credenciais ao endpoint de autenticação da API local.
3. A API valida as credenciais e devolve uma sessão/token de curta duração associado ao professor autenticado.
4. O professor seleciona uma operação e preenche os campos; a página verifica campos obrigatórios e limites básicos.
5. O caso de uso chama o cliente HTTP, que envia a requisição diretamente à API local com a sessão/token.
6. A API usa a identidade autenticada para auditoria e executa a operação, sem aplicar autorização por perfil.
7. A resposta volta à página, que apresenta status HTTP, JSON ou erro de forma legível.

## 6. Segurança e privacidade

- Executar a página e a API somente na máquina local; vincular os servidores a `localhost`/`127.0.0.1` e não expor portas à rede.
- Usar somente credenciais locais de teste, nunca credenciais institucionais.
- Não incluir senhas ou tokens no código, URL, `localStorage`, `sessionStorage` ou logs do navegador; manter o token apenas em memória e descartá-lo ao encerrar a sessão ou recarregar a página.
- Não incluir botões ou chamadas para produção na configuração da ferramenta.
- Se as portas forem diferentes, permitir CORS somente para a origem local da página. CORS não é mecanismo de autenticação nem substitui a restrição a loopback.
- Não tratar o login local como autenticação de produção ou autorização por perfil.
- Evitar manter dados acadêmicos além da sessão de teste e não registrar respostas com dados pessoais em ferramentas de telemetria.
- Exibir os dados devolvidos pela API sem inserir HTML não confiável na página.

## 7. Tratamento de erros e experiência de uso

A página deve diferenciar erros de transporte (API indisponível ou falha de rede) de respostas HTTP com erro. Quando a API retornar o formato padronizado, exibir `codigo`, `mensagem` e detalhes por campo; caso contrário, apresentar o status HTTP e uma mensagem genérica sem ocultar a falha. Não apresentar sucesso quando a chamada falhar.

Após operações de escrita, atualizar ou permitir recarregar as consultas relevantes para que o resultado exibido reflita o estado persistido. Para listagens, mostrar página atual e controles de navegação sem solicitar mais de 10 registros por página.

## 8. Testes recomendados

- Testes de componentes para campos, validações auxiliares, estado de carregamento e exibição de erros.
- Testes do cliente HTTP para métodos, caminhos, parâmetros de paginação, serialização, respostas não-2xx e `204`.
- Testes do fluxo de login, expiração/encerramento da sessão e envio da identidade autenticada para auditoria.
- Testes de integração com a API local para cada operação.
- Verificação de que frontend e API escutam somente em loopback e de que não são enviadas credenciais institucionais.
- Teste de acessibilidade dos formulários e mensagens de estado.

## 9. Decisões a fechar antes da implementação

As decisões de execução já estão definidas: página local em Vue.js 3, acesso somente por loopback, chamadas diretas à API sem proxy e login local simples do professor exclusivamente para auditoria, sem autorização por perfil. Permanecem pendentes:

1. Definir o formato e o prazo da sessão/token no contrato OpenAPI.
2. Definir como serão criadas e armazenadas as credenciais locais de teste na API, sem credenciais institucionais ou senhas embutidas no frontend.
3. Confirmar portas locais e configurar CORS para a origem exata do servidor de desenvolvimento, se necessário.
4. Finalizar o contrato OpenAPI das operações de notas, incluindo parâmetros de paginação e formatos de resposta.
