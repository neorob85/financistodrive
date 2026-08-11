-- Get transactions for a specific account with pagination
-- Ordered by transaction_date DESC for infinite scroll
-- Includes:
--   * top-level transactions where this account is source or destination
--   * split-child transfers whose destination is this account (surfaced individually)
-- balanceAmount, ordinary accounts: incoming transfers count as +amount_to;
--                outgoing transfers = 0; for splits, sums only non-transfer children
-- balanceAmount, credit cards: see the CASE below — charges count in full and
--                repayments are excluded, so period totals match the billing cycle
SELECT
  t.id,
  t.parent_id AS parentId,
  t.title,
  t.from_account_id AS fromAccountId,
  t.amount_from AS amountFrom,
  t.amount_to AS amountTo,
  t.transaction_date AS transactionDate,
  t.to_account_id AS toAccountId,
  t.is_transfer AS isTransfer,
  t.is_automotive AS isAutomotive,
  c.title AS categoryTitle,
  a.title AS accountTitle,
  CASE
    -- Credit card branch: the period total has to line up with the billing cycle
    -- shown on the account tile, which sums amount_from over the card's own rows.
    -- Charges therefore count at face value (a transfer out of the card is a real
    -- charge; a split parent already carries the full amount, transfer children
    -- included), while repayments arriving on the card are excluded — they settle
    -- an earlier cycle and would otherwise flip the total positive.
    WHEN ? = 1 THEN
      CASE WHEN t.to_account_id = ? AND t.from_account_id <> ? THEN 0 ELSE t.amount_from END
    WHEN t.is_transfer = 1 AND t.to_account_id = ? THEN t.amount_to
    WHEN t.is_transfer = 1 THEN 0
    WHEN EXISTS (SELECT 1 FROM transactions ch WHERE ch.parent_id = t.id) THEN
      COALESCE((SELECT SUM(ch.amount_from) FROM transactions ch WHERE ch.parent_id = t.id AND ch.is_transfer = 0), 0)
    ELSE t.amount_from
  END AS balanceAmount,
  -- Attachment flag
  (SELECT COUNT(*) > 0 FROM transaction_attachments ta WHERE ta.transaction_id = t.id) AS hasAttachment,
  -- Automotive info
  COALESCE(fl.odometer, ml.odometer) as odometer,
  COALESCE(v_fuel.brand, v_maint.brand) as vehicleBrand,
  COALESCE(v_fuel.model, v_maint.model) as vehicleModel,
  t.deductible_amount AS deductibleAmount,
  t.billing_date AS billingDate
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN accounts a ON t.from_account_id = a.id
-- Join for Fuel Logs
LEFT JOIN fuels_logs fl ON t.id = fl.transaction_id
LEFT JOIN vehicles v_fuel ON fl.vehicle_id = v_fuel.id
-- Join for Maintenance Logs (use subquery to ensure 1:1)
LEFT JOIN (
  SELECT transaction_id, MAX(vehicle_id) as vehicle_id, MAX(odometer) as odometer
  FROM maintenances_logs
  GROUP BY transaction_id
) ml ON t.id = ml.transaction_id
LEFT JOIN vehicles v_maint ON ml.vehicle_id = v_maint.id

WHERE t.user_id = ?
  AND (
    (t.parent_id IS NULL AND (t.from_account_id = ? OR t.to_account_id = ?))
    OR (t.parent_id IS NOT NULL AND t.is_transfer = 1 AND t.to_account_id = ?)
  )
ORDER BY t.transaction_date DESC
LIMIT ? OFFSET ?
