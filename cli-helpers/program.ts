import { program } from "@commander-js/extra-typings";
import createAvlMockDataProducer from "./src/commands/create-avl-mock-data-producer";
import invokeAvlDataEndpoint from "./src/commands/invoke-avl-data-endpoint";
import invokeNocRetriever from "./src/commands/invoke-noc-retriever";

program.addCommand(createAvlMockDataProducer);
program.addCommand(invokeAvlDataEndpoint);
program.addCommand(invokeNocRetriever);
program.parse();
