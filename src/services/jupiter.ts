import {
  Connection,
  Keypair,
  VersionedTransaction,
  Commitment,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { AppConfig } from "../config";
import { TradeResult } from "../types";

interface JupiterQuoteResponse {
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  routePlan: unknown[];
}

interface JupiterSwapResponse {
  swapTransaction: string;
}

export class JupiterService {
  constructor(
    private readonly connection: Connection,
    private readonly config: AppConfig
  ) {}

  public solToLamports(sol: number): bigint {
    return BigInt(Math.floor(sol * LAMPORTS_PER_SOL));
  }

  public async getQuote(inputMint: string, outputMint: string, amountRaw: bigint): Promise<JupiterQuoteResponse> {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amountRaw.toString(),
      slippageBps: String(this.config.slippageBps),
      onlyDirectRoutes: "false"
    });

    const response = await fetch(`${this.config.jupiterQuoteUrl}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Jupiter quote failed: ${response.status} ${await response.text()}`);
    }

    return (await response.json()) as JupiterQuoteResponse;
  }

  public async executeSwap(
    owner: Keypair,
    inputMint: string,
    outputMint: string,
    amountRaw: bigint,
    commitment: Commitment = "confirmed"
  ): Promise<TradeResult> {
    const quote = await this.getQuote(inputMint, outputMint, amountRaw);

    const swapResponse = await fetch(this.config.jupiterSwapUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: owner.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: {
            maxLamports: this.config.priorityFeeMicrolamports,
            global: false,
            priorityLevel: "veryHigh"
          }
        }
      })
    });

    if (!swapResponse.ok) {
      throw new Error(`Jupiter swap tx build failed: ${swapResponse.status} ${await swapResponse.text()}`);
    }

    const { swapTransaction } = (await swapResponse.json()) as JupiterSwapResponse;

    const txBuffer = Buffer.from(swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(txBuffer);
    transaction.sign([owner]);

    const signature = await this.connection.sendTransaction(transaction, {
      maxRetries: 2,
      skipPreflight: true,
      preflightCommitment: commitment
    });

    await this.connection.confirmTransaction(signature, commitment);

    return {
      signature,
      inputMint,
      outputMint,
      inAmountRaw: quote.inAmount,
      outAmountRaw: quote.outAmount
    };
  }
}