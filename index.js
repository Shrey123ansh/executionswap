const express = require("express");
const { ethers } = require("ethers");
const {
  Token,
  TradeType,
  Percent,
  CurrencyAmount,
} = require("@uniswap/sdk-core");
const { AlphaRouter } = require("@uniswap/smart-order-router");
const { Pool } = require("@uniswap/v3-sdk");
require("dotenv").config();

const app = express();
app.use(express.json());

// Alchemy RPC Configuration
// const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
// const ALCHEMY_NETWORK = "mainnet";
// const ALCHEMY_RPC_URL = `"https://eth-mainnet.g.alchemy.com/v2/P7ByX6hdKMgxebJYTasLgtTlzssrH20b";`;
// console.log(ALCHEMY_RPC_URL);
console.log("provider");

// Initialize provider
const provider = new ethers.providers.AlchemyProvider(
  "mainnet",
  "P7ByX6hdKMgxebJYTasLgtTlzssrH20b"
);

// console.log(provider);

// Common token addresses on Ethereum mainnet
const TOKENS = {
  // Native Tokens
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  // Stablecoins
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  // DeFi Tokens
  UNI: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
  LINK: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  AAVE: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
  // Meme Tokens
  SHIB: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
  // Gaming Tokens
  AXS: "0xBB0E17EF65F82Ab018d8EDd776e8DD940327B28b",
};

// Token decimals mapping
const TOKEN_DECIMALS = {
  WETH: 18,
  USDC: 6,
  USDT: 6,
  DAI: 18,
  UNI: 18,
  LINK: 18,
  AAVE: 18,
  SHIB: 18,
  AXS: 18,
};

// Initialize router with Alchemy provider
const router = new AlphaRouter({
  chainId: 1, // Mainnet
  provider: provider,
});

app.post("/swap", async (req, res) => {
  try {
    const {
      tokenInSymbol,
      tokenOutSymbol,
      amount,
      slippagePercentage = 0.5,
      recipientAddress,
    } = req.body;

    // Validate input
    if (!tokenInSymbol || !tokenOutSymbol || !amount || !recipientAddress) {
      return res.status(400).json({
        error: "Missing required parameters",
        required: [
          "tokenInSymbol",
          "tokenOutSymbol",
          "amount",
          "recipientAddress",
        ],
      });
    }

    // Get token addresses
    const tokenInAddress = TOKENS[tokenInSymbol];
    const tokenOutAddress = TOKENS[tokenOutSymbol];

    if (!tokenInAddress || !tokenOutAddress) {
      return res.status(400).json({
        error: "Invalid token symbol",
        supportedTokens: Object.keys(TOKENS),
      });
    }

    // Create token instances
    const tokenIn = new Token(
      1,
      tokenInAddress,
      TOKEN_DECIMALS[tokenInSymbol],
      tokenInSymbol
    );

    const tokenOut = new Token(
      1,
      tokenOutAddress,
      TOKEN_DECIMALS[tokenOutSymbol],
      tokenOutSymbol
    );

    // Convert amount to proper decimals
    const amountIn = ethers.utils.parseUnits(
      amount.toString(),
      TOKEN_DECIMALS[tokenInSymbol]
    );

    // Create currency amount instance
    const currencyAmount = CurrencyAmount.fromRawAmount(
      tokenIn,
      amountIn.toString()
    );

    // Get route
    const route = await router.route(
      currencyAmount,
      tokenOut,
      TradeType.EXACT_INPUT,
      {
        recipient: recipientAddress,
        slippageTolerance: new Percent(slippagePercentage, 100),
        deadline: Math.floor(Date.now() / 1000 + 1800), // 30 minutes
      }
    );

    console.log(route);

    if (!route || !route.methodParameters) {
      return res.status(400).json({
        error: "No route found",
        details:
          "Unable to find a valid trading route for the specified tokens",
      });
    }

    // Return swap details
    res.json({
      swap: {
        tokenIn: tokenInSymbol,
        tokenOut: tokenOutSymbol,
        amountIn: amount,
        expectedOutput: ethers.utils.formatUnits(
          route.quote.toString(),
          TOKEN_DECIMALS[tokenOutSymbol]
        ),
      },
      transaction: {
        to: route.methodParameters.to,
        data: route.methodParameters.calldata,
        value: route.methodParameters.value,
        gasLimit: route.estimatedGasUsed.toString(),
        gasPrice: await provider.getGasPrice(),
      },
      route: {
        path: route.route[0].tokenPath.map((token) => token.symbol),
        pools: route.route[0].poolAddresses,
      },
    });
  } catch (error) {
    console.error("Swap error:", error);
    res.status(500).json({
      error: "Failed to process swap",
      message: error.message,
    });
  }
});

// Get supported tokens
app.get("/tokens", (req, res) => {
  const tokenList = Object.entries(TOKENS).map(([symbol, address]) => ({
    symbol,
    address,
    decimals: TOKEN_DECIMALS[symbol],
  }));

  console.log(tokenList);

  res.json({
    tokens: tokenList,
    count: tokenList.length,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  //   console.log(`Using Alchemy ${ALCHEMY_NETWORK} network`);
});
