-- Get transactions for user with pagination
-- Ordered by transaction_date DESC for infinite scroll
-- balanceAmount: excludes transfers; for splits, sums only non-transfer children
SELECT
  t.id,
  t.title,
  t.amount_from AS amountFrom,
  t.amount_to AS amountTo,
  t.transaction_date AS transactionDate,
  t.to_account_id AS toAccountId,
  t.is_transfer AS isTransfer,
  t.is_automotive AS isAutomotive,
  t.category_id AS categoryId,
  t.from_account_id AS fromAccountId,
  t.project_id AS projectId,
  c.title AS categoryTitle,
  a.title AS accountTitle,
  p.title AS projectTitle,
  CASE
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
  COALESCE(fl.vehicle_id, ml.vehicle_id) as vehicleId,
  t.deductible_amount AS deductibleAmount
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN accounts a ON t.from_account_id = a.id
LEFT JOIN projects p ON t.project_id = p.id
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

WHERE t.user_id = ? AND t.parent_id IS NULL
ORDER BY t.transaction_date DESC
LIMIT ? OFFSET ?
