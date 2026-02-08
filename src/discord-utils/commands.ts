import { CommandMention } from "./CommandMention.js";

class CommandMentions {
  readonly mcserverCheckout = new CommandMention("mcserver/checkout");
  readonly mcserverResetPassword = new CommandMention(
    "mcserver/reset-password",
  );
  readonly mcserverOpUserRegister = new CommandMention(
    "mcserver-op/user/register",
  );
  readonly mcserverOpWorkflowEdit = new CommandMention(
    "mcserver-op/workflow/edit",
  );
  readonly mcserverOpArchiveList = new CommandMention(
    "mcserver-op/archive/list",
  );
  readonly mcserverOpArchiveGet = new CommandMention("mcserver-op/archive/get");
}

export const commandMentions = new CommandMentions();
