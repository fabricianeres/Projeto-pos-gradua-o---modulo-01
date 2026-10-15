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

O consumo da API será feito exclusivamente pelo portal do professor. O controle de acesso por perfil e a autorização dos usuários são responsabilidade do portal e estão fora do escopo desta API.

## 3. Premissas e termos

- A API será REST e utilizará JSON sobre HTTPS.
- Uma nota pertence a um estudante matriculado em uma disciplina.
- Nesta proposta, a escala de notas é de **0 a 10**, inclusive, com até uma casa decimal (por exemplo, 8,5).
- A instituição utiliza somente duas notas por estudante em cada oferta de disciplina: N1 e N2.
- A média do estudante na oferta é a média aritmética de N1 e N2 e é calculada quando ambas estiverem cadastradas e ativas.
- Cada estudante pode ter no máximo uma N1 e uma N2 por oferta de disciplina.
- “Oferta de disciplina” identifica a disciplina em uma turma e período letivo específicos. Se o sistema não utilizar ofertas, o identificador da disciplina deve cumprir esse papel.
- Os identificadores de estudantes e disciplinas são fornecidos pelos sistemas responsáveis por esses cadastros.

## 4. Sistema consumidor

| Sistema | Responsabilidade |
|---|---|
| Portal do professor | Consumir a API para cadastrar, consultar, atualizar e remover notas, aplicando o controle de acesso por perfil e as permissões dos usuários. |

A API não implementa autorização por perfil nem acesso direto para estudantes ou administradores. Ela valida a existência da oferta e da matrícula, os dados enviados e as regras de negócio. O acesso técnico à API deve ser restrito ao portal do professor conforme a arquitetura de implantação.

## 5. Requisitos funcionais

### RF-01 — Cadastrar nota

O sistema deve permitir que o portal do professor cadastre uma nota informando:

- identificador da oferta de disciplina;
- identificador do estudante;
- número da nota institucional (1 para N1 ou 2 para N2);
- valor da nota;
- observação opcional.

Ao cadastrar, a API deve confirmar que a oferta existe e que o estudante está matriculado nela. A autorização do usuário para lançar notas é verificada pelo portal do professor, fora do escopo da API.

O cadastro deve registrar para auditoria o identificador do professor autenticado no portal como responsável, além da data e hora da operação.

### RF-02 — Consultar nota

O sistema deve permitir consultar uma nota pelo seu identificador e listar notas:

- de um estudante em uma oferta de disciplina;
- de todos os estudantes de uma oferta de disciplina.

Listagens devem permitir paginação e, quando aplicável, ordenação estável.

### RF-03 — Calcular média

A API deve calcular e retornar a média aritmética de N1 e N2 para cada estudante e oferta de disciplina quando as duas notas estiverem cadastradas e ativas. A média corresponde a `(N1 + N2) / 2` e deve ser arredondada para uma casa decimal pelo critério aritmético (a segunda casa decimal de 5 a 9 aumenta a primeira casa decimal em uma unidade; por exemplo, 8,35 resulta em 8,4). Enquanto uma das notas não existir ou estiver excluída logicamente, a média deve ser retornada como indisponível (`null`).

### RF-04 — Atualizar nota

O sistema deve permitir que o portal do professor atualize o valor e os dados descritivos de uma nota existente. Cada atualização deve registrar o valor anterior, o novo valor, o identificador do professor autenticado no portal como responsável e a data e hora da alteração.

### RF-05 — Remover nota

O sistema deve permitir que o portal do professor faça a exclusão lógica de uma nota existente. A nota será marcada como excluída e deixará de aparecer nas consultas regulares, sem apagar o registro da base nem seu histórico de auditoria. A operação deve registrar o identificador do professor autenticado no portal como responsável e a data e hora da exclusão.

### RF-06 — Limitar notas por estudante

O sistema deve permitir somente N1 e N2 para cada combinação de oferta de disciplina e estudante. Uma tentativa de cadastrar novamente uma nota já existente para a mesma posição deve retornar conflito, sem substituir silenciosamente o valor cadastrado.

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
| `POST /ofertas/{ofertaId}/notas` | Cadastra uma nota |
| `GET /notas/{notaId}` | Consulta uma nota |
| `GET /ofertas/{ofertaId}/notas` | Lista notas da oferta |
| `GET /estudantes/{estudanteId}/notas?ofertaId={ofertaId}` | Lista notas do estudante na oferta |
| `PATCH /notas/{notaId}` | Atualiza parcialmente uma nota |
| `DELETE /notas/{notaId}` | Faz a exclusão lógica de uma nota |

As rotas são consumidas exclusivamente pelo portal do professor. O portal aplica as permissões dos usuários antes de realizar as operações.

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

- **Segurança:** utilizar HTTPS e exigir uma chave de API para autenticar o portal do professor como sistema consumidor. O portal autentica o professor com as credenciais institucionais e aplica a autorização por perfil; a API não recebe nem armazena a senha do professor. O portal deve transmitir a identidade autenticada do professor em contexto confiável para que a API registre o responsável pela operação. As chaves devem ser armazenadas com segurança e permitir revogação e substituição.
- **Privacidade:** retornar somente os dados necessários; proteger dados acadêmicos contra acesso não autorizado, considerando o portal como único consumidor previsto.
- **Auditoria:** registrar operações de criação, atualização e exclusão lógica, incluindo identificador do professor autenticado no portal como responsável, horário, recurso e alterações relevantes. Registrar também os acessos à API. Não registrar senhas, chaves de API ou tokens.
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
| `401 Unauthorized` | Chave de API ausente ou inválida |
| `404 Not Found` | Nota, oferta ou estudante inexistente, conforme a política de exposição |
| `409 Conflict` | Nota duplicada ou conflito com o estado acadêmico |
| `422 Unprocessable Content` | Requisição válida em formato, mas incompatível com regra de negócio |
| `500 Internal Server Error` | Falha inesperada, sem exposição de detalhes internos |

## 10. Critérios de aceite

1. O portal do professor consegue cadastrar N1 ou N2 com valor válido para estudante matriculado na oferta.
2. Notas abaixo de 0, acima de 10 ou com mais de uma casa decimal são rejeitadas com erro identificável.
3. Uma nota para estudante não matriculado ou oferta inexistente não é cadastrada.
4. Um lançamento duplicado de N1 ou N2 para o mesmo estudante e oferta retorna `409 Conflict` e não altera a nota já cadastrada.
5. Quando N1 e N2 estão cadastradas e ativas, a média retornada é `(N1 + N2) / 2`, arredondada para uma casa decimal pelo critério aritmético; quando falta ou está excluída logicamente uma delas, a média é `null`.
6. A API valida existência da oferta e matrícula, sem implementar autorização por perfil, que é aplicada pelo portal do professor.
7. Criações, alterações, exclusões lógicas e acessos à API ficam registrados; as notas excluídas logicamente e seus históricos não são apagados.
8. Listagens são paginadas e retornam até 10 registros por página.
9. A documentação OpenAPI descreve rotas, esquemas, validações e respostas de erro.
10. Requisições sem chave de API ou com chave inválida são rejeitadas com `401 Unauthorized`.

## 11. Decisões pendentes para implementação

- Definir o mecanismo seguro para transmitir à API a identidade autenticada do professor para fins de auditoria.
