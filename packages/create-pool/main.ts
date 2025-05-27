import {
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  http,
  parseGwei,
  createPublicClient,
} from "viem";
import { bsc } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { Metamask7702DelegatorAbi } from "abi/Metamask7702Delegator";
import { PancakeV3ManagerAbi } from "abi/PancakeV3Manager";
import { PancakeSmartRouterV3Abi } from "abi/PancakeSmartRouterV3";
import Big from "big.js";
import { ERC20Abi } from "abi/ERC20";

import { PancakeMath } from "./pancake-math";

const Metamask7702Delegator: `0x${string}` =
  "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B";
const PancakeV3Manager: `0x${string}` =
  "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364";
const PancakeSmartRouterV3: `0x${string}` =
  "0x13f4ea83d0bd40e75c8222255bc855a974568dd4";

const WBNB: `0x${string}` = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const TestToken: `0x${string}` = "0x0000000000000000000000000000000000000000";
const FeeRate = 2500;

const PancakeMathFor = new PancakeMath(WBNB, TestToken, FeeRate);

const BnbPriceUSD = new Big(680);
const TokenPriceUSD = {
  Initial: new Big(0.1),
  Min: new Big(0.05),
  Max: new Big(100),
  Target: new Big(1),
}

const DECIMAL_SCALE = new Big(10).pow(18);
const BNB_AMOUNT = new Big(0.1).mul(DECIMAL_SCALE);

const tickInitial = PancakeMathFor.getTickFromPrice(BnbPriceUSD, TokenPriceUSD.Initial);
const tickLower = PancakeMathFor.getTickFromPrice(BnbPriceUSD, TokenPriceUSD.Min);
const tickUpper = PancakeMathFor.getTickFromPrice(BnbPriceUSD, TokenPriceUSD.Max);
const tickTarget = PancakeMathFor.getTickFromPrice(BnbPriceUSD, TokenPriceUSD.Target);

const { amountBDesired: liquidityRequiredTokenAmount, L: liquidityRequired } = PancakeMathFor.calculateLiquidityRequiredByA(
  BNB_AMOUNT,
  BnbPriceUSD.mul(PancakeMathFor.getPriceFromTick(tickLower)),
  BnbPriceUSD.mul(PancakeMathFor.getPriceFromTick(tickUpper)),
  BnbPriceUSD.mul(PancakeMathFor.getPriceFromTick(tickInitial)),
  BnbPriceUSD,
);

const swapRequiredBnbAmount = PancakeMathFor.calculateNeeded(
  BnbPriceUSD.mul(PancakeMathFor.getPriceFromTick(tickTarget)),
  BnbPriceUSD.mul(PancakeMathFor.getPriceFromTick(tickInitial)),
  BnbPriceUSD.mul(PancakeMathFor.getPriceFromTick(tickUpper)),
  BnbPriceUSD,
  liquidityRequired,
);

async function signAuth(config: Config) {
  const wallet = createWalletClient({
    account: privateKeyToAccount(config.privateKey),
    chain: bsc,
    transport: http(config.rpc),
  });

  const auth = await wallet.signAuthorization({
    address: Metamask7702Delegator,
    executor: "self",
  });

  const hash = await wallet.sendTransaction({
    authorizationList: [auth],
    data: "0x",
    to: wallet.account.address,
  });

  console.log(`sign auth tx hash: ${hash}`);
}

async function createPool(config: Config) {
  const wallet = createWalletClient({
    account: privateKeyToAccount(config.privateKey),
    chain: bsc,
    transport: http(config.rpc),
  });

  const createPoolAddLiquidityData = encodeFunctionData({
    abi: PancakeV3ManagerAbi,
    functionName: "multicall",
    args: [
      [
        encodeFunctionData({
          abi: PancakeV3ManagerAbi,
          functionName: "createAndInitializePoolIfNecessary",
          args: [
            TestToken,
            WBNB,
            FeeRate,
            BigInt(PancakeMathFor.getSqrtPriceFromTick(tickInitial).toFixed(0)),
          ],
        }),
        encodeFunctionData({
          abi: PancakeV3ManagerAbi,
          functionName: "mint",
          args: [
            {
              token0: TestToken,
              token1: WBNB,
              fee: FeeRate,
              tickLower: tickLower,
              tickUpper: tickUpper,
              amount0Desired: BigInt(liquidityRequiredTokenAmount.toFixed(0)),
              // Add 0.1 BNB liquidity
              amount1Desired: BigInt(BNB_AMOUNT.toFixed(0)),
              // Set minimum amounts to 5% slippage
              amount0Min: BigInt(liquidityRequiredTokenAmount.mul(0.90).toFixed(0)),
              amount1Min: BigInt(BNB_AMOUNT.mul(0.90).toFixed(0)),
              recipient: wallet.account.address,
              deadline: 1748496106n,
            },
          ],
        }),
      ],
    ],
  });

  const swapToData = encodeFunctionData({
    abi: PancakeSmartRouterV3Abi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: WBNB,
        tokenOut: TestToken,
        fee: FeeRate,
        recipient: wallet.account.address,
        amountIn: BigInt(swapRequiredBnbAmount.toFixed(0)),
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: BigInt(PancakeMathFor.getSqrtPriceFromTick(tickTarget).toFixed(0)),
      },
    ],
  });

  const callMode =
    "0x0100000000000000000000000000000000000000000000000000000000000000";
  const execData = encodeAbiParameters(
    [
      {
        type: "tuple[]",
        components: [
          { type: "address", name: "target" },
          { type: "uint256", name: "value" },
          { type: "bytes", name: "callData" },
        ],
      },
    ],
    [
      [
        {
          target: TestToken,
          value: 0n,
          callData: encodeFunctionData({
            abi: ERC20Abi,
            functionName: "approve",
            args: [PancakeV3Manager, 2n ** 256n - 1n],
          }),
        },
        {
          target: PancakeV3Manager,
          value: BigInt(BNB_AMOUNT.toFixed(0)),
          callData: createPoolAddLiquidityData,
        },
        {
          target: PancakeSmartRouterV3,
          value: BigInt(swapRequiredBnbAmount.toFixed(0)),
          callData: swapToData,
        },
      ],
    ]
  );

  // const publicClient = createPublicClient({
  //   chain: bsc,
  //   transport: http(config.rpc),
  // });
  // const gas = await publicClient.estimateContractGas({
  //   account: wallet.account,
  //   address: wallet.account.address,
  //   abi: Metamask7702DelegatorAbi,
  //   functionName: "execute",
  //   args: [callMode, execData],
  // });
  // console.log(gas);

  const bundleData = encodeFunctionData({
    abi: Metamask7702DelegatorAbi,
    functionName: "execute",
    args: [callMode, execData],
  });

  const hash = await wallet.sendTransaction({
    to: wallet.account.address,
    data: bundleData,
    gasPrice: parseGwei("0.1"),
  });

  console.log(`create pool tx hash: ${hash}`);
}

interface Config {
  privateKey: `0x${string}`;
  rpc: string;
}

async function main() {
  const config = {
    privateKey: "" as `0x${string}`,
    rpc: "",
  };

  // await signAuth(config);
  await createPool(config);
  console.log(swapRequiredBnbAmount.div(DECIMAL_SCALE).toFixed());
  // console.log(liquidityRequiredTokenAmount.div(DECIMAL_SCALE).toFixed(0));
  // console.log(PancakeMathFor.getTickFromPrice(BnbPriceUSD, TokenPriceUSD.Min));
  // console.log(PancakeMathFor.getTickFromPrice(BnbPriceUSD, TokenPriceUSD.Max));
  // console.log(PancakeMathFor.getSqrtPriceX96(BnbPriceUSD, TokenPriceUSD.Initial).toFixed(0))
}

main()
  .then(() => {
    console.log("done");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
