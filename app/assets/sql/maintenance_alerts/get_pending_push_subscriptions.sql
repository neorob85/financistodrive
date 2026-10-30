SELECT s.endpoint, s.keys_p256dh, s.keys_auth, s.user_id
FROM push_subscriptions s
JOIN users u ON s.user_id = u.id
WHERE
  (s.last_notification_sent_at IS NULL OR s.last_notification_sent_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR))
  AND EXISTS (
    SELECT 1 FROM maintenance_alerts ma
    JOIN vehicles v ON ma.vehicle_id = v.id
    WHERE v.user_id = u.id
    AND v.is_active = 1
    AND (
      (ma.next_alert_date IS NOT NULL AND ma.next_alert_date <= CURDATE())
      OR
      (ma.next_alert_odometer IS NOT NULL AND ma.next_alert_odometer <= v.current_mileage)
    )
  );
