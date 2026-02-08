-- Get all projects for user with spent amount from transactions
SELECT 
    p.id, 
    p.title, 
    p.is_active, 
    p.sort_order, 
    p.budget,
    COALESCE(SUM(ABS(t.amount_from)), 0) AS spent
FROM projects p
LEFT JOIN transactions t ON t.project_id = p.id
WHERE p.user_id = ?
GROUP BY p.id, p.title, p.is_active, p.sort_order, p.budget
ORDER BY p.sort_order, p.title
