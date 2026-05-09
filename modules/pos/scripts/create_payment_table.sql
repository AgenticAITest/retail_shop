-- POS Module - Split Payment Table (Sprint 12)

CREATE TABLE IF NOT EXISTS pos_transaction_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_transaction_id UUID NOT NULL REFERENCES pos_transactions(id) ON DELETE CASCADE,
  payment_method VARCHAR(30) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_ref VARCHAR(100),
  amount_tendered DECIMAL(15,2),
  change_amount DECIMAL(15,2),
  sequence INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_payment_txn_id ON pos_transaction_payments(pos_transaction_id);
