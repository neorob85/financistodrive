-- ---------------------------------------------------- --
-- DATABASE: money_db
-- ---------------------------------------------------- --
CREATE DATABASE IF NOT EXISTS `simplemoney` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `simplemoney`;

-- SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------- --
-- USERS TABLE (no dependends)
-- ---------------------------------------------------- --

CREATE TABLE `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'User ID',
    `name` VARCHAR(255) DEFAULT NULL COMMENT 'First Name',
    `surname` VARCHAR(255) DEFAULT NULL COMMENT 'Last Name',
    `username` VARCHAR(255) UNIQUE NOT NULL COMMENT 'Username',
    `email` VARCHAR(255) UNIQUE DEFAULT NULL COMMENT 'Email Address',
    `password` VARCHAR(255) NOT NULL COMMENT 'Password Hash',
    `is_active` BOOLEAN NOT NULL DEFAULT 1 COMMENT 'Is The Users Active',
    `is_admin` BOOLEAN NOT NULL DEFAULT 0 COMMENT 'Is The User An Admin',
    `last_login` DATETIME DEFAULT NULL COMMENT 'Last Login DateTime'
) COMMENT 'Users Table. No depends from other tables.';


-- Insert default admin user with password 'password' (bcrypt hash)
INSERT INTO `users` (`id`, `username`, `password`, `is_active`, `is_admin`)
VALUES (-1, 'admin', '$2b$10$uOjrJhZGU1Tt3hQxdu3bS.eZKLHbn1ReNqgdAN.G5y4QXAJGwb3le', 1, 1);

-- ---------------------------------------------------- --
-- CONFIGURATIONS TABLE (depends from: users)
-- ---------------------------------------------------- --

CREATE TABLE `configurations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Configuration ID',
    `config_key` VARCHAR(255) NOT NULL COMMENT 'Configuration Key',
    `config_value` TEXT DEFAULT NULL COMMENT 'Configuration Value',
    `user_id` INT DEFAULT NULL NULL COMMENT 'User id configuration. NULL is for all users',
    CONSTRAINT `fk_configurations_users` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) COMMENT 'Configurations Table. No depends from other tables.';

-- Insert default configurations
INSERT INTO `configurations` (`config_key`, `config_value`, `user_id`)
VALUES 
    ('app_name', 'Money Manager', NULL),
    ('version', '1.0.0', NULL),
    ('items_per_page', '20', NULL),
    ('language', 'en', -1),
    ('theme', 'light', -1);

-- ---------------------------------------------------- --
-- API TOKENS TABLE (no dependends)
-- ---------------------------------------------------- --

CREATE TABLE `api_tokens` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'id Api Token',
    `user_id` INT NOT NULL COMMENT 'Foreign Key to users',
    `token_hash` VARCHAR(255) NOT NULL COMMENT 'token hash',
    `name` VARCHAR(100) DEFAULT NULL COMMENT 'es. "iPhone", "App Android"',
    `last_used_at` DATETIME DEFAULT NULL,
    `expires_at` DATETIME NOT NULL,
    `created_at` DATETIME DEFAULT NOW(),
    `is_revoked` BOOLEAN DEFAULT 0,
    CONSTRAINT `fk_api_tokens_users` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- ---------------------------------------------------- --
-- CURRENCIES TABLE (no dependends)
-- ---------------------------------------------------- --

CREATE TABLE `currencies` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Currency ID',
    `title` VARCHAR(50) NOT NULL COMMENT 'Currency Name Like Euro or US Dollar',
    `abbreviation` VARCHAR(255) UNIQUE NOT NULL COMMENT 'Currency Abbrevation like EUR or USD',
    `symbol` VARCHAR(10) NOT NULL COMMENT 'Currency Symbol like €, $, etc.',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT 'Sort Order',
    `is_default` BOOLEAN NOT NULL DEFAULT 0 COMMENT 'Is Default Currency'
) COMMENT 'Currencies Table. No depends from other tables.';

-- Insert default currencies
INSERT INTO `currencies` (`title`, `abbreviation`, `symbol`, `sort_order`, `is_default`)
VALUES 
    ('Euro', 'EUR', '€', 1, 1),
    ('US Dollar', 'USD', '$', 2, 0),
    ('British Pound', 'GBP', '£', 3, 0),
    ('Japanese Yen', 'JPY', '¥', 4, 0),
    ('Swiss Franc', 'CHF', 'CHF', 5, 0),
    ('Canadian Dollar', 'CAD', 'C$', 6, 0),
    ('Australian Dollar', 'AUD', 'A$', 7, 0),
    ('Indian Rupee', 'INR', '₹', 8, 0),
    ('Swedish Krona', 'SEK', 'kr', 10, 0),
    ('New Zealand Dollar', 'NZD', 'NZ$', 11, 0),
    ('Mexican Peso', 'MXN', '$', 12, 0),
    ('Chinese Yuan', 'CNY', '¥', 13, 0);

-- ---------------------------------------------------- --
-- CATEGORIES TABLE (depends from: users)
-- ---------------------------------------------------- --

CREATE TABLE `categories` (
    `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'Category ID',
    `parent_id` INT NULL COMMENT 'Foreign Key To Parent Category ID',
    `title` VARCHAR(255) NOT NULL COMMENT 'Category Description',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT 'Sort Order',
    `is_active` BOOLEAN NOT NULL DEFAULT 1 COMMENT 'Is Category Active',
    `user_id` INT NULL COMMENT 'Foreign Key to User ID',
    `is_automotive` BOOLEAN NOT NULL DEFAULT 0 COMMENT 'Is Automotive Category',
    CONSTRAINT `fk_categories_parent` FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT `fk_categories_users` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) COMMENT 'Categories And Sub-Categories Table. Depends from users table.';

-- Insert default categories
INSERT INTO `categories` (`id`, `parent_id`, `title`, `sort_order`, `is_active`, `user_id`, `is_automotive`)
VALUES (-1, NULL, '🔀 <SPLIT>', -1, 1, NULL, 0),
       (-2, NULL, '🚫 <NO_CATEGORY>', -1, 1, NULL, 0),
       (-3, NULL, '↔️ <TRANSFER>', -1, 1, NULL, 0);

-- ============================================================================
-- TABLE: attributes (no dependencies)
-- ============================================================================
/*DROP TABLE IF EXISTS attributes;
 
 CREATE TABLE attributes (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 -- attribute id
 type INT NOT NULL DEFAULT 1,
 -- type like BINARY, TEXT, LIST, OPTIONS
 title VARCHAR(255) NULL,
 -- name of attribute
 list_values TEXT NULL,
 -- values if list or OPTIONS
 default_value VARCHAR(255) NULL
 );*/
-- ============================================================================
-- TABLE: category_attributes (depends from: category, attributes)
-- ============================================================================
/*DROP TABLE IF EXISTS categories_attributes;
 
 CREATE TABLE categories_attributes (
 category_id INT NOT NULL,
 attribute_id INT NOT NULL,
 PRIMARY KEY (category_id, attribute_id),
 -- INDEX `category_attr_idx` (`category_id`),
 -- INDEX `idx_category_attribute_attr` (`attribute_id`),
 CONSTRAINT fk_category_attribute_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT fk_category_attribute_attribute FOREIGN KEY (attribute_id) REFERENCES attributes(id) ON DELETE CASCADE ON UPDATE CASCADE
 );*/
-- ---------------------------------------------------- --
-- PROJECTS TABLE (depends from: users)
-- ---------------------------------------------------- --

CREATE TABLE `projects` (
    `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'Project ID',
    `title` VARCHAR(255) NULL COMMENT 'Project Name',
    `is_active` BOOLEAN NOT NULL DEFAULT 1 COMMENT 'Is The Project still active?',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT 'Sort Order',
    `budget` DECIMAL(10,2) NOT NULL DEFAULT -1 COMMENT 'Project Budget',
    `user_id` INT NOT NULL COMMENT 'Foreign Key to Users Table',
    CONSTRAINT `fk_projects_users` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) COMMENT 'Projects Table. Depends from users table.';

-- ---------------------------------------------------- --
-- PAYEES TABLE (depends from: users)
-- ---------------------------------------------------- --

CREATE TABLE `payees` (
    `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'Payee ID',
    `title` VARCHAR(255) NULL COMMENT 'Payee Name',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT 'Sort Order',
    `is_active` BOOLEAN NOT NULL DEFAULT 1 COMMENT 'Is The Payee Active',
    `user_id` INT NOT NULL COMMENT 'Foreign Key to Users Table',
    CONSTRAINT `fk_payees_users` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
) COMMENT 'Payees Table. Depends from users table.';

-- ---------------------------------------------------- --
-- ACCOUNTS TYPES TABLE (no depends)
-- ---------------------------------------------------- --

CREATE TABLE `account_types` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Account Type ID',
    `title` VARCHAR(255) NOT NULL COMMENT 'Account Type Description'
) COMMENT 'Account Types Table. No depends from other tables.';

-- Insert default account types
INSERT INTO `account_types` (`title`)
VALUES 
    ('Cash'),
    ('Bank Account'),
    ('Credit Card'),
    ('Prepaid Card'),
    ('Electronic Wallet'),
    ('Savings Account'),
    ('Investment Account'),
    ('Loan Account'),
    ('Other');

-- ---------------------------------------------------- --
-- ACCOUNTS TABLE (depends from: users, currencies, account_types)
-- ---------------------------------------------------- --

CREATE TABLE `accounts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Account ID',
    `title` VARCHAR(255) NOT NULL COMMENT 'Account Description',
    `currency_id` INT NOT NULL COMMENT 'Foreign Key To Currencies Table',
    `user_id` INT NOT NULL COMMENT 'Foreign Key To Users Table',
    `initial_amount` DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Initial Amount In The Account',
    `account_type_id` INT NOT NULL COMMENT 'Foreign Key To Account Type',
    `issuer` VARCHAR(255) DEFAULT NULL COMMENT 'Account Issuer',
    `account_number` VARCHAR(255) DEFAULT NULL COMMENT 'Account Number',
    `is_active` BOOLEAN NOT NULL DEFAULT 1 COMMENT 'Is The Account Active',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT 'Sort Order',
    `is_included_into_totals` BOOLEAN NOT NULL DEFAULT 1 COMMENT 'Is Included Into Totals',
    -- `is_credit_card` BOOLEAN NOT NULL DEFAULT 0 COMMENT 'Is A Credit Card Account',
    `card_limit` DECIMAL(10,2) DEFAULT NULL COMMENT 'Credit Card Limit',
    `card_closing_day` INT DEFAULT NULL COMMENT 'Credit Card Closing Day',
    `card_payment_day` INT DEFAULT NULL COMMENT 'Credit Card Payment Day',
    `notes` VARCHAR(255) DEFAULT NULL COMMENT 'Additional Notes',
    `actual_amount` DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Actual Amount In The Account',
    `is_credit_card` TINYINT(1) DEFAULT 0 NOT NULL COMMENT 'Is this account a credit card?',
    `account_credit_card` INT DEFAULT NULL NULL COMMENT 'The account associated to the credit card',
    CONSTRAINT `fk_accounts_parent` FOREIGN KEY (`account_credit_card`) REFERENCES `accounts`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_accounts_currencies` FOREIGN KEY (`currency_id`) REFERENCES `currencies`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `fk_accounts_users` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_accounts_account_types` FOREIGN KEY (`account_type_id`) REFERENCES `account_types`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX `idx_accounts_currency_id` (`currency_id`),
    CONSTRAINT `chk_card_closing_day` CHECK (`card_closing_day` BETWEEN 1 AND 31),
    CONSTRAINT `chk_card_payment_day` CHECK (`card_payment_day` BETWEEN 1 AND 31)
) COMMENT 'Accounts Table. Depends from users and currencies tables.';

-- ---------------------------------------------------- --
-- TRANSACTIONS TABLE (depends from: users, currencies)
-- ---------------------------------------------------- --

CREATE TABLE `transactions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Transaction ID',
    `from_account_id` INT NOT NULL COMMENT 'Foreign Key To From Account ID',
    `to_account_id` INT DEFAULT NULL COMMENT 'Foreign Key To To Account ID',
    `amount_from` DECIMAL(10,2) NOT NULL COMMENT 'Amount Withdrawn',
    `amount_to` DECIMAL(10,2) DEFAULT NULL COMMENT 'Amount Deposited',
    `category_id` INT DEFAULT NULL COMMENT 'Foreign Key To Categories Table',
    `parent_id` INT DEFAULT NULL COMMENT 'Foreign Key To Parent Transaction ID (for split transactions)',
    `project_id` INT DEFAULT NULL COMMENT 'Foreign Key To Projects Table',
    `title` VARCHAR(255) NOT NULL COMMENT 'Transaction Description',
    `transaction_date` DATETIME NOT NULL COMMENT 'Transaction Date and Time',
    `currency_id` INT NOT NULL COMMENT 'Foreign Key To Currencies Table',
    `user_id` INT NOT NULL COMMENT 'Foreign Key To Users Table',
    `payee_id` INT DEFAULT NULL COMMENT 'Foreign Key To Payees Table',
    -- `has_attachment` BOOLEAN NOT NULL DEFAULT 0 COMMENT 'Does The Transaction Have Attachments?',
    -- `attachment_path` VARCHAR(255) DEFAULT NULL COMMENT 'Path To Attachment File',
    `notes` TEXT DEFAULT NULL COMMENT 'Additional Notes',
    `is_transfer` BOOLEAN NOT NULL DEFAULT 0 COMMENT 'Is The Transaction A Transfer?',
    `is_automotive` BOOLEAN NOT NULL DEFAULT 0 COMMENT 'Is The Transaction An Automotive Transaction?',
    `deductible_amount` DECIMAL(10,2) DEFAULT NULL COMMENT 'Deductible amount for tax purposes',
    CONSTRAINT `fk_transactions_currencies` FOREIGN KEY (`currency_id`) REFERENCES `currencies`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `fk_transactions_users` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_transactions_categories` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT `fk_transactions_payees` FOREIGN KEY (`payee_id`) REFERENCES `payees`(`id`) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT `fk_transactions_projects` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT `fk_transactions_parent` FOREIGN KEY (`parent_id`) REFERENCES `transactions`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_transactions_from_account` FOREIGN KEY (`from_account_id`) REFERENCES `accounts`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `fk_transactions_to_account` FOREIGN KEY (`to_account_id`) REFERENCES `accounts`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX `idx_transactions_currency_id` (`currency_id`),
    INDEX `idx_transactions_account_id` (`from_account_id`),
    INDEX `idx_transactions_category_id` (`category_id`),
    INDEX `idx_transactions_payee_id` (`payee_id`),
    INDEX `idx_transactions_project_id` (`project_id`),
    INDEX `idx_transactions_parent_id` (`parent_id`),
    INDEX `idx_transactions_to_account_id` (`to_account_id`),
    INDEX `idx_transactions_user_id` (`user_id`)
) COMMENT 'Transactions Table. Depends from users, currencies, accounts, categories, payees and projects tables.';

-- ---------------------------------------------------- --
-- TRANSACTION ATTACHMENTS TABLE (depends from: transactions)
-- ---------------------------------------------------- --

CREATE TABLE transaction_attachments (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `transaction_id` INT NOT NULL,
    `file_path` VARCHAR(255) NOT NULL,
    FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);

-- ---------------------------------------------------- --
-- TRANSACTION SCHEDULES TABLE (depends from: users, currencies, accounts)
-- ---------------------------------------------------- --

CREATE TABLE `transaction_schedules` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Transaction Schedule ID',
    `title` VARCHAR(255) NOT NULL COMMENT 'Transaction Schedule Description',
    `from_account_id` INT NOT NULL COMMENT 'Foreign Key To From Account ID',
    `to_account_id` INT DEFAULT NULL COMMENT 'Foreign Key To To Account ID (for transfers)',
    `amount_from` DECIMAL(10,2) NOT NULL COMMENT 'Amount Withdrawn (for transfers)',
    `amount_to` DECIMAL(10,2) DEFAULT NULL COMMENT 'Amount Deposited (for transfers)',
    `category_id` INT DEFAULT NULL COMMENT 'Foreign Key To Categories Table',
    `project_id` INT DEFAULT NULL COMMENT 'Foreign Key To Projects Table',
    `currency_id` INT NOT NULL COMMENT 'Foreign Key To Currencies Table',
    `user_id` INT NOT NULL COMMENT 'Foreign Key To Users Table',
    `payee_id` INT DEFAULT NULL COMMENT 'Foreign Key To Payees Table',
    `start_date` DATETIME NOT NULL COMMENT 'Schedule Start Date',
    `end_date` DATETIME DEFAULT NULL COMMENT 'Schedule End Date',
    `frequency` VARCHAR(50) NOT NULL COMMENT 'Frequency (e.g., DAILY, WEEKLY, MONTHLY)',
    `next_transaction_date` DATETIME NOT NULL COMMENT 'Next Scheduled Transaction Date',
    `notes` TEXT DEFAULT NULL COMMENT 'Additional Notes',
    `is_transfer` BOOLEAN NOT NULL DEFAULT 0 COMMENT 'Next Scheduled Is The Transaction A Transfer?',
    `is_automotive` BOOLEAN NOT NULL DEFAULT 0 COMMENT 'Next Scheduled Is The Transaction An Automotive Transaction?',
    `is_active` BOOLEAN NOT NULL DEFAULT 1 COMMENT 'Is the schedule active?',
    CONSTRAINT `fk_transaction_schedules_currencies` FOREIGN KEY (`currency_id`) REFERENCES `currencies`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT `fk_transaction_schedules_users` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_transaction_schedules_categories` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT `fk_transaction_schedules_payees` FOREIGN KEY (`payee_id`) REFERENCES `payees`(`id`) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT `fk_transaction_schedules_projects` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT `fk_transaction_schedules_from_account` FOREIGN KEY (`from_account_id`) REFERENCES `accounts`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_transaction_schedules_to_account` FOREIGN KEY (`to_account_id`) REFERENCES `accounts`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    INDEX `idx_transaction_schedules_currency_id` (`currency_id`),
    INDEX `idx_transaction_schedules_account_id` (`from_account_id`),
    INDEX `idx_transaction_schedules_category_id` (`category_id`),
    INDEX `idx_transaction_schedules_payee_id` (`payee_id`),
    INDEX `idx_transaction_schedules_project_id` (`project_id`),
    INDEX `idx_transaction_schedules_user_id` (`user_id`)
) COMMENT 'Transaction Schedules Table. Depends from users, currencies, accounts, categories, payees and projects tables.';

-- ---------------------------------------------------- --
-- ---------------------------------------------------- --
-- ---------------------------------------------------- --
-- ---------------------------------------------------- --

-- ---------------------------------------------------- --
-- FUELS TYPES TABLE (depends from)
-- ---------------------------------------------------- --

CREATE TABLE `fuels` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Fuel ID',
    `title` VARCHAR(255) NOT NULL COMMENT 'Fuel Type Description'
) COMMENT 'Fuels Types Table. No depends from other tables.';

-- ---------------------------------------------------- --
-- VEHICLES TABLE (depends from: users, fuels)
-- ---------------------------------------------------- --

CREATE TABLE `vehicles` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Vehicle ID',
    `user_id` INT NOT NULL COMMENT 'Foreign Key To Users Table',
    `brand` VARCHAR(255) DEFAULT NULL COMMENT 'Vehicle Brand',
    `model` VARCHAR(255) DEFAULT NULL COMMENT 'Vehicle Model',
    `license_plate` VARCHAR(50) DEFAULT NULL COMMENT 'License Plate Number',
    `year` INT DEFAULT NULL COMMENT 'Vehicle Year',
    `fuel_id` INT DEFAULT NULL COMMENT 'Foreign Key To Fuels Table',
    `initial_mileage` INT NOT NULL DEFAULT 0 COMMENT 'Initial Mileage',
    `current_mileage` INT DEFAULT NULL COMMENT 'Current Mileage',
    `purchase_date` DATE DEFAULT NULL COMMENT 'Purchase Date',
    `purchase_price` DECIMAL(10,2) DEFAULT NULL COMMENT 'Purchase Price',
    `is_active` BOOLEAN NOT NULL DEFAULT 1 COMMENT 'Is The Vehicle Active',
    `notes` TEXT DEFAULT NULL COMMENT 'Additional Notes',
    CONSTRAINT `fk_vehicles_users` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_vehicles_fuels` FOREIGN KEY (`fuel_id`) REFERENCES `fuels`(`id`) ON UPDATE CASCADE ON DELETE SET NULL,
    INDEX `idx_vehicles_user_id` (`user_id`),
    INDEX `idx_vehicles_fuel_id` (`fuel_id`)
) COMMENT 'Vehicles Table. Depends from users and fuels tables.';

-- ---------------------------------------------------- --
-- FUELS_LOGS TABLE (depends from: users, fuels, vehicles, transactions)
-- ---------------------------------------------------- --

CREATE TABLE `fuels_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Fuel Log ID',
    `vehicle_id` INT NOT NULL COMMENT 'Foreign Key To Vehicles Table',
    `transaction_id` INT DEFAULT NULL COMMENT 'Foreign Key To Transactions Table',
    -- `user_id` INT NOT NULL COMMENT 'Foreign Key To Users Table',
    `date` DATETIME NOT NULL COMMENT 'Refuel Date and Time',
    `odometer` INT NOT NULL COMMENT 'Odometer Reading',
    `fuel_volume` DECIMAL(10,2) NOT NULL COMMENT 'Fuel Volume',
    `fuel_price_per_unit` DECIMAL(10,3) NOT NULL COMMENT 'Fuel Price Per Unit',
    `total_cost` DECIMAL(10,2) NOT NULL COMMENT 'Total Cost',
    `is_full_tank` BOOLEAN NOT NULL DEFAULT 1 COMMENT 'Is Full Tank Refuel',
    `fuel_type_id` INT DEFAULT NULL COMMENT 'Foreign Key To Fuels Table',
    `average_consumption` DECIMAL(10,2) DEFAULT NULL COMMENT 'Average Consumption (e.g., L/100km)',
    `distance_since_last_refuel` INT DEFAULT NULL COMMENT 'Distance Since Last Refuel',
    `notes` TEXT DEFAULT NULL COMMENT 'Additional Notes',
    `is_previous_missed` BOOLEAN NOT NULL DEFAULT 0 COMMENT 'Is the previous refuel miss?',
    CONSTRAINT `fk_fuels_logs_vehicles` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    -- CONSTRAINT `fk_fuels_logs_users` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_fuels_logs_transactions` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_fuels_logs_fuels` FOREIGN KEY (`fuel_type_id`) REFERENCES `fuels`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX `idx_fuels_logs_vehicle_id` (`vehicle_id`),
    INDEX `idx_fuels_logs_transaction_id` (`transaction_id`),
    INDEX `idx_fuels_logs_fuel_type_id` (`fuel_type_id`)
    -- INDEX `idx_fuels_logs_user_id` (`user_id`)
) COMMENT 'Fuels Logs Table. Depends from users, vehicles, fuels and transactions tables.';

-- ---------------------------------------------------- --
-- MAINTENANCE TYPES TABLE (depends from users, vehicles)
-- ---------------------------------------------------- --

CREATE TABLE `maintenance_types` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Maintenance Type ID',
    `title` VARCHAR(255) NOT NULL COMMENT 'Maintenance Type Description',
    `user_id` INT NOT NULL COMMENT 'Foreign Key To Users Table',
    `vehicle_id` INT DEFAULT NULL COMMENT 'Foreign Key To Vehicles Table',
    `default_interval_km` INT DEFAULT NULL COMMENT 'Default Interval In KM',
    `default_interval_months` INT DEFAULT NULL COMMENT 'Default Interval In Months',
    `default_days_before_alert` INT DEFAULT NULL COMMENT 'Default Days Before Alert',
    `default_km_before_alert` INT DEFAULT NULL COMMENT 'Default KM Before Alert',
    CONSTRAINT `fk_maintenance_types_users` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_maintenance_types_vehicles` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    INDEX `idx_maintenance_types_user_id` (`user_id`),
    INDEX `idx_maintenance_types_vehicle_id` (`vehicle_id`)
) COMMENT 'Maintenance Types Table. Depends from users and vehicles table.';

-- ---------------------------------------------------- --
-- MAINTENANCES_LOGS TABLE (depends from: manteinance_types, transactions, vehicles)
-- ---------------------------------------------------- --

CREATE TABLE `maintenances_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Maintenance Log ID',
    `vehicle_id` INT NOT NULL COMMENT 'Foreign Key To Vehicles Table',
    `transaction_id` INT DEFAULT NULL COMMENT 'Foreign Key To Transactions Table',
    -- `user_id` INT NOT NULL COMMENT 'Foreign Key To Users Table',
    `maintenance_type_id` INT DEFAULT NULL COMMENT 'Foreign Key To Maintenance Types Table',
    `date` DATETIME NOT NULL COMMENT 'Maintenance Date and Time',
    `odometer` INT NOT NULL COMMENT 'Odometer Reading',
    `description` VARCHAR(255) NOT NULL COMMENT 'Maintenance Description',
    `amount` DECIMAL(10,2) NOT NULL COMMENT 'Total Cost',
    `notes` TEXT DEFAULT NULL COMMENT 'Additional Notes',
    CONSTRAINT `fk_maintenances_logs_vehicles` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    -- CONSTRAINT `fk_maintenances_logs_users` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_maintenances_logs_transactions` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_maintenances_logs_maintenance_types` FOREIGN KEY (`maintenance_type_id`) REFERENCES `maintenance_types`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    INDEX `idx_maintenances_logs_vehicle_id` (`vehicle_id`),
    INDEX `idx_maintenances_logs_transaction_id` (`transaction_id`),
    INDEX `idx_maintenances_logs_maintenance_type_id` (`maintenance_type_id`)
    -- INDEX `idx_maintenances_logs_user_id` (`user_id`)
) COMMENT 'Maintenances Logs Table. Depends from users, vehicles and transactions tables.';

-- ---------------------------------------------------- --
-- MAINTENANCE ALERTS TABLE (depends from: maintenance_types, vehicles)
-- ---------------------------------------------------- --

CREATE TABLE `maintenance_alerts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Maintenance Alert ID',
    `vehicle_id` INT NOT NULL COMMENT 'Foreign Key To Vehicles Table',
    `maintenance_type_id` INT NOT NULL COMMENT 'Foreign Key To Maintenance Types Table',
    `last_maintenance_date` DATETIME DEFAULT NULL COMMENT 'Last Maintenance Date',
    `last_maintenance_odometer` INT DEFAULT NULL COMMENT 'Last Maintenance Odometer',
    `next_maintenance_date` DATETIME DEFAULT NULL COMMENT 'Next Maintenance Date',
    `next_maintenance_odometer` INT DEFAULT NULL COMMENT 'Next Maintenance Odometer',
    `next_alert_date` DATETIME DEFAULT NULL COMMENT 'Next Alert Date',
    `next_alert_odometer` INT DEFAULT NULL COMMENT 'Next Alert Odometer',
    `is_alert_sent` BOOLEAN NOT NULL DEFAULT 0 COMMENT 'Is Alert Sent',
    CONSTRAINT `fk_maintenance_alerts_vehicles` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT `fk_maintenance_alerts_maintenance_types` FOREIGN KEY (`maintenance_type_id`) REFERENCES `maintenance_types`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
    INDEX `idx_maintenance_alerts_vehicle_id` (`vehicle_id`),
    INDEX `idx_maintenance_alerts_maintenance_type_id` (`maintenance_type_id`)
) COMMENT 'Maintenance Alerts Table. Depends from vehicles and maintenance_types tables.';

-- SET FOREIGN_KEY_CHECKS = 1;


-- ---------------------------------------------------- --
-- PUSH SUBSCRIPTIONS TABLE (depends from: users)
-- ---------------------------------------------------- --

CREATE TABLE `push_subscriptions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Subscription ID',
    `user_id` INT NOT NULL COMMENT 'Foreign Key To Users Table',
    `endpoint` TEXT NOT NULL COMMENT 'Push Endpoint',
    `keys_p256dh` TEXT NOT NULL COMMENT 'P256dh Key',
    `keys_auth` TEXT NOT NULL COMMENT 'Auth Key',
    `last_notification_sent_at` DATETIME DEFAULT NULL COMMENT 'Last time a push notification was sent',
    `created_at` DATETIME DEFAULT NOW() COMMENT 'Creation Date',
    CONSTRAINT `fk_push_subscriptions_users` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_push_subscriptions_user_id` (`user_id`)
) COMMENT 'Push Subscriptions Table. Depends from users table.';
