import { existsSync, readFileSync } from "fs";
import { isArray, isObject } from "lodash";
import path from "path";
import { parseGwei } from "viem";
import * as chains from "viem/chains";

export function getChain(chainId: number) {
  for (const chain of Object.values(chains)) {
    if (chain.id === chainId) {
      return chain;
    }
  }

  throw new Error(`Chain with id ${chainId} not found`);
}

export function maybeToGwei(value: string | undefined) {
  return value ? parseGwei(value) : undefined;
}

export function readMnemonic(mnemonicStore: string): string {
  if (existsSync(mnemonicStore)) {
    // If it is a file, read it.
    const mnemonic = readFileSync(path.resolve(mnemonicStore), "utf-8");

    if (isJson(mnemonic)) {
      const mnemonicObj = JSON.parse(mnemonic);
      if (isArray(mnemonicObj)) {
        return mnemonicObj.join(" ");
      }
      if (isObject(mnemonicObj)) {
        return isArray(mnemonicObj["mnemonic"])
          ? mnemonicObj["mnemonic"].join(" ")
          : mnemonicObj["mnemonic"];
      }
      return mnemonic;
    } else {
      return mnemonic;
    }
  } else {
    // If it is not a file, it is a mnemonic.
    return mnemonicStore;
  }
}

export function isJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}
