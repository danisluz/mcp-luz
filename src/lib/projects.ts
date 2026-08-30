import fs from "node:fs";
import path from "node:path";

// Define a raiz padrão de projetos no seu WSL
export const PROJECTS_ROOT = process.env.PROJECTS_ROOT || "/home/danisluz/projects";

export interface ContextoProjeto {
  pastaRaiz: string;       // Raiz do Monorepo (onde tem o docker-compose.yml ou .git)
  subDiretorio: string;    // Pasta exata onde você está no terminal
  tecnologia: "nestjs" | "react" | "angular" | "astro" | "desconhecido";
}

/**
 * Analisa o diretório de trabalho atual no WSL e descobre a stack do projeto,
 * lendo o package.json local e subindo a árvore para achar a raiz do Docker.
 * Se cwdOverride for informado, usa-o no lugar de process.cwd().
 */
export function detectarContextoAtual(cwdOverride?: string): ContextoProjeto {
  const cwd = cwdOverride ?? process.cwd();
  let tecnologia: "nestjs" | "react" | "angular" | "astro" | "desconhecido" = "desconhecido";

  // 1. Tenta ler o package.json local para identificar o framework
  const packageJsonPath = path.join(cwd, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps["@nestjs/core"]) tecnologia = "nestjs";
      else if (deps["react"]) tecnologia = "react";
      else if (deps["@angular/core"]) tecnologia = "angular";
      else if (deps["astro"]) tecnologia = "astro";
    } catch {
      // Falha silenciosa se o JSON estiver quebrado
    }
  }

  // 2. Sobe na árvore de pastas para encontrar a raiz do Monorepo (onde tem docker-compose ou .git)
  let pastaRaiz = cwd;
  let tempDir = cwd;
  
  while (tempDir !== path.dirname(tempDir)) {
    if (fs.existsSync(path.join(tempDir, "docker-compose.yml")) || fs.existsSync(path.join(tempDir, ".git"))) {
      pastaRaiz = tempDir;
      break;
    }
    tempDir = path.dirname(tempDir);
  }

  return {
    pastaRaiz,
    subDiretorio: cwd,
    tecnologia
  };
}
