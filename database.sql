-- FoodShare Database Schema
-- Create database
CREATE DATABASE IF NOT EXISTS foodshare_db;
USE foodshare_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('donor', 'recipient', 'volunteer') NOT NULL,
    location VARCHAR(255),
    mobile_number VARCHAR(20),
    profile_image LONGTEXT DEFAULT NULL,
    rating_sum INT DEFAULT 0,
    rating_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Sessions table for managing user sessions
CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX idx_email ON users(email);
CREATE INDEX idx_session_token ON sessions(session_token);

CREATE TABLE IF NOT EXISTS donations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    food_type VARCHAR(50),
    quantity VARCHAR(100),
    pickup_location VARCHAR(255),
    best_before_date VARCHAR(50),
    image_data LONGTEXT,
    status ENUM('available', 'requested', 'in-transit', 'completed') DEFAULT 'available',
    recipient_id INT,
    recipient_location VARCHAR(255),
    volunteer_id INT,
    donor_rating TINYINT NULL,
    volunteer_rating TINYINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (volunteer_id) REFERENCES users(id) ON DELETE SET NULL
);
-- Add OTP table for delivery verification
CREATE TABLE IF NOT EXISTS delivery_otp (
    id INT AUTO_INCREMENT PRIMARY KEY,
    donation_id INT NOT NULL,
    receiver_id INT NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_used BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add profile_image column to users if not exists
ALTER TABLE users ADD COLUMN profile_image LONGTEXT DEFAULT NULL;
CREATE INDEX idx_donations_user ON donations(user_id);
CREATE INDEX idx_donations_status ON donations(status);
CREATE INDEX idx_donations_recipient ON donations(recipient_id);
CREATE INDEX idx_delivery_otp_donation ON delivery_otp(donation_id);