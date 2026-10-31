import { AsyncLocalStorage } from "node:async_hooks";

import mongoose from "mongoose";

import { AppError } from "../core/app-error.js";

// Every Mongoose call made inside connection.transaction() joins the session,
// so the existing services take part without passing a session around.
mongoose.set("transactionAsyncLocalStorage", true);

type TransactionContext = { afterCommit: Array<() => void> };

const context = new AsyncLocalStorage<TransactionContext>();
let topologySupportsTransactions: boolean | null = null;

export const isInTransaction = () => Boolean(context.getStore());

/** MongoDB retries these itself, so a catch block must rethrow them untouched. */
export const isTransientTransactionError = (error: unknown) =>
  (error as { hasErrorLabel?: (label: string) => boolean } | null)?.hasErrorLabel?.("TransientTransactionError") === true;

/** Runs now outside a transaction; inside one, only once it has committed. */
export const afterCommit = (task: () => void) => {
  const store = context.getStore();
  if (store) store.afterCommit.push(task);
  else task();
};

const supportsTransactions = async () => {
  if (topologySupportsTransactions !== null) return topologySupportsTransactions;
  const db = mongoose.connection.db;
  if (!db) return false;
  const hello = await db.admin().command({ hello: 1 });
  topologySupportsTransactions = Boolean(hello.setName) || hello.msg === "isdbgrid";
  return topologySupportsTransactions;
};

/**
 * One atomic unit across collections. `work` can run more than once: MongoDB
 * retries transient conflicts, so anything outward-facing goes through
 * afterCommit, which also drops what an abandoned attempt queued.
 *
 * Unit tests have no connection and run `work` directly. A standalone server
 * has no transactions: production refuses, development warns.
 */
export const runInTransaction = async <T>(work: () => Promise<T>): Promise<T> => {
  if (isInTransaction()) return work();

  const connected = mongoose.connection.readyState === 1;
  const transactional = connected && (await supportsTransactions());
  if (connected && !transactional) {
    if (process.env.NODE_ENV === "production") {
      throw new AppError(503, "TRANSACTIONS_UNAVAILABLE", "MongoDB must run as a replica set in production.");
    }
    console.warn("[db] Standalone MongoDB: multi-document writes are not atomic on this server.");
  }

  const store: TransactionContext = { afterCommit: [] };
  const result = await context.run(store, () =>
    transactional
      ? mongoose.connection.transaction(async () => {
          store.afterCommit = [];
          return work();
        })
      : work(),
  );

  for (const task of store.afterCommit) {
    try {
      task();
    } catch (error) {
      // The data is committed; a failed side effect must not report a failed write.
      console.error("[db] afterCommit task failed:", error);
    }
  }
  return result;
};
