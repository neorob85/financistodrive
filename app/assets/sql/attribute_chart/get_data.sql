SELECT
    tav.category_attribute_id AS attribute_id,
    ca.title                  AS attribute_title,
    ca.unit,
    t.transaction_date,
    t.id                      AS transaction_id,
    t.title                   AS transaction_title,
    CAST(tav.value AS DECIMAL(15,4)) AS value
FROM transaction_attribute_values tav
JOIN category_attributes ca ON ca.id = tav.category_attribute_id
JOIN transactions t          ON t.id  = tav.transaction_id
WHERE ca.type    = 'NUMBER'
  AND t.user_id  = ?
ORDER BY tav.category_attribute_id, t.transaction_date ASC
