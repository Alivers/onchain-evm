import { Command } from "commander";
import inquirer from "inquirer";
import { createWallets, createWalletsFromMnemonic } from "./wallet";
import { readMnemonic } from "common";

const program = new Command();

const wallletCommand = program.description("Wallet operations");

wallletCommand
  .command("create")
  .description("Generate a random wallet")
  .option("-n, --number <number>", "Number of wallets to generate", "1")
  .action(async (options) => {
    createWallets(parseInt(options.number));
  });

wallletCommand
  .command("import")
  .description("Generate wallet(s) from existing mnemonic")
  .action(async () => {
    inquirer
      .prompt([
        {
          type: "input",
          name: "mnemonic",
          message: "Mnemonic phrase or file: ",
        },
        {
          type: "number",
          name: "walletNumber",
          message: "Number of wallets to derive: ",
          default: 1,
        },
        {
          type: "confirm",
          name: "useLedgerPath",
          message: "Whether use Ledger derive path or not: ",
          default: false,
        },
      ])
      .then((answers) => {
        createWalletsFromMnemonic(
          readMnemonic(answers.mnemonic)!,
          answers.walletNumber,
          answers.useLedgerPath
        );
      });
  });

program.parse(process.argv);
