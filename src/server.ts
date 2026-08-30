import fs from "node:fs";
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from "node:url";

import { detectarContextoAtual } from "./lib/projects.js";
import { carregarEnvLocal, caminhoEnvDoHub } from "./lib/env.js";
import { PonteMcpExterna } from "./lib/external-mcp.js";
import { consultarDocumentacaoContext7, resolverBibliotecaContext7 } from "./lib/context7.js";
import { resolverCaminhoViaRoots } from "./lib/roots.js";
import {
  buscarNexus,
  criarRascunhoNexus,
  listarRecentesNexus,
  nexusToolDefinitions,
  obterProjetoNexus,
} from "./lib/nexus-tools.js";

// Agents e skills não passam mais por aqui: são arquivos .md lidos direto
// pelo Claude Code em ~/.claude/agents e ~/.claude/skills (symlinks pro
// .mcp-luz). Este servidor só expõe tools MCP.

const diretorioDoArquivo = path.dirname(fileURLToPath(import.meta.url));
const raizDoHub = path.resolve(diretorioDoArquivo, "..");
carregarEnvLocal(caminhoEnvDoHub(diretorioDoArquivo));

const ambienteDoHub = Object.fromEntries(
  Object.entries(process.env).filter((entrada): entrada is [string, string] => entrada[1] !== undefined),
);
const variaveisPostgresObrigatorias = ["PG_HOST", "PG_PORT", "PG_USER", "PG_PASSWORD", "PG_DATABASE"] as const;
const postgresConfigurado = variaveisPostgresObrigatorias.every((variavel) => Boolean(process.env[variavel]));
const pythonDoFetch = path.join(raizDoHub, ".mcp-fetch-venv", "bin", "python");
const fetchConfigurado = fs.existsSync(pythonDoFetch);
const sonarqubeConfigurado = Boolean(process.env.SONARQUBE_TOKEN) && Boolean(
  process.env.SONARQUBE_ORG || process.env.SONARQUBE_URL,
);
const configuracoesExternas = [
  ...(process.env.FIGMA_API_KEY ? [{
    nome: "figma",
    command: process.execPath,
    args: [path.join(raizDoHub, "node_modules/figma-developer-mcp/dist/bin.js"), "--stdio"],
    cwd: raizDoHub,
    env: ambienteDoHub,
  }] : []),
  {
    nome: "playwright",
    command: "npx",
    args: ["--yes", "@playwright/mcp@latest"],
    cwd: raizDoHub,
    env: ambienteDoHub,
  },
  ...(postgresConfigurado ? [{
    nome: "postgres",
    command: "npx",
    args: ["--yes", "mcp-postgres-server"],
    cwd: raizDoHub,
    env: ambienteDoHub,
  }] : []),
  {
    nome: "sequential-thinking",
    command: "npx",
    args: ["--yes", "@modelcontextprotocol/server-sequential-thinking"],
    cwd: raizDoHub,
    env: { ...ambienteDoHub, DISABLE_THOUGHT_LOGGING: "true" },
  },
  ...(fetchConfigurado ? [{
    nome: "fetch",
    command: pythonDoFetch,
    args: ["-m", "mcp_server_fetch"],
    cwd: raizDoHub,
    env: ambienteDoHub,
  }] : []),
  ...(sonarqubeConfigurado ? [{
    nome: "sonarqube",
    command: "docker",
    args: [
      "run", "-i", "--rm", "--init", "--pull=always",
      "-e", "SONARQUBE_TOKEN",
      ...(process.env.SONARQUBE_ORG ? ["-e", "SONARQUBE_ORG"] : []),
      ...(process.env.SONARQUBE_URL ? ["-e", "SONARQUBE_URL"] : []),
      "sonarsource/sonarqube-mcp",
    ],
    cwd: raizDoHub,
    env: ambienteDoHub,
  }] : []),
];
const ponteExterna = new PonteMcpExterna(configuracoesExternas);

const server = new Server(
  { name: "mcp-luz", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// REGISTRO DE FERRAMENTAS DO DOCKER E CONTEXTO
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "detectar_stack_atual",
      description: "Detecta automaticamente a tecnologia da pasta (NestJS/React/Angular) e a raiz do monorepo Docker.",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "gerenciar_docker_monorepo",
      description: "Executa comandos docker-compose (up, down, ps, logs) subindo automaticamente até a raiz do Monorepo.",
      inputSchema: {
        type: "object",
        properties: {
          acao: { type: "string", enum: ["up", "down", "status", "logs"], description: "Comando docker-compose" }
        },
        required: ["acao"]
      }
    },
    {
      name: "context7__resolve_library_id",
      description: "Resolve uma biblioteca para um ID compatível do Context7 antes de consultar documentação.",
      inputSchema: { type: "object", properties: { query: { type: "string" }, libraryName: { type: "string" } }, required: ["query", "libraryName"] }
    },
    {
      name: "context7__query_docs",
      description: "Consulta documentação atual no Context7 usando um libraryId resolvido.",
      inputSchema: { type: "object", properties: { query: { type: "string" }, libraryId: { type: "string" } }, required: ["query", "libraryId"] }
    },
    ...nexusToolDefinitions,
    ...(await ponteExterna.listarTools()),
  ]
}));

// EXECUÇÃO DAS FERRAMENTAS NO WSL
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params as any;

  if (name === "detectar_stack_atual") {
    const contexto = detectarContextoAtual(await resolverCaminhoViaRoots(server));
    return {
      content: [{ type: "text", text: `🚀 Tecnologia Detectada: ${contexto.tecnologia.toUpperCase()}\n📁 Raiz do Monorepo: ${contexto.pastaRaiz}` }]
    };
  }

  if (name === "gerenciar_docker_monorepo") {
    const contexto = detectarContextoAtual(await resolverCaminhoViaRoots(server));
    const { execFileSync } = await import("node:child_process");

    if (!fs.existsSync(path.join(contexto.pastaRaiz, "docker-compose.yml"))) {
      throw new Error(`Nenhum docker-compose.yml encontrado na raiz: ${contexto.pastaRaiz}`);
    }

    try {
      const argumentosPorAcao = {
        up: ["compose", "up", "-d"],
        down: ["compose", "down"],
        status: ["compose", "ps"],
        logs: ["compose", "logs", "--tail=30"],
      } as const;
      const acaoRecebida: unknown = args?.acao;
      if (acaoRecebida !== "up" && acaoRecebida !== "down" && acaoRecebida !== "status" && acaoRecebida !== "logs") {
        throw new Error("Ação Docker inválida.");
      }
      const acao: keyof typeof argumentosPorAcao = acaoRecebida;
      const stdout = execFileSync("docker", argumentosPorAcao[acao], {
        cwd: contexto.pastaRaiz,
        encoding: "utf-8",
      });
      return { content: [{ type: "text", text: `🐳 Docker Executado com Sucesso:\n${stdout || "Comando executado silenciosamente."}` }] };
    } catch (err: any) {
      throw new Error(`Erro ao rodar Docker no WSL: ${err.message}`);
    }
  }

  if (name === "context7__resolve_library_id") return resolverBibliotecaContext7(args ?? {});
  if (name === "context7__query_docs") return consultarDocumentacaoContext7(args ?? {});

  if (name === "nexus_search") return buscarNexus(args ?? {});
  if (name === "nexus_get_project") return obterProjetoNexus(args ?? {});
  if (name === "nexus_create_draft") return criarRascunhoNexus(args ?? {});
  if (name === "nexus_list_recent") return listarRecentesNexus(args ?? {});

  const resultadoExterno = await ponteExterna.chamarTool(name, args ?? {});
  if (resultadoExterno) return resultadoExterno;

  throw new Error(`Ferramenta '${name}' não encontrada`);
});

// Clientes como o Codex podem pedir `tools/list` apenas uma vez, logo após o
// handshake. Por isso, os MCPs filhos precisam ser descobertos antes de o Hub
// aceitar a conexão principal.
await ponteExterna.iniciar().catch((erro: unknown) => {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  console.error(`[mcp-luz] Falha ao inicializar MCPs externos: ${mensagem}`);
});

console.error(`[mcp-luz] Servidor iniciado. Tools de docker/contexto, context7, nexus e pontes externas ativas.`);

// Inicialização Stdio
const transport = new StdioServerTransport();
await server.connect(transport);
