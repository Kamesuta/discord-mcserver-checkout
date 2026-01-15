# Robust TypeScript Template for Discord.js Bot Development

This is a template for building robust and scalable Discord bots using TypeScript and Discord.js.  
It is fully compatible with VSCode, allowing you to run and debug your bot with ease.  
The project includes ESLint and Prettier for enforcing code quality, and uses Husky to ensure clean commits.  
It also features a modular slash command system and optional Prisma integration for database access.

## 🚀 Features

- **Discord.js Interaction Command System**  
  Define slash commands as individual files inside the `src/commands` directory.  
  Easy to read and maintain — each command is self-contained.

- **Prisma-ready**  
  Includes setup for using [Prisma](https://www.prisma.io/) as your ORM with SQL databases.  
  If you don’t need it, see [Removing Prisma](#removing-prisma) below.

- **VSCode Ready**  
  Comes with launch configurations for debugging directly in VSCode using `F5`.

- **ESLint & Prettier**  
  Enforces strict code style and formatting.
  - Auto-fix on save for common issues.
  - Requires return types and JSDoc for better maintainability.

- **Husky & lint-staged**  
  Runs lint and formatting checks before each commit for consistent code quality.

- **Modern ESM Support**  
  Uses ESM syntax (`import/export`) out of the box.

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

3. Set up your environment variables and config:
   - Copy the `run/config.example.toml` file to `run/config.toml` and edit it as needed.
    ```toml
    # Server IDs
    guild_ids = ["0000000000000000000"]
    ```
   - Copy the `.env.example` file to `.env` and set your Discord bot token:
    ```env
    DISCORD_TOKEN=your_token_here
    ```

3. Run the bot:
   ```bash
   npm run start
   ```

4. Lint and format:
   ```bash
   npm run lint
   npm run prettier
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

1. Create a new command file in the appropriate directory:
   ```ts
   // src/commands/hello_command/HelloExampleCommand.ts
   import { ChatInputCommandInteraction, SlashCommandSubcommandBuilder } from 'discord.js';
   import { SubcommandInteraction } from '../base/command_base.js';
   import helloCommand from './HelloCommand.js';

   class HelloExampleCommand extends SubcommandInteraction {
      command = new SlashCommandSubcommandBuilder()
         .setName('example')
         .setDescription('Example command');

      async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
         await interaction.reply({ content: 'Hello world!' });
      }
   }

   export default new HelloExampleCommand(helloCommand);
   ```
2. Register the command in the appropriate commands list file:
   ```ts
   // src/commands/hello_command/commands.ts
   import helloExampleCommand from './HelloExampleCommand.js';

   const commands: InteractionBase[] = [
      // existing commands...
      helloExampleCommand, // Add your new command here
   ];
   ```
That's it! The command system will automatically register your new command with Discord when the bot starts.  
You can now use the command in Discord by typing `/hello example`.

## 🗑 Removing Prisma

If you don’t need a database:

1. Remove `import { PrismaClient }` and `new PrismaClient()` lines  from `src/index.ts`.
2. Remove `heroku-postbuild` line from `package.json`.
3. Uninstall the Prisma packages:
   ```bash
   npm uninstall prisma @prisma/client
   ```

## 🗄 Using Prisma

If you want to use Prisma:

1. npx prisma init
2. Edit the `prisma/schema.prisma` file to set up your database connection and models.
3. Add your database connection string to the `.env` file:
   ```env
   DATABASE_URL=your_database_connection_string
   ```
4. Run the following command to generate the Prisma client and create the initial migration:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```
