import { InteractionBase } from "../base/interaction_base.js";
import helloCommand from "./HelloCommand.js";
import helloWorldCommand from "./HelloWorldCommand.js";

const commands: InteractionBase[] = [
  helloCommand,
  helloWorldCommand,
  // Add other command groups here
];

export default commands;
