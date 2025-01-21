import dayjs from "dayjs";
import { ethers } from "ethers";
import { Wallet } from "./types";

import * as fs from "fs";
import * as path from "path";

export function createWallets(amount: number) {
  const wallets: Wallet[] = [];
  for (let i = 0; i < amount; i++) {
    const wallet = ethers.Wallet.createRandom();
    wallets.push({
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase,
      derivationPath: wallet.path ?? undefined,
    });
  }
  saveWallets(wallets, "random");
}

export function createWalletsFromMnemonic(
  mnemonic: string,
  amount: number,
  useLedgerPath: boolean = false
) {
  const wallets: Wallet[] = [];
  const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic);

  if (useLedgerPath) {
    // Ledger derivation path
    const root = ethers.HDNodeWallet.fromMnemonic(mnemonicObj);

    for (let i = 0; i < amount; ++i) {
      const wallet = root.deriveChild(i);
      wallets.push({
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: mnemonic,
        derivationPath: wallet.path ?? undefined,
      });
    }
  }
  for (let i = 0; i < amount; ++i) {
    // IndexedAccountPath
    // ref: https://docs.ethers.org/v6/api/wallet/#getIndexedAccountPath
    const path = `m/44'/60'/0'/0/${i}`;
    const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonicObj, path);
    wallets.push({
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: mnemonic,
      derivationPath: wallet.path ?? undefined,
    });
  }
  saveWallets(wallets, `mnemonic-${useLedgerPath ? "ledger" : "mm"}`);
}

function saveWallets(wallets: Wallet[], method: string) {
  const timestamp = dayjs().format("YYYY-MM-DD-HH-mm-ss");
  const fileName = `wallets-${method}-${timestamp}.json`;
  const outputDir = path.join(process.cwd(), "generated");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  fs.writeFileSync(
    path.join(outputDir, fileName),
    JSON.stringify(wallets, null, 2)
  );

  console.log(`Generated ${wallets.length} wallet(s)`);
  console.log(`Saved to: ${fileName}`);

  //   wallets.forEach((wallet, index) => {
  //     console.log(`\nWallet ${index + 1}:`);
  //     console.log(`Address: ${wallet.address}`);
  //     console.log(`Private Key: ${wallet.privateKey}`);
  //     if (wallet.mnemonic) {
  //       console.log(`Mnemonic: ${wallet.mnemonic}`);
  //     }
  //   });
}
