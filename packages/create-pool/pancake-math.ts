import { Big } from "big.js";
import { hexToBigInt } from "viem";

export class PancakeMath {
    static TickSpacing = {
        "10000": 200,
        "2500": 50,
    }

    static Q96 = new Big(2).pow(96);

    private token0: `0x${string}`;
    private token1: `0x${string}`;
    private feeRate: number;

    public tokenA: `0x${string}`;
    public tokenB: `0x${string}`;

    constructor(tokenA: `0x${string}`, tokenB: `0x${string}`, feeRate: number) {
        this.tokenA = tokenA;
        this.tokenB = tokenB;
        this.feeRate = feeRate;

        if (hexToBigInt(tokenA) < hexToBigInt(tokenB)) {
            this.token0 = tokenA;
            this.token1 = tokenB;
        } else {
            this.token0 = tokenB;
            this.token1 = tokenA;
        }
    }

    getSqrtPriceX96(priceA_USD: Big, priceB_USD: Big): Big {
        if (this.token0 === this.tokenA) {
            return priceA_USD.div(priceB_USD).sqrt().mul(PancakeMath.Q96).round(0, Big.roundDown);
        } else {
            return priceB_USD.div(priceA_USD).sqrt().mul(PancakeMath.Q96).round(0, Big.roundDown);
        }
    }

    getPriceFromTick(tick: number): number {
        return Math.pow(1.0001, tick);
    }

    getSqrtPriceFromTick(tick: number): Big {
        return new Big(this.getPriceFromTick(tick)).sqrt().mul(PancakeMath.Q96);
    }

    getTickFromPrice(priceA_USD: Big, priceB_USD: Big): number {
        const price = this.token0 === this.tokenA
            ? priceA_USD.div(priceB_USD)
            : priceB_USD.div(priceA_USD);

        const tick = Math.floor(Math.log(price.toNumber()) / Math.log(1.0001));
        return Math.floor(tick / PancakeMath.TickSpacing[this.feeRate.toString()]) * PancakeMath.TickSpacing[this.feeRate.toString()];
    }

    calculateLiquidityA(amountA: Big, sqrtP: Big, sqrtPb: Big): Big {
        const denominator = sqrtPb.sub(sqrtP);
        if (denominator.lte(0)) {
            throw new Error("Invalid price range: sqrtPb must be greater than sqrtP");
        }
        return amountA.mul(sqrtP).mul(sqrtPb).div(PancakeMath.Q96).div(denominator);
    }

    calculateLiquidityB(amountB: Big, sqrtP: Big, sqrtPa: Big): Big {
        const denominator = sqrtP.sub(sqrtPa);
        if (denominator.lte(0)) {
            throw new Error("Invalid price range: sqrtP must be greater than sqrtPa");
        }
        return amountB.mul(PancakeMath.Q96).div(denominator);
    }

    calculateSwapAmount(L: Big, sqrtPstart: Big, sqrtPend: Big): Big {
        return L.mul(PancakeMath.Q96).mul(sqrtPstart.sub(sqrtPend)).div(sqrtPstart).div(sqrtPend);
    }

    calculateNeeded(targetPriceUSD: Big, currentPriceUSD: Big, upperPriceUSD: Big, priceAUSD: Big, allLiquidity: Big): Big {
        const sqrtP_current = this.getSqrtPriceX96(priceAUSD, currentPriceUSD);
        const sqrtP_target = this.getSqrtPriceX96(priceAUSD, targetPriceUSD);
        const sqrtP_upper = this.getSqrtPriceX96(priceAUSD, upperPriceUSD);

        const currentETH = allLiquidity.mul(sqrtP_upper.sub(sqrtP_current)).div(PancakeMath.Q96);
        const targetETH = allLiquidity.mul(sqrtP_upper.sub(sqrtP_target)).div(PancakeMath.Q96);

        const ethNeeded = currentETH.sub(targetETH);

        return ethNeeded
    }

    calculateLiquidityRequiredByA(
        amountA: Big,
        priceBLow: Big,
        priceBHigh: Big,
        priceBCurrent: Big,
        priceA: Big
    ): { amountBDesired: Big, L: Big } {
        const sqrtPLow = this.getSqrtPriceX96(priceA, priceBLow);
        const sqrtPHigh = this.getSqrtPriceX96(priceA, priceBHigh);
        const sqrtPCurrent = this.getSqrtPriceX96(priceA, priceBCurrent);

        let sqrtPa: Big, sqrtPb: Big;

        if (sqrtPLow.lt(sqrtPHigh)) {
            sqrtPa = sqrtPLow;
            sqrtPb = sqrtPHigh;
        } else {
            sqrtPa = sqrtPHigh;
            sqrtPb = sqrtPLow;
        }

        if (sqrtPCurrent.lt(sqrtPa)) {
            throw new Error("Current price below range, only one token needed");
        } else if (sqrtPCurrent.gt(sqrtPb)) {
            throw new Error("Current price above range, only one token needed");
        }

        if (this.token0 === this.tokenA) {
            const L = this.calculateLiquidityA(amountA, sqrtPCurrent, sqrtPb);
            const amountBDesired = L.mul(sqrtPCurrent.sub(sqrtPa)).div(PancakeMath.Q96);
            return { amountBDesired, L };
        } else {
            const L = this.calculateLiquidityB(amountA, sqrtPCurrent, sqrtPa);
            const amountBDesired = L.mul(sqrtPb.sub(sqrtPCurrent))
                .mul(PancakeMath.Q96)
                .div(sqrtPCurrent.mul(sqrtPb));
            return { amountBDesired, L };
        }
    }

    calculateLiquidityRequiredByB(
        amountB: Big,
        priceALow: Big,
        priceAHigh: Big,
        priceACurrent: Big,
        priceB: Big
    ): Big {
        const sqrtPLow = this.getSqrtPriceX96(priceALow, priceB);
        const sqrtPHigh = this.getSqrtPriceX96(priceAHigh, priceB);
        const sqrtPCurrent = this.getSqrtPriceX96(priceACurrent, priceB);

        let sqrtPa: Big, sqrtPb: Big;

        if (sqrtPLow.lt(sqrtPHigh)) {
            sqrtPa = sqrtPLow;
            sqrtPb = sqrtPHigh;
        } else {
            sqrtPa = sqrtPHigh;
            sqrtPb = sqrtPLow;
        }

        if (sqrtPCurrent.lt(sqrtPa)) {
            throw new Error("Current price below range, only one token needed");
        } else if (sqrtPCurrent.gt(sqrtPb)) {
            throw new Error("Current price above range, only one token needed");
        }

        if (this.token0 === this.tokenB) {
            const L = this.calculateLiquidityA(amountB, sqrtPCurrent, sqrtPb);
            const amountADesired = L.mul(sqrtPCurrent.sub(sqrtPa)).div(PancakeMath.Q96);
            return amountADesired;
        } else {
            const L = this.calculateLiquidityB(amountB, sqrtPCurrent, sqrtPa);
            const amountADesired = L.mul(sqrtPb.sub(sqrtPCurrent))
                .mul(PancakeMath.Q96)
                .div(sqrtPCurrent.mul(sqrtPb));
            return amountADesired;
        }
    }
}