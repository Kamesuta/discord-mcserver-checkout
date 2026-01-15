import { logger } from "./utils/log.js";
import { nowait } from "./utils/utils.js";
import { Client, Events, GatewayIntentBits } from "discord.js";
import CommandHandler from "./commands/CommandHandler.js";
import commands from "./commands/commands.js";
import { onMentionMessage } from "./eventHandler.js";

/**
 * Discord Client
 */
export const client: Client = new Client({
  // Specify the Gateway Intents used by the bot
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

/**
 * Command Handler
 */
const commandHandler = new CommandHandler(commands);

// Register interaction handlers
client.on(
  Events.ClientReady,
  nowait(async () => {
    logger.info(`Logged in as ${client.user?.username ?? "Unknown"}!`);

    // Register commands
    await commandHandler.registerCommands();

    logger.info(`Interaction registration completed`);
  }),
);
client.on(
  Events.InteractionCreate,
  nowait(commandHandler.onInteractionCreate.bind(commandHandler)),
);

// Event handler sample: Respond with "Hello" when mentioned
client.on(Events.MessageCreate, nowait(onMentionMessage));

// Log in to Discord
await client.login(process.env.DISCORD_TOKEN);
