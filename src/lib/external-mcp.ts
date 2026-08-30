import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

interface ExternalServerConfig {
  nome: string;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
}

interface RotaTool {
  cliente: Client;
  nomeOriginal: string;
}

function nomeDoHub(nomeServidor: string, nomeTool: string): string {
  return `${nomeServidor}__${nomeTool}`;
}

/** Conecta MCPs filhos e encaminha suas tools pelo Hub. */
export class PonteMcpExterna {
  private readonly clientes = new Map<string, Client>();
  private readonly rotas = new Map<string, RotaTool>();

  constructor(private readonly configuracoes: ExternalServerConfig[]) {}

  async iniciar(): Promise<void> {
    await Promise.all(this.configuracoes.map((configuracao) => this.conectar(configuracao)));
  }

  private async conectar(configuracao: ExternalServerConfig): Promise<void> {
    const cliente = new Client(
      { name: "mcp-pessoal-hub", version: "1.0.0" },
      { capabilities: {} },
    );
    const transporte = new StdioClientTransport({
      command: configuracao.command,
      args: configuracao.args,
      cwd: configuracao.cwd,
      env: configuracao.env,
      stderr: "pipe",
    });

    try {
      await cliente.connect(transporte);
      this.clientes.set(configuracao.nome, cliente);
      console.error(`[Hub Pessoal] MCP externo conectado: ${configuracao.nome}.`);
    } catch (erro) {
      await transporte.close().catch(() => undefined);
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      console.error(`[Hub Pessoal] MCP externo indisponível (${configuracao.nome}): ${mensagem}`);
    }
  }

  async listarTools(): Promise<unknown[]> {
    this.rotas.clear();
    const toolsDoHub: unknown[] = [];

    for (const [nomeServidor, cliente] of this.clientes) {
      try {
        const resultado = await cliente.listTools();
        for (const tool of resultado.tools) {
          const nome = nomeDoHub(nomeServidor, tool.name);
          this.rotas.set(nome, { cliente, nomeOriginal: tool.name });
          toolsDoHub.push({
            ...tool,
            name: nome,
            description: `[${nomeServidor}] ${tool.description ?? tool.name}`,
          });
        }
      } catch (erro) {
        const mensagem = erro instanceof Error ? erro.message : String(erro);
        console.error(`[Hub Pessoal] Falha ao listar tools de ${nomeServidor}: ${mensagem}`);
      }
    }

    return toolsDoHub;
  }

  async chamarTool(nome: string, argumentos: Record<string, unknown>): Promise<unknown> {
    const rota = this.rotas.get(nome);
    if (!rota) return undefined;

    const resultado = await rota.cliente.callTool({ name: rota.nomeOriginal, arguments: argumentos });
    if (!("content" in resultado)) {
      throw new Error(`A tool externa '${nome}' retornou um formato não suportado.`);
    }

    return {
      content: resultado.content,
      ...(resultado.isError === undefined ? {} : { isError: resultado.isError }),
    };
  }
}
