import fs from "node:fs";
import path from "node:path";

import { PROJECTS_ROOT } from "./projects.js";

const ARQUIVOS_RESUMO_PROJETO = ["PROJECT.md", "CLAUDE.md", "README.md"];
const TAMANHO_MAX_TRECHO = 200;
const TAMANHO_MAX_RESUMO = 4000;

export interface ResultadoBusca {
  arquivo: string;
  linha: number;
  trecho: string;
}

export interface ResumoProjeto {
  slug: string;
  resumo?: string;
  resumoFonte?: string;
  arquivos: string[];
}

export interface EntradaRecente {
  arquivo: string;
  modificadoEm: string;
}

export interface RascunhoInput {
  tipo: "idea" | "briefing" | "proposta";
  titulo: string;
  conteudo: string;
  projeto?: string;
}

export interface RascunhoCriado {
  arquivo: string;
}

/** Raiz do Nexus: NEXUS_ROOT se definido, senão <PROJECTS_ROOT>/nexus. */
export function nexusRoot(): string {
  return process.env.NEXUS_ROOT ? path.resolve(process.env.NEXUS_ROOT) : path.join(PROJECTS_ROOT, "nexus");
}

function pastaProjetos(raiz: string): string {
  return path.join(raiz, "projects");
}

function listarArquivos(diretorio: string, extensoes?: string[]): string[] {
  if (!fs.existsSync(diretorio)) return [];

  const resultado: string[] = [];
  const pendentes = [diretorio];

  while (pendentes.length > 0) {
    const atual = pendentes.pop()!;
    let entradas: fs.Dirent[];
    try {
      entradas = fs.readdirSync(atual, { withFileTypes: true });
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      console.error(`[Hub Pessoal] Não foi possível ler '${atual}': ${mensagem}`);
      continue;
    }

    for (const entrada of entradas) {
      if (entrada.name.startsWith(".")) continue;
      const caminho = path.join(atual, entrada.name);

      let ehDiretorio: boolean;
      try {
        ehDiretorio = entrada.isSymbolicLink() ? fs.statSync(caminho).isDirectory() : entrada.isDirectory();
      } catch (erro) {
        const mensagem = erro instanceof Error ? erro.message : String(erro);
        console.error(`[Hub Pessoal] Não foi possível inspecionar '${caminho}': ${mensagem}`);
        continue;
      }

      if (ehDiretorio) {
        pendentes.push(caminho);
      } else if (!extensoes || extensoes.includes(path.extname(entrada.name))) {
        resultado.push(caminho);
      }
    }
  }

  return resultado;
}

function slugDeProjetoValido(slug: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(slug) && slug !== "." && slug !== "..";
}

export function searchNexus(query: string, limite = 10, raiz = nexusRoot()): ResultadoBusca[] {
  const termo = query.trim().toLowerCase();
  if (!termo) return [];

  const resultados: ResultadoBusca[] = [];
  for (const arquivo of listarArquivos(pastaProjetos(raiz), [".md"]).sort()) {
    let linhas: string[];
    try {
      linhas = fs.readFileSync(arquivo, "utf-8").split("\n");
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      console.error(`[Hub Pessoal] Não foi possível ler '${arquivo}': ${mensagem}`);
      continue;
    }

    for (let i = 0; i < linhas.length; i++) {
      if (!linhas[i].toLowerCase().includes(termo)) continue;

      const trecho = linhas[i].trim();
      resultados.push({
        arquivo: path.relative(raiz, arquivo),
        linha: i + 1,
        trecho: trecho.length > TAMANHO_MAX_TRECHO ? `${trecho.slice(0, TAMANHO_MAX_TRECHO)}…` : trecho,
      });
      if (resultados.length >= limite) return resultados;
    }
  }

  return resultados;
}

export function getProject(slug: string, raiz = nexusRoot()): ResumoProjeto | undefined {
  if (!slugDeProjetoValido(slug)) return undefined;
  const pastaProjeto = path.join(pastaProjetos(raiz), slug);
  if (!fs.existsSync(pastaProjeto) || !fs.statSync(pastaProjeto).isDirectory()) return undefined;

  const arquivos = listarArquivos(pastaProjeto)
    .map((arquivo) => path.relative(pastaProjeto, arquivo))
    .sort();

  const resumoFonte = ARQUIVOS_RESUMO_PROJETO.find((nome) => fs.existsSync(path.join(pastaProjeto, nome)));
  const resumo = resumoFonte
    ? fs.readFileSync(path.join(pastaProjeto, resumoFonte), "utf-8").trim().slice(0, TAMANHO_MAX_RESUMO)
    : undefined;

  return { slug, resumo, resumoFonte, arquivos };
}

export function listRecent(limite = 10, raiz = nexusRoot()): EntradaRecente[] {
  const comData: Array<{ arquivo: string; modificadoEm: Date }> = [];

  for (const arquivo of listarArquivos(pastaProjetos(raiz))) {
    try {
      comData.push({ arquivo, modificadoEm: fs.statSync(arquivo).mtime });
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      console.error(`[Hub Pessoal] Não foi possível inspecionar '${arquivo}': ${mensagem}`);
    }
  }

  return comData
    .sort((a, b) => b.modificadoEm.getTime() - a.modificadoEm.getTime())
    .slice(0, limite)
    .map(({ arquivo, modificadoEm }) => ({
      arquivo: path.relative(raiz, arquivo),
      modificadoEm: modificadoEm.toISOString(),
    }));
}

function slugificar(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "rascunho"
  );
}

function caminhoDisponivel(caminhoBase: string): string {
  if (!fs.existsSync(caminhoBase)) return caminhoBase;

  const extensao = path.extname(caminhoBase);
  const semExtensao = caminhoBase.slice(0, -extensao.length);
  let sufixo = 2;
  let candidato = `${semExtensao}-${sufixo}${extensao}`;
  while (fs.existsSync(candidato)) {
    sufixo++;
    candidato = `${semExtensao}-${sufixo}${extensao}`;
  }
  return candidato;
}

export function createDraft(input: RascunhoInput, raiz = nexusRoot()): RascunhoCriado {
  const dataHoje = new Date().toISOString().slice(0, 10);
  const pastaProjetosRaiz = pastaProjetos(raiz);

  if (input.tipo === "idea") {
    const arquivoIdeias = path.join(pastaProjetosRaiz, "ideas.md");
    fs.mkdirSync(pastaProjetosRaiz, { recursive: true });
    if (!fs.existsSync(arquivoIdeias)) {
      fs.writeFileSync(arquivoIdeias, "# Ideias\n");
    }
    const bloco = `\n## ${input.titulo}\n\n_Capturada em ${dataHoje}_\n\n${input.conteudo.trim()}\n`;
    fs.appendFileSync(arquivoIdeias, bloco);
    return { arquivo: path.relative(raiz, arquivoIdeias) };
  }

  if (!input.projeto) {
    throw new Error(`Parâmetro 'projeto' é obrigatório para rascunhos do tipo '${input.tipo}'.`);
  }

  if (!slugDeProjetoValido(input.projeto)) {
    throw new Error(`Nome de projeto inválido: '${input.projeto}'.`);
  }

  const pastaProjeto = path.join(pastaProjetosRaiz, input.projeto);
  fs.mkdirSync(pastaProjeto, { recursive: true });

  const nomeArquivo = `rascunho-${input.tipo}-${slugificar(input.titulo)}.md`;
  const caminho = caminhoDisponivel(path.join(pastaProjeto, nomeArquivo));
  const conteudo = `# ${input.titulo}\n\n_Rascunho de ${input.tipo}, criado em ${dataHoje}_\n\n${input.conteudo.trim()}\n`;
  fs.writeFileSync(caminho, conteudo);

  return { arquivo: path.relative(raiz, caminho) };
}
