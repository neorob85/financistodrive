-- Get transaction details with all related data
SELECT 
  t.id, 
  t.title, 
  t.amount_from AS amount_from, 
  t.amount_to AS amount_to, 
  t.transaction_date AS transaction_date,
  t.from_account_id AS from_account_id, 
  t.to_account_id AS to_account_id, 
  t.category_id AS category_id, 
  t.parent_id AS parent_id,
  t.project_id AS project_id, 
  t.payee_id AS payee_id, 
  t.currency_id AS currency_id, 
  t.notes, 
  t.is_transfer AS is_transfer, 
  t.is_automotive AS is_automotive,
  t.deductible_amount AS deductible_amount,
  t.billing_date AS billing_date,
  fa.title AS from_account_title,
  ta.title AS to_account_title,
  c.title AS category_title,
  p.title AS project_title,
  py.title AS payee_title,
  cur.abbreviation AS currency_code, 
  cur.symbol AS currency_symbol
FROM transactions t
LEFT JOIN accounts fa ON t.from_account_id = fa.id
LEFT JOIN accounts ta ON t.to_account_id = ta.id
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN projects p ON t.project_id = p.id
LEFT JOIN payees py ON t.payee_id = py.id
LEFT JOIN currencies cur ON t.currency_id = cur.id
WHERE t.id = ? AND t.user_id = ?
