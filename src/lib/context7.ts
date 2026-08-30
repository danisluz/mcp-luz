import { fetchLibraryContext, searchLibraries } from "@upstash/context7-mcp/dist/lib/api.js";

function formatarJson(valor: unknown): string {
  return JSON.stringify(valor, null, 2);
}

export async function resolverBibliotecaContext7(argumentos: Record<string, unknown>) {
  const query = typeof argumentos.query === "string" ? argumentos.query : "";
  const libraryName = typeof argumentos.libraryName === "string" ? argumentos.libraryName : "";
  if (!query || !libraryName) throw new Error("Informe query e libraryName.");

  const resultado = await searchLibraries(query, libraryName, { apiKey: process.env.CONTEXT7_API_KEY });
  return { content: [{ type: "text" as const, text: formatarJson(resultado) }] };
}

export async function consultarDocumentacaoContext7(argumentos: Record<string, unknown>) {
  const query = typeof argumentos.query === "string" ? argumentos.query : "";
  const libraryId = typeof argumentos.libraryId === "string" ? argumentos.libraryId : "";
  if (!query || !libraryId) throw new Error("Informe query e libraryId.");

  const resultado = await fetchLibraryContext({ query, libraryId }, { apiKey: process.env.CONTEXT7_API_KEY });
  return { content: [{ type: "text" as const, text: formatarJson(resultado) }] };
}
