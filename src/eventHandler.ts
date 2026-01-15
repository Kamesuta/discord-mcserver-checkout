import { Message, OmitPartialGroupDMChannel } from "discord.js";

/**
 * Sample function to reply with "Hello" when the bot is mentioned
 * @param message The message where the bot was mentioned
 */
export async function onMentionMessage(
  message: OmitPartialGroupDMChannel<Message>,
): Promise<void> {
  // Check if the bot was mentioned
  if (!message.mentions.has(message.client.user)) {
    return;
  }

  // Reply with "Hello" in the channel where the bot was mentioned
  await message.channel.send(`Hello! ${message.author.username}!`);
}
