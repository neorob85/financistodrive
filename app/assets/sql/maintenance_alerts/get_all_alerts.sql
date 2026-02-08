-- Get all maintenance alerts for a user with vehicle and maintenance type info
SELECT ma.id, ma.vehicle_id, ma.maintenance_type_id,
       ma.last_maintenance_date, ma.last_maintenance_odometer,
       ma.next_maintenance_date, ma.next_maintenance_odometer,
       ma.next_alert_date, ma.next_alert_odometer,
       ma.is_alert_sent,
       mt.title as maintenance_type_title,
       mt.default_interval_km, mt.default_interval_months,
       mt.default_days_before_alert, mt.default_km_before_alert,
       v.brand as vehicle_brand, v.model as vehicle_model,
       v.license_plate, v.current_mileage
FROM maintenance_alerts ma
JOIN maintenance_types mt ON ma.maintenance_type_id = mt.id
JOIN vehicles v ON ma.vehicle_id = v.id
WHERE mt.user_id = ? AND v.is_active = 1
ORDER BY ma.next_maintenance_date ASC, ma.next_maintenance_odometer ASC
