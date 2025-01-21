import { Command } from "commander";
import inquirer from "inquirer";
import { getChain } from "common";
import { fundWallet } from "./fund";

const program = new Command();

program
  .name("Disperse Fund")
  .description("Fund multiple wallets with ETH or ERC20 tokens")
  .version("1.0.0")
  .action(async () => {
    inquirer
      .prompt([
        {
          type: "number",
          name: "chainId",
          message: "Chain ID: ",
          default: 1,
        },
        {
          type: "input",
          name: "rpc",
          message: "RPC endpoint URL: ",
          default: getChain(1).rpcUrls.default.http[0],
        },
        {
          type: "input",
          name: "priotityGasPrice",
          message: "Priority gas price (Gwei): ",
          default: "5",
        },
        {
          type: "password",
          name: "privateKey",
          message: "Private key of the funding wallet: ",
          mask: "*",
        },
        {
          type: "input",
          name: "tokenAddress",
          message: "Token address (Default ETH): ",
          default: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },
        {
          type: "input",
          name: "amount",
          message: "Amount each wallet(0.1 means 0.1 eth): ",
          default: "0.1",
        },
        {
          type: "number",
          name: "batchSize",
          message: "Number of wallets to fund per batch: ",
          default: 100,
        },
        {
          type: "input",
          name: "file",
          message: "JSON file containing wallet addresses and amounts: ",
        },
      ])
      .then((answers) => {
        console.log("Your funding options: ");
        console.table(answers);
        inquirer
          .prompt([
            {
              type: "confirm",
              name: "confirm",
              message: "Confirm to fund wallets?",
            },
          ])
          .then((confirmed) => {
            if (!confirmed.confirm) {
              console.log("User cancelled the operation");
              return;
            }

            fundWallet(
              {
                baseWalltPrivateKey: answers.privateKey,
                amount: answers.amount,
                token: answers.tokenAddress,
                walletsPerBatch: answers.batchSize,
                toFundWalletsJsonFile: answers.file,
                priorityGasPrice: answers.priotityGasPrice,
              },
              { chainId: answers.chainId, rpc: answers.rpc }
            );
          });
      });
  });

program.parse(process.argv);
