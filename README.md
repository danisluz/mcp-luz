# mcp-luz

Hub MCP pessoal para centralizar ferramentas de desenvolvimento e contexto de projetos. O servidor funciona por `stdio` e reúne ferramentas nativas para contexto de monorepos, Docker, Context7 e Nexus, além de encaminhar ferramentas de MCPs externos quando eles estiverem disponíveis.

## O que oferece

- Detecta a stack atual (`NestJS`, React, Angular ou Astro) e a raiz do repositório/monorepo.
- Executa ações usuais de Docker Compose na raiz identificada do projeto.
- Consulta documentação atualizada via Context7.
- Pesquisa, consulta, cria rascunhos e lista informações do Nexus local.
- Encaminha ferramentas de integrações opcionais, com nomes no formato `<servidor>__<ferramenta>`.

## Requisitos

- Node.js 20 ou superior.
- npm.
- Docker, apenas para as ferramentas de Docker e a integração opcional com SonarQube.
- Acesso aos serviços configurados nas integrações opcionais.

## Instalação

```bash
git clone https://github.com/danisluz/mcp-luz.git
cd mcp-luz
npm ci
npm run build
```

Para configurar integrações, crie seu arquivo local de ambiente a partir do exemplo:

```bash
cp .env.example .env
```

O arquivo `.env` é ignorado pelo Git e não deve ser versionado.

## Configuração como servidor MCP

Depois de compilar, registre o servidor no seu cliente MCP usando o executável gerado:

```json
{
  "mcp-luz": {
    "command": "node",
    "args": ["/caminho/absoluto/para/mcp-luz/dist/server.js"]
  }
}
```

Substitua o caminho pelo local em que o repositório foi clonado. O servidor usa `stdio`; logs operacionais são enviados para `stderr`.

## Sincronização com o Codex

Para instalar ou atualizar os recursos locais no Codex, rode:

```bash
npm run build
npm run install:codex
```

Esse fluxo:

- compila o servidor MCP em `dist/server.js`;
- gera os agentes TOML a partir de `src/agents/*.md`;
- copia os agentes para `.codex/agents` e `~/.codex/agents`;
- copia as skills de `src/skills/shared` para `~/.codex/skills`;
- garante o registro do MCP `mcp-luz` em `~/.codex/config.toml`.

Depois de adicionar, remover ou alterar agents, skills ou tools MCP, rode esses comandos e abra uma nova sessão do Codex. O Codex carrega o inventário de skills, agents e MCPs no início da sessão; conversas já abertas não recebem hot reload.

## Ferramentas nativas

| Ferramenta | Descrição |
| --- | --- |
| `detectar_stack_atual` | Detecta a tecnologia do diretório atual e a raiz do monorepo. |
| `gerenciar_docker_monorepo` | Executa `up`, `down`, `status` ou `logs` com Docker Compose na raiz do projeto. |
| `context7__resolve_library_id` | Resolve o identificador de uma biblioteca para consulta no Context7. |
| `context7__query_docs` | Consulta documentação no Context7 com um `libraryId`. |
| `nexus_search` | Pesquisa ideias, projetos, decisões e propostas no Nexus. |
| `nexus_get_project` | Retorna o resumo estruturado de um projeto do Nexus. |
| `nexus_create_draft` | Cria um rascunho de ideia, briefing ou proposta sem sobrescrever arquivos existentes. |
| `nexus_list_recent` | Lista os arquivos mais recentemente alterados em projetos do Nexus. |

## Integrações opcionais

| Integração | Como é habilitada |
| --- | --- |
| Playwright | Disponível por padrão via `npx`. |
| Sequential Thinking | Disponível por padrão via `npx`. |
| Figma | Defina `FIGMA_API_KEY`. |
| PostgreSQL | Preencha todas as variáveis `PG_*`. |
| Fetch | Crie o ambiente virtual `.mcp-fetch-venv` com o módulo `mcp_server_fetch`. |
| SonarQube | Defina `SONARQUBE_TOKEN` e `SONARQUBE_ORG` ou `SONARQUBE_URL`. |

As ferramentas dessas integrações são expostas somente quando a conexão com o respectivo servidor for bem-sucedida. Seus nomes recebem o prefixo da integração, por exemplo `playwright__...` e `figma__...`.

## Variáveis de ambiente

Consulte [`.env.example`](.env.example) para a lista completa. As variáveis de uso mais comum são:

- `CONTEXT7_API_KEY`: chave usada nas consultas do Context7.
- `FIGMA_API_KEY`: habilita a integração do Figma.
- `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD` e `PG_DATABASE`: habilitam o MCP PostgreSQL em conjunto.
- `SONARQUBE_TOKEN` e `SONARQUBE_ORG` ou `SONARQUBE_URL`: habilitam o MCP SonarQube.
- `MCP_PROJECT_NAME`: permite indicar o projeto quando o cliente inicia o Hub fora da pasta do projeto.
- `NEXUS_ROOT`: define uma raiz alternativa para o Nexus.
- `PROJECTS_ROOT`: altera a raiz de projetos, que por padrão é `/home/danisluz/projects`.

## Desenvolvimento

```bash
npm run dev
```

Esse comando recompila o TypeScript em modo observação. Para validar uma compilação única:

```bash
npm run build
```

## Arquitetura

- `src/server.ts`: inicializa o servidor MCP, registra ferramentas e integrações filhas.
- `src/lib/`: contém as regras de contexto de projeto, carregamento de ambiente, ponte de MCPs externos, Context7 e Nexus.
- `src/agents/`: personas para clientes compatíveis que leem agentes em Markdown diretamente.
- `src/skills/`: habilidades compartilhadas, também consumidas diretamente pelo cliente.
