---
name: docker-compose-workflow
description: Use ao operar ou diagnosticar serviços Docker Compose nos projetos locais.
---

# Fluxo Docker Compose

- Identifique a raiz que contém `docker-compose.yml` antes de executar comandos.
- Para diagnóstico, prefira `docker compose ps` e logs limitados antes de reiniciar serviços.
- Não derrube volumes ou dados persistentes sem confirmação explícita.
