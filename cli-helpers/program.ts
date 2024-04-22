import { program } from "@commander-js/extra-typings";
import * as commands from "./src/commands";

let key: keyof typeof commands;

for (key in commands) {
    // eslint-disable-next-line import/namespace
    program.addCommand(commands[key]);
}

program.parse();
