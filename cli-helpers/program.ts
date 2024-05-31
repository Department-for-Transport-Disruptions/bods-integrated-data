import { program } from "@commander-js/extra-typings";
import * as commands from "./src/commands";

let key: keyof typeof commands;

for (key in commands) {
    program.addCommand(commands[key]);
}

program.parse();
