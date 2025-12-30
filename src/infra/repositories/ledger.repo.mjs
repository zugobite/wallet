export async function createLedgerEntry(tx, data) {
  return tx.ledgerEntry.create({ data });
}
