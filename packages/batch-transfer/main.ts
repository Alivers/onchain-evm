import { Command } from "commander";
import inquirer from "inquirer";
import { getChain } from "common";
import { fundWallet } from "./transfer";

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
          type: "input",
          name: "tokenAddress",
          message: "Token address (Default ETH): ",
          default: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },
        {
          type: "input",
          name: "amount",
          message: "Amount each wallet to send(0.1 means 0.1 eth): ",
          default: "0.1",
        },
        {
          type: "input",
          name: "transferTo",
          message: "Transfer To: ",
        },
        {
          type: "input",
          name: "file",
          message: "JSON file containing wallet addresses: ",
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
                amount: answers.amount,
                to: answers.transferTo,
                token: answers.tokenAddress,
                toFundWalletsJsonFile: answers.file,
                priorityGasPrice: answers.priotityGasPrice,
              },
              { chainId: answers.chainId, rpc: answers.rpc }
            );
          });
      });
  });

program.parse(process.argv);
