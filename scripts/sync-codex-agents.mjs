import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = resolve(scriptDirectory, "..");
const sourceDirectory = join(rootDirectory, "src", "agents");
const outputDirectory = join(rootDirectory, ".generated", "codex-agents");

function unwrapTemplate(source) {
  const match = source.match(/^export const template = `([\s\S]*)`;\s*$/);
  return match ? match[1] : source;
}

function readFrontmatter(source, fileName) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!match) {
    throw new Error(`${fileName} precisa começar com frontmatter YAML.`);
  }

  const description = match[1]
    .split(/\r?\n/)
    .find((line) => line.startsWith("description:"))
    ?.slice("description:".length)
    .trim();

  if (!description) {
    throw new Error(`${fileName} precisa declarar description no frontmatter.`);
  }

  return { description, instructions: match[2].trim() };
}

function toTomlMultilineString(value) {
  return value.replaceAll('"""', '\\"""');
}

const sourceFiles = (await readdir(sourceDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && extname(entry.name) === ".md")
  .map((entry) => entry.name)
  .sort();

await mkdir(outputDirectory, { recursive: true });

for (const entry of await readdir(outputDirectory, { withFileTypes: true })) {
  if (entry.isFile() && extname(entry.name) === ".toml") {
    await rm(join(outputDirectory, entry.name));
  }
}

for (const sourceFile of sourceFiles) {
  const source = unwrapTemplate(await readFile(join(sourceDirectory, sourceFile), "utf8"));
  const { description, instructions } = readFrontmatter(source, sourceFile);
  const name = basename(sourceFile, ".md");
  const toml = [
    "# Gerado por scripts/sync-codex-agents.mjs. Não edite este arquivo.",
    `name = ${JSON.stringify(name)}`,
    `description = ${JSON.stringify(description)}`,
    'developer_instructions = """',
    toTomlMultilineString(instructions),
    '"""',
    "",
  ].join("\n");

  await writeFile(join(outputDirectory, `${name}.toml`), toml, "utf8");
}

console.log(`Sincronizados ${sourceFiles.length} agentes para ${outputDirectory}`);
