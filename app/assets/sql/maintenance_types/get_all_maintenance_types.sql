-- Get all maintenance types for a user with vehicle info
SELECT mt.id, mt.title, mt.user_id, mt.vehicle_id, 
       v.brand as vehicle_brand, v.model as vehicle_model,
       mt.default_interval_km, mt.default_interval_months, mt.default_days_before_alert, mt.default_km_before_alert
FROM maintenance_types mt
LEFT JOIN vehicles v ON mt.vehicle_id = v.id
WHERE mt.user_id = ?
ORDER BY v.brand, v.model, mt.title
