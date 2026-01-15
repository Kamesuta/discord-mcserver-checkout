import assert from "assert";
import { parse } from "toml";
import { getWorkdirPath } from "./workdir.js";
import { copyFileSync, existsSync, readFileSync } from "fs";

/**
 * Structure of the configuration file
 */
export interface Config {
  /*
   * Configuration names should be written in snake_case. Therefore, we are disabling eslint naming rules here.
   * The 'requiresQuotes' rule is disabled here because it only excludes strings (including those with spaces) that need to be enclosed in quotes.
   */
  /* eslint-disable @typescript-eslint/naming-convention */

  /** Server IDs */
  guild_ids: string[];

  /* eslint-enable @typescript-eslint/naming-convention */
}

// If config.toml does not exist, copy config.default.toml
if (!existsSync(getWorkdirPath("config.toml"))) {
  copyFileSync(
    getWorkdirPath("config.default.toml"),
    getWorkdirPath("config.toml"),
  );
}

/** Configuration */
export const config: Config = parse(
  readFileSync(getWorkdirPath("config.toml"), "utf-8"),
) as Config;

// Check the types
// basic type: config.some_text_setting && typeof config.some_text_setting === 'string'
// object type: config.some_object_setting && typeof config.some_object_setting === 'object'
// array type: config.some_array_setting && Array.isArray(config.some_array_setting)
assert(
  config.guild_ids && Array.isArray(config.guild_ids),
  "guild_ids is required.",
);
