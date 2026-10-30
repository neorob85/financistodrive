-- Get all accounts for user with currency and type info
SELECT
    a.id,
    a.title,
    a.initial_amount,
    a.actual_amount,
    a.issuer,
    a.account_number,
    a.is_active,
    a.sort_order,
    a.is_included_into_totals,
    a.card_limit,
    a.card_closing_day,
    a.card_payment_day,
    a.is_credit_card,
    a.account_credit_card,
    a.notes,
    c.symbol AS currency_symbol,
    c.abbreviation AS currency_abbr,
    at.title AS account_type,
    cc.title AS credit_card_account_title
FROM accounts a
JOIN currencies c ON a.currency_id = c.id
JOIN account_types at ON a.account_type_id = at.id
LEFT JOIN accounts cc ON a.account_credit_card = cc.id
WHERE a.user_id = ?
ORDER BY a.sort_order, a.title
