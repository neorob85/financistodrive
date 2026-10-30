-- Get all vehicles for a user
SELECT v.id, v.user_id, v.brand, v.model, v.license_plate, v.year,
       v.fuel_id, f.title as fuel_name, v.initial_mileage, v.current_mileage,
       v.purchase_date, v.purchase_price, v.is_active, v.notes,
       COALESCE(alerts_upcoming.cnt, 0) AS alerts_upcoming,
       COALESCE(alerts_overdue.cnt, 0) AS alerts_overdue
FROM vehicles v
LEFT JOIN fuels f ON v.fuel_id = f.id
LEFT JOIN (
    SELECT ma.vehicle_id, COUNT(*) AS cnt
    FROM maintenance_alerts ma
    JOIN vehicles v2 ON v2.id = ma.vehicle_id
    WHERE (
        (ma.next_alert_date IS NOT NULL AND ma.next_alert_date <= NOW())
        OR (ma.next_alert_odometer IS NOT NULL AND v2.current_mileage IS NOT NULL AND ma.next_alert_odometer <= v2.current_mileage)
    ) AND (
        (ma.next_maintenance_date IS NULL OR ma.next_maintenance_date > NOW())
        AND (ma.next_maintenance_odometer IS NULL OR v2.current_mileage IS NULL OR ma.next_maintenance_odometer > v2.current_mileage)
    )
    GROUP BY ma.vehicle_id
) alerts_upcoming ON alerts_upcoming.vehicle_id = v.id
LEFT JOIN (
    SELECT ma.vehicle_id, COUNT(*) AS cnt
    FROM maintenance_alerts ma
    JOIN vehicles v2 ON v2.id = ma.vehicle_id
    WHERE (ma.next_maintenance_date IS NOT NULL AND ma.next_maintenance_date <= NOW())
       OR (ma.next_maintenance_odometer IS NOT NULL AND v2.current_mileage IS NOT NULL AND ma.next_maintenance_odometer <= v2.current_mileage)
    GROUP BY ma.vehicle_id
) alerts_overdue ON alerts_overdue.vehicle_id = v.id
WHERE v.user_id = ?
ORDER BY v.brand, v.model
