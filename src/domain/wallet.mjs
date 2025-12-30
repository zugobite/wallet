export function assertWalletActive(wallet) {
  if (!wallet) throw new Error("Wallet not found");
  if (wallet.account?.status === "frozen") throw new Error("Wallet frozen");
}

export function canDebit(wallet, amount) {
  if (amount <= 0) throw new Error("Invalid amount");
  if (wallet.balance < amount) throw new Error("Insufficient funds");
}
