export interface ChainOptions {
  rpc: string;
  chainId: number;
}

export interface FundWalletOptions {
  baseWalltPrivateKey: string;
  token: `0x${string}` | "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  amount?: string;
  gasLimit?: bigint;
  priorityGasPrice?: string;
  walletsPerBatch: number;
  toFundWalletsJsonFile: string;
}

export interface WalletFund {
  address: `0x${string}`;
  amount?: string;
}
