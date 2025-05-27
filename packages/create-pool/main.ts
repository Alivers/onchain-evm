import {
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  http,
  parseGwei,
} from "viem";
import { bsc } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { Metamask7702DelegatorAbi } from "abi/Metamask7702Delegator";
import { PancakeV3ManagerAbi } from "abi/PancakeV3Manager";
import { PancakeSmartRouterV3Abi } from "abi/PancakeSmartRouterV3";
import Big from "big.js";
import { ERC20Abi } from "abi/ERC20";

const Metamask7702Delegator: `0x${string}` =
  "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B";
const PancakeV3Manager: `0x${string}` =
  "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364";
const PancakeSmartRouterV3: `0x${string}` =
  "0x13f4ea83d0bd40e75c8222255bc855a974568dd4";

const WBNB: `0x${string}` = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const TestToken: `0x${string}` = "0x";

// Price constants
const BNB_PRICE_USD = new Big(680);
const INITIAL_PRICE_USD = new Big(0.1);
const TARGET_PRICE_USD = new Big(2);

// Constants for calculations
const Q96 = new Big(2).pow(96);
const BNB_AMOUNT = new Big(0.1);
const TICK_RANGE = new Big(100);

const DECIMAL_SCALE = new Big(10).pow(18);

// Calculate ticks
const getTickFromPrice = (price: Big) => {
  // tick = log(price/BNB_PRICE_USD) / log(1.0001)
  const relativePrice = price.div(BNB_PRICE_USD).toNumber();
  return Math.floor(Math.log(relativePrice) / Math.log(1.0001));
};

const initialTick = getTickFromPrice(INITIAL_PRICE_USD);
const targetTick = getTickFromPrice(TARGET_PRICE_USD);

// Calculate sqrtPriceX96
const getSqrtPriceX96 = (price: Big) => {
  // sqrtPriceX96 = sqrt(price/BNB_PRICE_USD) * 2^96
  return price.div(BNB_PRICE_USD).sqrt().mul(Q96).round(0, Big.roundDown);
};

// Calculate token amount for liquidity
const getTokenAmount = (bnbAmount: Big, price: Big) => {
  return bnbAmount.mul(BNB_PRICE_USD).div(price).round(0, Big.roundDown);
};

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
            WBNB,
            TestToken,
            10000, // fee tier: 1%
            // Initial price: INITIAL_PRICE_USD USD per BNB
            BigInt(getSqrtPriceX96(INITIAL_PRICE_USD).toFixed(0)),
          ],
        }),
        encodeFunctionData({
          abi: PancakeV3ManagerAbi,
          functionName: "mint",
          args: [
            {
              token0: WBNB,
              token1: TestToken,
              fee: 10000,
              // Set tick range around initial price
              tickLower: initialTick - TICK_RANGE.toNumber(),
              tickUpper: initialTick + TICK_RANGE.toNumber(),
              // Add 0.1 BNB liquidity
              amount0Desired: BigInt(BNB_AMOUNT.mul(DECIMAL_SCALE).toFixed(0)),
              // At initial price, calculate corresponding token amount
              amount1Desired: BigInt(
                getTokenAmount(BNB_AMOUNT, INITIAL_PRICE_USD)
                  .mul(DECIMAL_SCALE)
                  .toFixed(0)
              ),
              amount0Min: 0n,
              amount1Min: 0n,
              recipient: wallet.account.address,
              deadline: 0n,
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
        fee: 10000,
        recipient: wallet.account.address,
        // Use 0.1 BNB to swap
        amountIn: BigInt(BNB_AMOUNT.mul(DECIMAL_SCALE).toFixed()),
        amountOutMinimum: 0n,
        // Target price: TARGET_PRICE_USD USD per BNB
        sqrtPriceLimitX96: BigInt(getSqrtPriceX96(TARGET_PRICE_USD).toFixed(0)),
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
        // {
        //   target: TestToken,
        //   value: 0n,
        //   callData: encodeFunctionData({
        //     abi: ERC20Abi,
        //     functionName: "approve",
        //     args: [PancakeV3Manager, 2n ** 256n - 1n],
        //   }),
        // },
        {
          target: PancakeV3Manager,
          value: BigInt(BNB_AMOUNT.mul(DECIMAL_SCALE).toFixed(0)),
          callData: createPoolAddLiquidityData,
        },
        // {
        //   target: PancakeSmartRouterV3,
        //   value: BigInt(BNB_AMOUNT.mul(DECIMAL_SCALE).toFixed()),
        //   callData: swapToData,
        // },
      ],
    ]
  );

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
    privateKey: "0x" as `0x${string}`,
    rpc: "",
  };

  //   await signAuth(config);
  await createPool(config);
}

main()
  .then(() => {
    console.log("done");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
