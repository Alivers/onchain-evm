import {
  createPublicClient,
  createWalletClient,
  erc721Abi,
  formatUnits,
  getContract,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

/**
 * Watch for a specific event on a contract
 * TODO: Change the values of the following variables to match your needs
 * !!! Donot upload your private key or private rpc to a public repository
 */
const config = {
  pk: "0x" as const,
  network: mainnet,
  contractAddressToWatch: "0x" as const,
  abiOfEventToWatch: erc721Abi[2],
  rpcURL: "",
  contractAddressToCall: "0x" as const,
  abiOfContractToCall: erc721Abi,
};

async function watch() {
  const httpTransport = http(config.rpcURL);
  const client = createPublicClient({
    chain: config.network,
    transport: httpTransport,
  });
  const me = createWalletClient({
    chain: config.network,
    transport: httpTransport,
    account: privateKeyToAccount(config.pk),
  });

  client.watchContractEvent({
    address: config.contractAddressToWatch,
    abi: [config.abiOfEventToWatch],
    onLogs: async (logs) => {
      // TODO: Do something with the logs
      console.log(logs);

      // Example: Call a contract function
      const contract = getContract({
        abi: config.abiOfContractToCall,
        address: config.contractAddressToCall,
        client: { public: client, wallet: me },
      });

      const txHash = await contract.write.transferFrom([
        me.account.address,
        "0x",
        logs[0].args.tokenId ?? 0n,
      ]);

      console.log(`Call ${config.contractAddressToCall} txHash: ${txHash}`);
      const receipt = await client.waitForTransactionReceipt({ hash: txHash });
      console.table({
        hash: txHash,
        block: receipt.blockNumber,
        gasUsed: formatUnits(
          receipt.gasUsed,
          config.network.nativeCurrency.decimals
        ),
      });
    },
    onError: (error) => {
      console.error(error);
    },
  });
}

watch().catch(console.error);
