import {
  createPublicClient,
  http,
  createWalletClient,
  getContract,
  erc20Abi,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { ChainOptions, TransferWalletOptions, WalletFund } from "./types";
import { getChain, maybeToGwei } from "common";
import path from "path";

export async function fundWallet(
  fund: TransferWalletOptions,
  options: ChainOptions
) {
  try {
    console.log("=== Starting Funding Process ===");
    console.log(`Chain ID: ${options.chainId}`);

    const chain = getChain(options.chainId);
    const httpTransport = http(options.rpc);
    const client = createPublicClient({
      chain: chain,
      transport: httpTransport,
    });

    const wallets = JSON.parse(
      readFileSync(path.resolve(fund.toFundWalletsJsonFile)).toString()
    ) as WalletFund[];

    console.log("\n=== Wallet Configuration ===");
    console.log(`Total wallets to process: ${wallets.length}`);

    const isERC20 = fund.token !== "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    console.log(`\n=== Token Information ===`);
    console.log(`Token type: ${isERC20 ? "ERC20" : "ETH"}`);
    console.log(`Token address: ${fund.token}`);

    const tokenContract = getContract({
      address: fund.token,
      abi: erc20Abi,
      client: { public: client },
    });

    const tokenDecimals = isERC20
      ? await tokenContract.read.decimals()
      : chain.nativeCurrency.decimals;

    for (const wallet of wallets) {
      const sender = createWalletClient({
        chain: chain,
        transport: httpTransport,
        account: privateKeyToAccount(wallet.privateKey),
      });

      const transferHash = await sender.sendTransaction({
        to: fund.to,
        value: parseUnits(fund.amount, tokenDecimals),
        gas: fund.gasLimit,
        maxPriorityFeePerGas: maybeToGwei(fund.priorityGasPrice),
      });

      await client.waitForTransactionReceipt({ hash: transferHash });
      console.log(`Transfer complete. TX hash: ${transferHash}`);
    }

    console.log("All transactions submitted successfully");
  } catch (error) {
    console.error("\n=== Error in Funding Process ===");
    console.error("Details:", error);
    process.exit(1);
  }
}
