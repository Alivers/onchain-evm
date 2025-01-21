import {
  createPublicClient,
  http,
  createWalletClient,
  Hex,
  getContract,
  erc20Abi,
  parseEther,
  parseUnits,
  formatEther,
  formatUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { ChainOptions, FundWalletOptions, WalletFund } from "./types";
import { getChain, maybeToGwei, DisperseAbi, DisperseAddress } from "common";
import { chunk } from "lodash";
import path from "path";

export async function fundWallet(
  fund: FundWalletOptions,
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

    const funder = createWalletClient({
      chain: chain,
      transport: httpTransport,
      account: privateKeyToAccount(fund.baseWalltPrivateKey as Hex),
    });

    const wallets: Required<WalletFund>[] = (
      JSON.parse(
        readFileSync(path.resolve(fund.toFundWalletsJsonFile)).toString()
      ) as WalletFund[]
    )
      .map((w) => ({
        address: w.address,
        amount: w.amount ?? fund.amount,
      }))
      .filter(
        (w) => w.amount && Number(w.amount) > 0
      ) as Required<WalletFund>[];

    console.log("\n=== Wallet Configuration ===");
    console.log(`Funder address: ${funder.account.address}`);
    console.log(`Batch size: ${fund.walletsPerBatch} wallets`);
    console.log(`Total wallets to process: ${wallets.length}`);
    console.log(
      `Number of batches: ${Math.ceil(wallets.length / fund.walletsPerBatch)}`
    );

    const isERC20 = fund.token !== "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    console.log(`\n=== Token Information ===`);
    console.log(`Token type: ${isERC20 ? "ERC20" : "ETH"}`);
    console.log(`Token address: ${fund.token}`);

    const tokenContract = getContract({
      address: fund.token,
      abi: erc20Abi,
      client: { public: client, wallet: funder },
    });

    const funderETHBalance = await client.getBalance({
      address: funder.account.address,
    });
    console.log(`\n=== Balance Information ===`);
    console.log(`Funder ETH balance: ${formatEther(funderETHBalance)}`);

    const tokenDecimals = isERC20
      ? await tokenContract.read.decimals()
      : chain.nativeCurrency.decimals;

    let funderBalance = funderETHBalance;
    if (isERC20) {
      funderBalance = await tokenContract.read.balanceOf([
        funder.account.address,
      ]);
      console.log(
        `Funder ${tokenContract.address} balance: ${formatUnits(
          funderBalance,
          tokenDecimals
        )}`
      );
    }

    const disperseClient = getContract({
      address: DisperseAddress,
      abi: DisperseAbi,
      client: { public: client, wallet: funder },
    });

    if (isERC20) {
      const totalTokenSpend = wallets.reduce(
        (acc, w) => acc + parseUnits(w.amount, tokenDecimals),
        0n
      );
      console.log("\n=== ERC20 Distribution ===");
      console.log(
        `Total tokens to distribute: ${formatUnits(
          totalTokenSpend,
          tokenDecimals
        )}`
      );
      console.log(`Gas price (priority fee): ${fund.priorityGasPrice} gwei`);

      console.log(
        `\nApproving token transfer (amount: ${formatUnits(
          totalTokenSpend,
          tokenDecimals
        )})...`
      );
      const approvedHash = await tokenContract.write.approve(
        [DisperseAddress, totalTokenSpend],
        {
          maxPriorityFeePerGas: maybeToGwei(fund.priorityGasPrice),
        }
      );
      await client.waitForTransactionReceipt({ hash: approvedHash });
      console.log(`Approval transaction hash: ${approvedHash}`);

      console.log("\nStarting token distribution...");
      let batchNumber = 1;
      for (const batch of chunk(wallets, fund.walletsPerBatch)) {
        console.log(
          `\nProcessing batch ${batchNumber}/${Math.ceil(
            wallets.length / fund.walletsPerBatch
          )}`
        );
        console.log(
          `Batch size: ${
            batch.length
          } wallets, to distribute tokens: ${formatUnits(
            batch.reduce(
              (acc, w) => acc + parseUnits(w.amount, tokenDecimals),
              0n
            ),
            tokenDecimals
          )}`
        );
        const transferHash = await disperseClient.write.disperseToken(
          [
            fund.token,
            batch.map((w) => w.address),
            batch.map((w) => parseUnits(w.amount, tokenDecimals)),
          ],
          {
            gas: fund.gasLimit,
            maxPriorityFeePerGas: maybeToGwei(fund.priorityGasPrice),
          }
        );

        await client.waitForTransactionReceipt({ hash: transferHash });

        console.log(`Batch ${batchNumber} complete. TX hash: ${transferHash}`);
        batchNumber++;
      }
    } else {
      console.log("\n=== ETH Distribution ===");
      console.log(`Gas price (priority fee): ${fund.priorityGasPrice} gwei`);

      let batchNumber = 1;
      for (const batch of chunk(wallets, fund.walletsPerBatch)) {
        console.log(
          `\nProcessing batch ${batchNumber}/${Math.ceil(
            wallets.length / fund.walletsPerBatch
          )}`
        );
        const ethToDistribute = batch.reduce(
          (acc, w) => acc + parseEther(w.amount),
          0n
        );
        console.log(
          `Batch size: ${
            batch.length
          } wallets, to distribute ETH: ${formatEther(ethToDistribute)}`
        );
        const transferHash = await disperseClient.write.disperseEther(
          [batch.map((w) => w.address), batch.map((w) => parseEther(w.amount))],
          {
            value: ethToDistribute,
            gas: fund.gasLimit,
            maxPriorityFeePerGas: maybeToGwei(fund.priorityGasPrice),
          }
        );
        await client.waitForTransactionReceipt({ hash: transferHash });
        console.log(`Batch ${batchNumber} complete. TX hash: ${transferHash}`);
        batchNumber++;
      }
    }

    console.log("\n=== Funding Process Complete ===");
    console.log("All transactions submitted successfully");
  } catch (error) {
    console.error("\n=== Error in Funding Process ===");
    console.error("Details:", error);
    process.exit(1);
  }
}
