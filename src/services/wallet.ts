import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

export function loadKeypairFromSecret(secret: string): Keypair {
  const trimmed = secret.trim();

  if (trimmed.startsWith("[")) {
    const secretArray = JSON.parse(trimmed) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(secretArray));
  }

  return Keypair.fromSecretKey(bs58.decode(trimmed));
}