import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

await import("./sync-codex-agents.mjs");

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = resolve(scriptDirectory, "..");
const codexHome = process.env.CODEX_HOME || join(os.homedir(), ".codex");

const sourceSkillsDirectory = join(rootDirectory, "src", "skills", "shared");
const sourceAgentsDirectory = join(rootDirectory, ".generated", "codex-agents");
const projectAgentsDirectory = join(rootDirectory, ".codex", "agents");
const codexSkillsDirectory = join(codexHome, "skills");
const codexAgentsDirectory = join(codexHome, "agents");
const configPath = join(codexHome, "config.toml");

const skillManifestPath = join(codexHome, ".mcp-luz-skills.json");
const agentManifestPath = join(codexHome, ".mcp-luz-agents.json");

async function listDirectories(directory) {
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function listTomlFiles(directory) {
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && extname(entry.name) === ".toml")
    .map((entry) => entry.name)
    .sort();
}

async function readJsonList(path) {
  if (!existsSync(path)) return [];

  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function copyDirectory(source, destination) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });

  for (const entry of await readdir(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      await copyFile(sourcePath, destinationPath);
    }
  }
}

async function syncSkills() {
  const sourceSkills = await listDirectories(sourceSkillsDirectory);
  await mkdir(codexSkillsDirectory, { recursive: true });

  const previouslyInstalled = await readJsonList(skillManifestPath);
  for (const name of previouslyInstalled) {
    if (!sourceSkills.includes(name)) {
      await rm(join(codexSkillsDirectory, name), { recursive: true, force: true });
    }
  }

  for (const name of sourceSkills) {
    await copyDirectory(join(sourceSkillsDirectory, name), join(codexSkillsDirectory, name));
  }

  await writeFile(skillManifestPath, JSON.stringify(sourceSkills, null, 2), "utf8");
  return sourceSkills.length;
}

async function syncAgents() {
  const sourceAgents = await listTomlFiles(sourceAgentsDirectory);
  await mkdir(codexAgentsDirectory, { recursive: true });
  await mkdir(projectAgentsDirectory, { recursive: true });

  const previouslyInstalled = await readJsonList(agentManifestPath);
  for (const name of previouslyInstalled) {
    if (!sourceAgents.includes(name)) {
      await rm(join(codexAgentsDirectory, name), { force: true });
      await rm(join(projectAgentsDirectory, name), { force: true });
    }
  }

  for (const fileName of sourceAgents) {
    await copyFile(join(sourceAgentsDirectory, fileName), join(codexAgentsDirectory, fileName));
    await copyFile(join(sourceAgentsDirectory, fileName), join(projectAgentsDirectory, fileName));
  }

  await writeFile(agentManifestPath, JSON.stringify(sourceAgents, null, 2), "utf8");
  return sourceAgents.length;
}

async function ensureMcpConfig() {
  const block = [
    "[mcp_servers.mcp-luz]",
    'command = "node"',
    `args = ['${join(rootDirectory, "dist", "server.js")}']`,
    `cwd = '${rootDirectory}'`,
    "startup_timeout_sec = 120",
    "",
  ].join("\n");

  await mkdir(codexHome, { recursive: true });
  const currentConfig = existsSync(configPath) ? await readFile(configPath, "utf8") : "";

  if (currentConfig.includes("[mcp_servers.mcp-luz]")) {
    return false;
  }

  const separator = currentConfig.trimEnd() ? "\n\n" : "";
  await writeFile(configPath, `${currentConfig.trimEnd()}${separator}${block}`, "utf8");
  return true;
}

const [skillCount, agentCount, mcpAdded] = await Promise.all([
  syncSkills(),
  syncAgents(),
  ensureMcpConfig(),
]);

console.log(`Skills sincronizadas: ${skillCount}`);
console.log(`Agents sincronizados: ${agentCount}`);
console.log(`MCP mcp-luz: ${mcpAdded ? "registrado" : "ja registrado"}`);
console.log("Abra uma nova sessao do Codex para carregar as mudancas.");
