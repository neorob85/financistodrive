-- Get all currencies
SELECT id, title, abbreviation, symbol, is_default
FROM currencies
ORDER BY is_default DESC, sort_order, title
