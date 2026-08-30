import fs from "node:fs";
import path from "node:path";

/**
 * Carrega segredos locais uma única vez para que qualquer cliente MCP use o
 * mesmo Hub. Variáveis já definidas pelo cliente têm precedência.
 */
export function carregarEnvLocal(arquivo: string): void {
  if (!fs.existsSync(arquivo)) return;

  for (const linhaBruta of fs.readFileSync(arquivo, "utf-8").split("\n")) {
    const linha = linhaBruta.trim();
    if (!linha || linha.startsWith("#")) continue;

    const separador = linha.indexOf("=");
    if (separador <= 0) continue;

    const chave = linha.slice(0, separador).trim();
    const valorBruto = linha.slice(separador + 1).trim();
    const valor = valorBruto.replace(/^("|')|("|')$/g, "");
    if (chave) process.env[chave] ??= valor;
  }
}

export function caminhoEnvDoHub(diretorioDoArquivo: string): string {
  return path.resolve(diretorioDoArquivo, "..", ".env");
}
