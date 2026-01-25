import { fileURLToPath } from "node:url";
import { dirname, join } from "path";

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

/** root directory */
export const rootDir = join(_dirname, "..", "..");
/** root/src directory */
export const srcDir = join(rootDir, "src");

/** Path to the working directory */
export const workdir = process.env.APP_BASEDIR ?? "run";

/**
 * Get a path relative to the working directory
 * @param path Relative path from the working directory
 * @returns The path
 */
export function getWorkdirPath(path: string): string {
  return join(workdir, path);
}
