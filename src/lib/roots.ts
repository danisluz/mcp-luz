import path from "node:path";
import { fileURLToPath } from "node:url";

export interface ClienteComRoots {
  getClientCapabilities(): { roots?: unknown } | undefined;
  listRoots(params?: unknown, options?: { timeout?: number }): Promise<{ roots: Array<{ uri: string; name?: string }> }>;
}

/**
 * Pergunta ao cliente MCP (via protocolo de roots) qual é a primeira pasta
 * aberta (workspace root) em formato de caminho local. Devolve undefined se
 * o cliente não suportar roots, não expuser nenhuma raiz local, ou a
 * consulta falhar — nunca lança.
 */
export async function resolverCaminhoViaRoots(cliente: ClienteComRoots): Promise<string | undefined> {
  if (!cliente.getClientCapabilities()?.roots) return undefined;

  try {
    const { roots } = await cliente.listRoots(undefined, { timeout: 3000 });
    const primeiraRaizLocal = roots.find((raiz) => raiz.uri.startsWith("file://"));
    return primeiraRaizLocal ? fileURLToPath(primeiraRaizLocal.uri) : undefined;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error(`[Hub Pessoal] Falha ao consultar roots do cliente: ${mensagem}`);
    return undefined;
  }
}

/**
 * A partir da primeira root local do cliente, devolve o nome do projeto (1º
 * nível de pasta abaixo de projectsRoot), se a root estiver dentro dele.
 */
export async function resolverProjetoViaRoots(
  cliente: ClienteComRoots,
  projectsRoot: string,
): Promise<string | undefined> {
  const caminho = await resolverCaminhoViaRoots(cliente);
  if (!caminho) return undefined;

  const relativo = path.relative(projectsRoot, caminho);
  if (!relativo || relativo.startsWith("..") || path.isAbsolute(relativo)) return undefined;

  const [projeto] = relativo.split(path.sep);
  return projeto || undefined;
}
