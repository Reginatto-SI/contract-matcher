import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, "../src/config/generatedVersion.ts");

const now = new Date();
const pad = (value) => String(value).padStart(2, "0");

const year = now.getFullYear();
const month = pad(now.getMonth() + 1);
const day = pad(now.getDate());
const hours = pad(now.getHours());
const minutes = pad(now.getMinutes());

const build = `${year}${month}${day}-${hours}${minutes}`;
const updatedAt = `${day}/${month}/${year} ${hours}:${minutes}`;

const content = `// GENERATED_VERSION é automático e representa o build/deploy gerado no ambiente local de build.\n// Ajuda o suporte a diagnosticar cache do navegador e confirmar qual deploy está em uso.\nexport const GENERATED_VERSION = {\n  build: "${build}",\n  updatedAt: "${updatedAt}",\n};\n`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, content, "utf8");

console.info(`[generate-version] ${outputPath} -> Build ${build}`);
