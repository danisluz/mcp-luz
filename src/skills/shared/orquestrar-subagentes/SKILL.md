---
name: orquestrar-subagentes
description: Use ao dividir uma tarefa em frentes independentes entre subagentes e consolidar uma entrega segura.
---
# Orquestrar subagentes

Use subagentes apenas quando houver pelo menos duas frentes independentes e o ganho de paralelismo compensar o custo de coordenação. Não delegue tarefas que alteram os mesmos arquivos, dependem de decisões ainda abertas ou exigem contexto integral do produto.

## Planejamento

1. Separe o trabalho por fronteiras claras: backend, frontend, qualidade ou revisão.
2. Escolha a persona apropriada do Hub: `backend-nest`, `frontend-react`, `qa-testes` ou `revisor-codigo`.
3. Para cada subagente, envie objetivo, escopo, arquivos permitidos, interfaces assumidas, critérios de aceite e comandos de validação.
4. Reserve ao arquiteto principal as decisões de contrato, integração e a consolidação final.

## Regras de execução

- Um arquivo tem um único responsável por vez.
- Subagentes não fazem `git add` nem commits.
- Alterações fora do escopo devem ser relatadas, não realizadas.
- Se uma decisão bloquear outra frente, pare a frente dependente e devolva a decisão ao arquiteto.

## Consolidação

O arquiteto deve revisar os retornos, verificar contratos entre frentes, executar a validação integrada e só então entregar o resultado. O retorno final deve distinguir o que foi implementado, o que foi validado e o que permanece pendente.
