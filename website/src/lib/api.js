import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiData = JSON.parse(fs.readFileSync(resolveApiDataPath(), "utf8"));

export const apiNavigation = apiData.navigation;
export const apiOverview = apiData.overview;
export const apiPages = apiData.pages;
export const apiTypes = apiData.types;
export const apiExportsByGroup = apiData.exportsByGroup;

function resolveApiDataPath() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(process.cwd(), "src", "generated", "api.json"),
    path.join(process.cwd(), "website", "src", "generated", "api.json"),
    path.join(moduleDir, "..", "generated", "api.json"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to locate generated API metadata. Checked: ${candidates.join(", ")}`,
  );
}
