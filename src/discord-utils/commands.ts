import { CommandMention } from "./CommandMention.js";

/**
 * コマンドへのメンション。
 * 他のコマンドへメンションする際はここに追記して使うこと
 */
class CommandMentions {
  readonly mcserverCheckout = new CommandMention("mcserver/checkout");
  readonly mcserverResetPassword = new CommandMention(
    "mcserver/reset-password",
  );
  readonly mcserverOp = new CommandMention("mcserver-op");
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
