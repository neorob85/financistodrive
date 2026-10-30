-- Get maintenance status per (maintenance_type_id, vehicle_id) pair
-- For vehicle-specific types: one row per type
-- For general types (vehicle_id IS NULL): one row per active vehicle
SELECT
    combined.maintenance_type_id,
    combined.vehicle_id,
    v.brand AS vehicle_brand,
    v.model AS vehicle_model,
    (
        SELECT ml.date
        FROM maintenances_logs ml
        WHERE ml.maintenance_type_id = combined.maintenance_type_id
          AND ml.vehicle_id = combined.vehicle_id
        ORDER BY ml.date DESC
        LIMIT 1
    ) AS last_date,
    (
        SELECT ml.odometer
        FROM maintenances_logs ml
        WHERE ml.maintenance_type_id = combined.maintenance_type_id
          AND ml.vehicle_id = combined.vehicle_id
        ORDER BY ml.date DESC
        LIMIT 1
    ) AS last_odometer,
    ma.next_maintenance_date,
    ma.next_maintenance_odometer
FROM (
    -- Vehicle-specific types: use the type's own vehicle_id
    SELECT mt.id AS maintenance_type_id, mt.vehicle_id
    FROM maintenance_types mt
    WHERE mt.user_id = ? AND mt.vehicle_id IS NOT NULL

    UNION ALL

    -- General types: expand to all active vehicles for user
    SELECT mt.id AS maintenance_type_id, veh.id AS vehicle_id
    FROM maintenance_types mt
    CROSS JOIN vehicles veh
    WHERE mt.user_id = ? AND mt.vehicle_id IS NULL
      AND veh.user_id = ? AND veh.is_active = 1
) AS combined
JOIN vehicles v ON v.id = combined.vehicle_id
LEFT JOIN maintenance_alerts ma
    ON ma.maintenance_type_id = combined.maintenance_type_id
   AND ma.vehicle_id = combined.vehicle_id
HAVING last_date IS NOT NULL
    OR last_odometer IS NOT NULL
    OR ma.next_maintenance_date IS NOT NULL
    OR ma.next_maintenance_odometer IS NOT NULL
ORDER BY combined.maintenance_type_id, v.brand, v.model
