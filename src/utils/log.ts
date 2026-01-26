import { type ILogger, LogLevel } from "@sapphire/framework";
import log4js from "log4js";
import { getWorkdirPath } from "./workdir.js";

// ロガーを初期化
log4js.configure({
  appenders: {
    file: {
      type: "file",
      filename: getWorkdirPath("bot.log"),
    },
    console: {
      type: "console",
    },
  },
  categories: {
    default: {
      appenders: ["file", "console"],
      level: "info",
    },
  },
});

/** log4jsのロガー */
export const logger = log4js.getLogger("app");

/** Sapphireのログレベルとlog4jsのレベルの対応表 */
const levelMap: Record<LogLevel, string> = {
  [LogLevel.None]: "off",
  [LogLevel.Trace]: "trace",
  [LogLevel.Debug]: "debug",
  [LogLevel.Info]: "info",
  [LogLevel.Warn]: "warn",
  [LogLevel.Error]: "error",
  [LogLevel.Fatal]: "fatal",
};

/** Sapphireのログインターフェースをlog4jsのロガーに変換する */
export const sapphireLogger: ILogger = {
  trace: (msg, ...v) => logger.trace(msg, ...v),
  debug: (msg, ...v) => logger.debug(msg, ...v),
  info: (msg, ...v) => logger.info(msg, ...v),
  warn: (msg, ...v) => logger.warn(msg, ...v),
  error: (msg, ...v) => logger.error(msg, ...v),
  fatal: (msg, ...v) => logger.fatal(msg, ...v),

  has(level) {
    return levelMap[level] !== undefined;
  },

  write(level, ...values) {
    logger.log(levelMap[level] ?? "info", ...values);
  },
};
