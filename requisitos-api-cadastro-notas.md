# Documento de Requisitos — API de Cadastro de Notas

**Versão:** 1.0  
**Data:** 14/10/2026  
**Status:** Proposta

## 1. Objetivo

Definir os requisitos de uma API para cadastrar, consultar, atualizar e remover notas de estudantes matriculados em uma disciplina. A API deve garantir que cada nota esteja associada ao estudante e à disciplina corretos, respeitando as regras acadêmicas e mantendo o histórico das alterações.

## 2. Escopo

### Incluído

- Cadastro e manutenção de notas de estudantes em disciplinas.
- Consulta das notas por estudante e por disciplina.
- Validação da matrícula, da disciplina e dos valores informados.
- Registro de auditoria das alterações.

### Fora do escopo

- Cadastro de estudantes, disciplinas, docentes ou matrículas.
- Criação de períodos letivos e turmas.
- Cálculo de frequência, aprovação ou reprovação.
- Emissão de boletins ou integração com sistemas externos.

Esses dados são considerados previamente existentes em sistemas acadêmicos ou serviços integrados.

Em produção, o consumo da API será feito pelo portal do professor. Para o MVP, haverá também uma página local de testes em Vue.js 3, que chamará diretamente a API local sem proxy ou chave de API. A autenticação local simples dessa página serve exclusivamente para identificar o professor nos registros de auditoria; não implementa autorização por perfil. Em produção, a autenticação institucional e o controle de acesso por perfil continuam sendo responsabilidade do portal.

## 3. Premissas e termos

- A API será REST e utilizará JSON; no MVP local, HTTP é permitido exclusivamente em `localhost`/`127.0.0.1`. Qualquer acesso remoto exige HTTPS e reavaliação dos controles de segurança.
- Uma nota pertence a um estudante matriculado em uma disciplina.
- Nesta proposta, a escala de notas é de **0 a 10**, inclusive, com até uma casa decimal (por exemplo, 8,5).
- A instituição utiliza somente duas notas por estudante em cada oferta de disciplina: N1 e N2.
- A média do estudante na oferta é a média aritmética de N1 e N2 e é calculada quando ambas estiverem cadastradas e ativas.
- Cada estudante pode ter no máximo uma N1 e uma N2 por oferta de disciplina.
- “Oferta de disciplina” identifica a disciplina em uma turma e período letivo específicos. Se o sistema não utilizar ofertas, o identificador da disciplina deve cumprir esse papel.
- Os identificadores de estudantes e disciplinas são fornecidos pelos sistemas responsáveis por esses cadastros.
- No MVP, a página de testes e a API executam localmente e aceitam conexões somente por `localhost`/`127.0.0.1`.
- A página usa credenciais locais de teste, distintas das credenciais institucionais, para autenticar o professor exclusivamente para auditoria.

## 4. Sistema consumidor

| Sistema | Responsabilidade |
|---|---|
| Portal do professor | Consumir a API para cadastrar, consultar, atualizar e remover notas, aplicando o controle de acesso por perfil e as permissões dos usuários. |
| Página local de testes (MVP) | Exercitar as operações da API local; autenticar com credenciais exclusivas de teste para identificar o professor na auditoria, sem autorização por perfil. |

A API não implementa autorização por perfil nem acesso direto para estudantes ou administradores. Ela valida a existência da oferta e da matrícula, os dados enviados e as regras de negócio. No MVP, a API deve escutar somente em loopback, não exigir chave de API e exigir uma sessão local válida nas operações de notas para identificar o responsável pela auditoria. A sessão local não concede permissões acadêmicas.

## 5. Requisitos funcionais

### RF-01 — Cadastrar nota

O sistema deve permitir que o portal do professor ou, no MVP, a página local de testes com sessão válida cadastre uma nota informando:

- identificador da oferta de disciplina;
- identificador do estudante;
- número da nota institucional (1 para N1 ou 2 para N2);
- valor da nota;
- observação opcional.

Ao cadastrar, a API deve confirmar que a oferta existe e que o estudante está matriculado nela. Em produção, a autorização do usuário para lançar notas é verificada pelo portal do professor, fora do escopo da API. No MVP local, o login serve apenas para identificar o professor na auditoria e não executa autorização.

O cadastro deve registrar para auditoria o identificador do professor autenticado no portal como responsável, além da data e hora da operação.

### RF-02 — Consultar nota

O sistema deve permitir consultar uma nota pelo seu identificador e listar notas:

- de um estudante em uma oferta de disciplina;
- de todos os estudantes de uma oferta de disciplina.

Listagens devem permitir paginação e, quando aplicável, ordenação estável.

### RF-03 — Calcular média

A API deve calcular e retornar a média aritmética de N1 e N2 para cada estudante e oferta de disciplina quando as duas notas estiverem cadastradas e ativas. A média corresponde a `(N1 + N2) / 2` e deve ser arredondada para uma casa decimal pelo critério aritmético (a segunda casa decimal de 5 a 9 aumenta a primeira casa decimal em uma unidade; por exemplo, 8,35 resulta em 8,4). Enquanto uma das notas não existir ou estiver excluída logicamente, a média deve ser retornada como indisponível (`null`).

### RF-04 — Atualizar nota

O sistema deve permitir que o portal do professor atualize o valor e os dados descritivos de uma nota existente. No MVP, a página local pode realizar a operação com sessão válida. Cada atualização deve registrar o valor anterior, o novo valor, o identificador do professor autenticado como responsável e a data e hora da alteração.

### RF-05 — Remover nota

O sistema deve permitir que o portal do professor faça a exclusão lógica de uma nota existente. No MVP, a página local pode realizar a operação com sessão válida. A nota será marcada como excluída e deixará de aparecer nas consultas regulares, sem apagar o registro da base nem seu histórico de auditoria. A operação deve registrar o identificador do professor autenticado como responsável e a data e hora da exclusão.

### RF-06 — Limitar notas por estudante

O sistema deve permitir somente N1 e N2 para cada combinação de oferta de disciplina e estudante. Uma tentativa de cadastrar novamente uma nota já existente para a mesma posição deve retornar conflito, sem substituir silenciosamente o valor cadastrado.

### RF-07 — Identificar professor para auditoria no MVP

A API deve oferecer autenticação local simples para a página de testes, usando identificador do professor e senha de teste que não sejam credenciais institucionais. Após autenticação bem-sucedida, deve emitir uma sessão/token de curta duração associado à identidade validada. As operações de notas devem exigir essa sessão no MVP e derivar dela a identidade registrada na auditoria; não devem confiar em um identificador de professor enviado livremente no corpo ou em cabeçalho.

Essa autenticação tem finalidade exclusiva de auditoria: não implementa autorização por perfil, oferta ou operação. A API não deve receber nem armazenar senhas em texto puro. A sessão deve poder ser encerrada pela página; se forem usados tokens sem estado, o comportamento de encerramento e expiração deve ser documentado.

## 6. Regras de negócio e validações

1. O valor da nota é obrigatório e deve ser numérico, maior ou igual a 0 e menor ou igual a 10.
2. O valor deve ter no máximo uma casa decimal.
3. Estudante, oferta de disciplina, número da nota (1 ou 2) e valor são obrigatórios no cadastro.
4. O estudante deve estar matriculado na oferta informada.
5. O número da nota deve ser 1 (N1) ou 2 (N2); não são permitidas outras notas ou avaliações.
6. A média é calculada por `(N1 + N2) / 2` somente quando ambas as notas estiverem cadastradas e ativas, e o resultado é arredondado para uma casa decimal pelo critério aritmético.
7. A API deve validar que a oferta e a matrícula relacionadas à nota existem; a autorização do usuário para a oferta é responsabilidade do portal do professor.
8. A API deve rejeitar propriedades desconhecidas ou inválidas conforme o contrato publicado; não deve ignorar silenciosamente erros de entrada.
9. Se houver encerramento de período ou bloqueio de lançamento no sistema acadêmico, a API deve impedir a escrita e informar o motivo.
10. Data e hora de auditoria devem ser armazenadas em UTC.

## 7. Contrato inicial da API

Prefixo sugerido: `/api/v1`

| Método e rota | Descrição |
|---|---|
| `POST /auth/sessao` | Autentica credenciais locais de teste e inicia sessão para auditoria |
| `DELETE /auth/sessao` | Encerra a sessão local |
| `POST /ofertas/{ofertaId}/notas` | Cadastra uma nota |
| `GET /notas/{notaId}` | Consulta uma nota |
| `GET /ofertas/{ofertaId}/notas` | Lista notas da oferta |
| `GET /estudantes/{estudanteId}/notas?ofertaId={ofertaId}` | Lista notas do estudante na oferta |
| `PATCH /notas/{notaId}` | Atualiza parcialmente uma nota |
| `DELETE /notas/{notaId}` | Faz a exclusão lógica de uma nota |

Em produção, o portal consome as rotas e aplica as permissões dos usuários antes de realizar as operações. No MVP, a página local de testes consome a API local com sessão de teste válida, usada apenas para auditoria.

### Exemplo de cadastro

`POST /api/v1/ofertas/oferta-123/notas`

```json
{
  "estudanteId": "estudante-456",
  "numeroNota": 1,
  "valor": 8.5
}
```

Resposta de sucesso: `201 Created`, com a nota cadastrada e seu identificador. Nas consultas, a API deve retornar N1, N2 e a média calculada; a média será `null` enquanto uma das duas notas não estiver cadastrada.

## 8. Requisitos não funcionais

- **Segurança:** no MVP local, a API deve escutar somente em `localhost`/`127.0.0.1`, sem exposição à rede, e não exigirá chave de API. A página de testes chamará a API diretamente, sem proxy. A autenticação simples com credenciais locais de teste é obrigatória para identificar o professor na auditoria, mas não concede autorização por perfil. Não usar nem armazenar credenciais institucionais ou senhas em texto puro. Em produção, o portal autentica o professor e aplica autorização por perfil; qualquer exposição da API fora do loopback exige reavaliação dos controles de segurança.
- **Privacidade:** retornar somente os dados necessários; proteger dados acadêmicos contra acesso não autorizado. No MVP, a API local não deve ser acessível pela rede.
- **Auditoria:** registrar operações de criação, atualização e exclusão lógica, incluindo identificador do professor autenticado pelo portal em produção ou pela sessão local de teste no MVP como responsável, horário, recurso e alterações relevantes. Registrar também os acessos à API. Não registrar senhas, tokens ou outros segredos.
- **Integridade:** persistir cada alteração de forma transacional e aplicar restrições contra duplicidade.
- **Disponibilidade:** manter disponibilidade mínima de 95% em cada mês.
- **Desempenho:** responder em até 2 segundos para pelo menos 95% das requisições, sob carga de 5 requisições simultâneas.
- **Retenção de auditoria:** manter os registros de acesso e de auditoria por tempo indeterminado.
- **Paginação:** retornar até 10 registros por página nas operações de listagem.
- **Compatibilidade:** versionar mudanças incompatíveis no caminho da API e documentar o contrato usando OpenAPI.
- **Observabilidade:** registrar erros e métricas operacionais sem expor dados pessoais ou conteúdo sensível nos logs.

## 9. Respostas e erros

A API deve utilizar códigos HTTP coerentes e um formato de erro consistente, por exemplo:

```json
{
  "codigo": "NOTA_FORA_DA_ESCALA",
  "mensagem": "O valor da nota deve estar entre 0 e 10.",
  "detalhes": [
    {
      "campo": "valor",
      "mensagem": "Valor máximo permitido: 10."
    }
  ]
}
```

| Código HTTP | Situação |
|---|---|
| `200 OK` | Consulta ou atualização concluída |
| `201 Created` | Nota cadastrada |
| `204 No Content` | Remoção ou invalidação concluída |
| `400 Bad Request` | Requisição malformada ou validação inválida |
| `401 Unauthorized` | Credenciais locais inválidas ou sessão ausente, inválida ou expirada |
| `404 Not Found` | Nota, oferta ou estudante inexistente, conforme a política de exposição |
| `409 Conflict` | Nota duplicada ou conflito com o estado acadêmico |
| `422 Unprocessable Content` | Requisição válida em formato, mas incompatível com regra de negócio |
| `500 Internal Server Error` | Falha inesperada, sem exposição de detalhes internos |

## 10. Critérios de aceite

1. O portal do professor em produção e a página local de testes conseguem cadastrar N1 ou N2 com valor válido para estudante matriculado na oferta.
2. Notas abaixo de 0, acima de 10 ou com mais de uma casa decimal são rejeitadas com erro identificável.
3. Uma nota para estudante não matriculado ou oferta inexistente não é cadastrada.
4. Um lançamento duplicado de N1 ou N2 para o mesmo estudante e oferta retorna `409 Conflict` e não altera a nota já cadastrada.
5. Quando N1 e N2 estão cadastradas e ativas, a média retornada é `(N1 + N2) / 2`, arredondada para uma casa decimal pelo critério aritmético; quando falta ou está excluída logicamente uma delas, a média é `null`.
6. A API valida existência da oferta e matrícula sem implementar autorização por perfil; em produção, essa autorização é aplicada pelo portal, enquanto no MVP a sessão local serve somente para auditoria.
7. Criações, alterações, exclusões lógicas e acessos à API ficam registrados; as notas excluídas logicamente e seus históricos não são apagados.
8. Listagens são paginadas e retornam até 10 registros por página.
9. A documentação OpenAPI descreve rotas, esquemas, validações e respostas de erro.
10. No MVP, a API local escuta somente em loopback e as operações funcionam sem chave de API ou proxy.
11. A página local autentica credenciais exclusivas de teste; a API deriva a identidade do professor da sessão/token validado e a registra na auditoria, sem aplicar autorização por perfil.

## 11. Decisões pendentes para implementação

- Definir o formato e o prazo da sessão/token local, o encerramento/revogação e a forma de criar e armazenar credenciais de teste com senha protegida por hash.
- Confirmar portas locais e origem CORS exata, caso a página Vue e a API usem portas diferentes.
- Definir o protocolo confiável para transmitir à API a identidade do professor autenticado pelo portal em produção.
