-- Get all category attributes for categories belonging to the current user
SELECT
    ca.id,
    ca.category_id,
    c.title AS category_title,
    ca.title,
    ca.type,
    ca.list_values,
    ca.default_value,
    ca.unit,
    ca.is_required,
    ca.sort_order
FROM category_attributes ca
JOIN categories c ON c.id = ca.category_id
WHERE c.user_id = ?
ORDER BY c.sort_order, c.title, ca.sort_order, ca.title
