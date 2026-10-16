O projeto implementa uma API local para cadastro e consulta de notas acadêmicas, acompanhada de uma interface web para testar suas operações. O backend usa Node.js, TypeScript, Express e PostgreSQL; o frontend usa Vue.js, TypeScript e Vite.

A API permite cadastrar, consultar, listar, atualizar e excluir logicamente notas N1 e N2. As notas devem estar entre 0 e 10, com até uma casa decimal. Quando ambas estão ativas, a API calcula a média arredondada para uma casa decimal. O banco mantém matrículas como projeção local e registra as alterações e os acessos em uma trilha de auditoria.

O frontend chama a API diretamente, sem login. Por isso, a API e a interface devem permanecer restritas à máquina local e ser usadas apenas com dados de teste. Nas alterações, a auditoria usa o ator técnico api-local, que não identifica uma pessoa.
