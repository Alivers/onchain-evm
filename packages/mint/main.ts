import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  parseGwei,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import * as fs from "fs";
import { resolve } from "path";
import dayjs from "dayjs";

const MintAbi = [
  {
    type: "function",
    name: "MAX_SUPPLY",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint32",
        internalType: "uint32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalMinted",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint32",
        internalType: "uint32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mint",
    inputs: [
      {
        name: "to",
        type: "address",
        internalType: "address",
      },
      {
        name: "nftAmount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
] as const;

async function main() {
  const client = createPublicClient({
    chain: mainnet,
    transport: http(),
  });
  const contract = getContract({
    abi: MintAbi,
    address: "0x0000000000000000000000000000000000000000",
    client: createWalletClient({
      chain: mainnet,
      transport: http(),
      account: privateKeyToAccount("0x"),
    }),
  });

  const timestamp = dayjs().format("YYYY-MM-DD_HH-mm-ss");
  const logFilePath = resolve(__dirname, `mint-tx-${timestamp}.csv`);

  const [maxSupply, totalMinted] = await Promise.all([
    contract.read.MAX_SUPPLY(),
    contract.read.totalMinted(),
  ]);
  const availableSupply = BigInt(maxSupply - totalMinted);

  // Create CSV header
  fs.writeFileSync(
    logFilePath,
    "Transaction,Status,Block,GasUsed,AmountMinted,Timestamp\n",
    "utf8"
  );

  for (let minted = 0n; minted < availableSupply; ) {
    const mintAmount = BigInt(Math.min(1024, Number(availableSupply - minted)));
    const tx = await contract.write.mint(
      ["0x0000000000000000000000000000000000000000", mintAmount],
      {
        gasPrice: parseGwei("1"),
      }
    );

    const receipt = await client.waitForTransactionReceipt({ hash: tx });

    const csvRow =
      [
        receipt.transactionHash,
        receipt.status === "success" ? "Success" : "Failed",
        receipt.blockNumber,
        receipt.gasUsed,
        mintAmount.toString(),
        dayjs().format("YYYY-MM-DD HH:mm:ss"),
      ].join(",") + "\n";

    fs.appendFileSync(logFilePath, csvRow, "utf8");
    console.log(
      `Minted ${mintAmount} tokens. Transaction: ${receipt.transactionHash}`
    );

    minted += mintAmount;
  }

  console.log(`Transaction logs saved to: ${logFilePath}`);
}

main()
  .then(() => {
    console.log("Minting completed");
  })
  .catch((error) => {
    console.error("Error during minting:", error);
  });
