# mcp-luz

Ao iniciar uma sessao neste repositorio, considere estes recursos locais:

- MCP principal: `mcp-luz`, registrado no Codex como servidor stdio em `C:\projects\mcp-luz\dist\server.js`.
- Agentes customizados: `.codex/agents/*.toml`, gerados a partir de `src/agents/*.md`.
- Skills locais: `src/skills/shared/*/SKILL.md`, sincronizadas para `C:\Users\dansl\.codex\skills`.

Depois de adicionar ou remover agents, skills ou tools MCP do hub, rode `npm run build` e `npm run install:codex`.
Abra uma nova sessao do Codex para carregar o novo inventario.

Quando a tarefa envolver navegacao/browser, prefira as tools encaminhadas pelo MCP `mcp-luz` com prefixo `playwright__`, se disponiveis na sessao.
Quando a tarefa citar uma skill local, leia o `SKILL.md` correspondente antes de agir.
