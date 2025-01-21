export interface Wallet {
  address: string;
  privateKey?: string;
  mnemonic?: string;
  derivationPath?: string;
}
