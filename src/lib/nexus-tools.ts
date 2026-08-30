import { createDraft, getProject, listRecent, searchNexus } from "./nexus.js";

function formatarJson(valor: unknown): string {
  return JSON.stringify(valor, null, 2);
}

export const nexusToolDefinitions = [
  {
    name: "nexus_search",
    description: "Busca um termo nas ideias, projetos, decisões e propostas versionados no Nexus.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Termo ou trecho a buscar (case-insensitive)." },
        limit: { type: "number", description: "Número máximo de trechos retornados (padrão 10)." },
      },
      required: ["query"],
    },
  },
  {
    name: "nexus_get_project",
    description: "Devolve o resumo estruturado de um projeto do Nexus a partir do slug da pasta.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Nome da pasta em projects/, ex.: 'cia-do-ar'." } },
      required: ["slug"],
    },
  },
  {
    name: "nexus_create_draft",
    description: "Cria um rascunho de ideia, briefing ou proposta no Nexus, sem sobrescrever rascunhos existentes.",
    inputSchema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["idea", "briefing", "proposta"] },
        titulo: { type: "string" },
        conteudo: { type: "string" },
        projeto: {
          type: "string",
          description: "Slug do projeto em projects/. Obrigatório para 'briefing' e 'proposta'.",
        },
      },
      required: ["tipo", "titulo", "conteudo"],
    },
  },
  {
    name: "nexus_list_recent",
    description: "Lista os arquivos modificados mais recentemente em projects/ no Nexus.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Número máximo de itens (padrão 10)." } },
      required: [],
    },
  },
];

export async function buscarNexus(argumentos: Record<string, unknown>) {
  const query = typeof argumentos.query === "string" ? argumentos.query : "";
  if (!query) throw new Error("Informe 'query'.");
  const limite = typeof argumentos.limit === "number" ? argumentos.limit : 10;

  const resultados = searchNexus(query, limite);
  return { content: [{ type: "text" as const, text: formatarJson(resultados) }] };
}

export async function obterProjetoNexus(argumentos: Record<string, unknown>) {
  const slug = typeof argumentos.slug === "string" ? argumentos.slug : "";
  if (!slug) throw new Error("Informe 'slug'.");

  const resumo = getProject(slug);
  if (!resumo) throw new Error(`Projeto '${slug}' não encontrado em projects/.`);

  return { content: [{ type: "text" as const, text: formatarJson(resumo) }] };
}

export async function criarRascunhoNexus(argumentos: Record<string, unknown>) {
  const tipo = argumentos.tipo;
  if (tipo !== "idea" && tipo !== "briefing" && tipo !== "proposta") {
    throw new Error("Informe 'tipo' como 'idea', 'briefing' ou 'proposta'.");
  }
  const titulo = typeof argumentos.titulo === "string" ? argumentos.titulo : "";
  const conteudo = typeof argumentos.conteudo === "string" ? argumentos.conteudo : "";
  if (!titulo || !conteudo) throw new Error("Informe 'titulo' e 'conteudo'.");
  const projeto = typeof argumentos.projeto === "string" ? argumentos.projeto : undefined;

  const resultado = createDraft({ tipo, titulo, conteudo, projeto });
  return { content: [{ type: "text" as const, text: `Rascunho criado em ${resultado.arquivo}` }] };
}

export async function listarRecentesNexus(argumentos: Record<string, unknown>) {
  const limite = typeof argumentos.limit === "number" ? argumentos.limit : 10;
  const recentes = listRecent(limite);
  return { content: [{ type: "text" as const, text: formatarJson(recentes) }] };
}
