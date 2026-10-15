# Arquitetura em camadas — Frontend para testar a API de notas

**Versão:** 1.0  
**Base:** requisitos da API de cadastro de notas

## 1. Objetivo e escopo

Este documento propõe uma página web simples para exercitar, em ambiente de desenvolvimento ou homologação, as operações da API de cadastro de notas. A página permite montar requisições, visualizar respostas e confirmar os fluxos de cadastro, consulta, atualização, listagem e exclusão lógica.

Esta ferramenta é um cliente de teste, não o portal de produção do professor. Não implementa autenticação institucional nem autorização por perfil. Em produção, essas responsabilidades continuam no portal do professor.

## 2. Visão geral

```text
Pessoa desenvolvedora / testadora
                 |
                 v
     Página de teste (navegador)
       / Apresentação
       / Estado e casos de uso
       /        Cliente HTTP tipado
                   |
         HTTPS para ambiente de teste
                   |
                   v
            API de notas /api/v1
```

No MVP, a API não exige chave de API, portanto a página pode chamá-la diretamente por HTTPS em ambiente de teste. A API deve permanecer restrita a desenvolvimento/homologação e não ser publicada com acesso irrestrito. Um proxy pode ser usado se necessário para encaminhamento de rede ou configuração de CORS, mas não é necessário para proteger uma chave. CORS limita origens de navegador, mas não substitui controle de acesso à rede.

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
- envio direto à API de teste por HTTPS; quando houver proxy por necessidade de rede/CORS, encaminhar sem injetar chave de API;
- tratamento de `204 No Content` sem tentar interpretar um corpo JSON.

Não duplicar regras de negócio como fonte de verdade no cliente. Validações simples no formulário ajudam a pessoa usuária, mas a API continua responsável por validar e rejeitar a entrada.

### 3.4. Configuração e infraestrutura de teste

Configura por ambiente a URL do frontend e a URL da API de teste. Se for necessário um proxy por restrição de rede ou CORS, configurá-lo somente para desenvolvimento/homologação, limitar origens e rotas e não publicá-lo como ponto de acesso irrestrito.

Se a API exigir a identidade autenticada do professor para auditoria, os testes devem usar o mecanismo de identidade de teste definido pela API, exclusivamente em ambiente não produtivo. Não aceitar um identificador de professor arbitrário fornecido pelo formulário como identidade confiável.

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

1. A pessoa seleciona uma operação e preenche os campos.
2. A página verifica campos obrigatórios e limites básicos para oferecer retorno imediato.
3. O caso de uso chama o cliente HTTP com dados tipados.
4. O cliente envia a requisição diretamente à API de teste por HTTPS (ou ao proxy restrito, se necessário).
5. A API recebe a chamada no ambiente controlado, sem validação de chave no MVP.
6. A resposta volta à página, que apresenta status HTTP, JSON ou erro de forma legível.

## 6. Segurança e privacidade

- Executar a página somente em desenvolvimento ou homologação, salvo uma decisão explícita de produto e segurança.
- Não incluir credenciais institucionais, tokens ou outros segredos em código frontend, URL, `localStorage`, `sessionStorage` ou logs do navegador.
- Não incluir botões ou chamadas para produção na configuração padrão da ferramenta.
- Usar HTTPS nos ambientes remotos e restringir CORS às origens necessárias; CORS não substitui controles de rede nem autenticação do portal.
- Evitar manter dados acadêmicos além da sessão de teste e não registrar respostas com dados pessoais em ferramentas de telemetria.
- Exibir os dados devolvidos pela API sem inserir HTML não confiável na página.

## 7. Tratamento de erros e experiência de uso

A página deve diferenciar erros de transporte (API indisponível ou falha de rede) de respostas HTTP com erro. Quando a API retornar o formato padronizado, exibir `codigo`, `mensagem` e detalhes por campo; caso contrário, apresentar o status HTTP e uma mensagem genérica sem ocultar a falha. Não apresentar sucesso quando a chamada falhar.

Após operações de escrita, atualizar ou permitir recarregar as consultas relevantes para que o resultado exibido reflita o estado persistido. Para listagens, mostrar página atual e controles de navegação sem solicitar mais de 10 registros por página.

## 8. Testes recomendados

- Testes de componentes para campos, validações auxiliares, estado de carregamento e exibição de erros.
- Testes do cliente HTTP para métodos, caminhos, parâmetros de paginação, serialização, respostas não-2xx e `204`.
- Testes de integração com a API em ambiente não produtivo para cada operação.
- Verificação de que a página de testes não envia credenciais institucionais ou tokens indevidos.
- Teste de acessibilidade dos formulários e mensagens de estado.

## 9. Decisões a fechar antes da implementação

1. Se a página será executada localmente ou publicada em ambiente de homologação restrito.
2. Tecnologia frontend e necessidade de proxy por restrição de rede ou CORS.
3. Origem permitida, política de acesso à ferramenta e forma de proteger o proxy.
4. Fixture ou mecanismo seguro para testar a identidade do professor exigida para auditoria.
5. Contrato OpenAPI definitivo, incluindo parâmetros de paginação e formatos de resposta.
