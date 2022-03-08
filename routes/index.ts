import express from "express";
import { SigningStargateClient, coins } from '@cosmjs/stargate';

import log from "ololog";

const retry = require('retry');
const delay = require('delay');

const router = express.Router();

import { latestTransactionSince } from "../database";
import * as faucet from "../faucet";
import path from "path";
import promClient from "prom-client";

const counterPreflight = new promClient.Counter({
  name: "faucet_preflight_count",
  help: "faucet_preflight_count is the number of times the faucet served the preflight page",
});

const counterChainId = new promClient.Counter({
  name: "faucet_chainId_count",
  help: "faucet_chainId_count is the number of times client.getChainId() is being called",
});


const INLINE_UI = process.env.INLINE_UI;
const NETWORK_RPC_NODE = process.env.NETWORK_RPC_NODE;

/* GET home page. */
router.get("/", async (req: any, res: any, next: any) => {
  let unlockDate;

  const wallet = await faucet.getWallet();
  const [{ address }] = await wallet.getAccounts();

  const client = await SigningStargateClient.connectWithSigner(
    NETWORK_RPC_NODE as any,
    wallet
  );

  const chainId = await client.getChainId();
  counterChainId.inc();

  const distributionAmount = faucet.getDistributionAmount();
  const distributionDenom = faucet.getDenom();

  if (req.user && req.user.id) {
    let coolDownDate = new Date(
      (new Date() as any) - (faucet.getWaitPeriod() as any)
    );
    let transaction: any = await latestTransactionSince(req.user, coolDownDate);
    if (transaction)
      unlockDate = new Date(
        transaction.createdAt.getTime() + faucet.getWaitPeriod()
      );
  }

  counterPreflight.inc();

  if (!INLINE_UI) {
    res.status(200).send(
      JSON.stringify({
        faucetAddress: address,
        unlockDate,
        chainId,
        distributionAmount,
        distributionDenom,
      })
    );
  } else {
    res.sendFile(path.join(__dirname, "../static", "index.html"));
  }
});

export { router };
