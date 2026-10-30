-- Insert new account
INSERT INTO accounts (
    title, currency_id, user_id, initial_amount, actual_amount,
    account_type_id, issuer, account_number, is_active,
    is_included_into_totals, card_limit, notes,
    is_credit_card, account_credit_card, card_closing_day, card_payment_day
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
