export function assertTransactionPending(txn) {
  if (!txn) throw new Error("Transaction not found");
  if (txn.status !== "pending") {
    throw new Error("Transaction not pending");
  }
}
