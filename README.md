# Robust TypeScript Template for Discord.js Bot Development

This is a template for building robust and scalable Discord bots using TypeScript and Discord.js.  
It is fully compatible with VSCode, allowing you to run and debug your bot with ease.  
The project includes Biome for enforcing code quality, and uses Husky to ensure clean commits.  
It also features a modular slash command system and optional Prisma integration for database access.

## 🚀 Features

- **Sapphire Framework**
  Utilizes the power of Sapphire for handling commands, events, and more.
  Features a file-based command structure for easy organization.

- **Prisma-ready**  
  Includes setup for using [Prisma](https://www.prisma.io/) as your ORM with SQL databases.  
  If you don’t need it, see [Removing Prisma](#removing-prisma) below.

- **VSCode Ready**  
  Comes with launch configurations for debugging directly in VSCode using `F5`.

- **Biome**  
  Enforces strict code style and formatting. Replaces ESLint and Prettier for faster and more unified tooling.

- **Husky**  
  Runs lint and formatting checks before each commit for consistent code quality.

- **Modern ESM Support**  
  Uses ESM syntax (`import/export`) out of the box.

- **Type-safe Environment Variables**  
  Uses [envalid](https://github.com/af/envalid) to validate and type-check environment variables.

## 📦 Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/Kamesuta/discordjs-typescript-template.git
   cd discordjs-typescript-template
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables:
   - Copy the `.env.example` file to `.env` and set your Discord bot token:
    ```env
    DISCORD_TOKEN=your_token_here
    GUILD_ID=your_guild_id_here
    ```

4. Run the bot:
   ```bash
   npm run start
   ```

5. Lint and format with Biome:
   ```bash
   npm run lint:fix
   ```

## 📁 Project Structure

```
prisma/                # Prisma schema and client
src/
├── commands/          # 1 file = 1 slash command
├── utils/               # Utilities (e.g., logging, config)
└── index.ts           # Bot entry point
```

## 🎮 Adding a New Command
To add a new command to the Discord bot:

1.  Create a new command file in `src/commands/general` (or any other category folder).
2.  Extend the `Command` class from `@sapphire/framework`.
3.  Implement the `chatInputRun` method.
4.  Register the command (Sapphire automatically loads commands from the `commands` directory).

   ```ts
   // src/commands/general/ping.ts
   import { ApplyOptions } from '@sapphire/decorators';
   import { Command } from '@sapphire/framework';

   @ApplyOptions<Command.Options>({
     description: 'ping pong'
   })
   export class UserCommand extends Command {
     public override registerApplicationCommands(registry: Command.Registry) {
       registry.registerChatInputCommand((builder) =>
         builder.setName('ping').setDescription('ping pong')
       );
     }

     public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
       return interaction.reply({ content: 'Pong!' });
     }
   }
   ```
3. That's it! The command system will automatically register your new command with Discord when the bot starts.
   You can now use the command in Discord by typing `/ping`.

## 🌱 Environment Variables

This project uses `envalid` to ensure all required environment variables are present and correctly typed.
The configuration is located in `src/utils/env.ts`.

To add a new environment variable:
1. Add the variable to your `.env` file.
2. Define the validator in `src/utils/env.ts`.

```ts
// src/utils/env.ts
import { cleanEnv, str } from "envalid";

export default cleanEnv(process.env, {
  // ... existing variables
  NEW_VARIABLE: str(),
});
```

## 🗑 Removing Prisma

If you don’t need a database:

1. Remove `src/utils/prisma.ts`, `prisma.config.ts`.
2. Remove `heroku-postbuild` line from `package.json`.
3. Uninstall the Prisma packages:
   ```bash
   npm uninstall prisma @prisma/client @prisma/adapter-mariadb
   ```

## 🗄 Using Prisma

If you want to use Prisma:

1. npx prisma init
2. Edit the `prisma/schema.prisma`, `prisma.config.ts` file to set up your database connection and models.
3. Add your database connection string to the `.env` file:
   ```env
   DATABASE_URL=your_database_connection_string
   ```
4. Run the following command to generate the Prisma client and create the initial migration:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```
