export interface ChainOptions {
  rpc: string;
  chainId: number;
}

export interface TransferWalletOptions {
  token: `0x${string}` | "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  to: `0x${string}`;
  amount: string;
  gasLimit?: bigint;
  priorityGasPrice?: string;
  toFundWalletsJsonFile: string;
}

export interface WalletFund {
  address: `0x${string}`;
  privateKey: `0x${string}`;
}
