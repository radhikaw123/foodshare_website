# Database Setup Instructions

## Issue Found
The database connection is failing because MySQL requires a password for the 'root' user, but the configuration has an empty password.

## Solution Options

### Option 1: Set MySQL Password in config.js (Recommended)

1. Open `config.js`
2. Update the password field with your MySQL root password:
   ```javascript
   password: process.env.DB_PASS || 'your_mysql_password_here',
   ```

### Option 2: Create MySQL User Without Password (Not Recommended for Production)

If you want to use no password, you need to create a MySQL user:

1. Open MySQL command line or phpMyAdmin
2. Run:
   ```sql
   CREATE USER 'foodshare_user'@'localhost' IDENTIFIED BY '';
   GRANT ALL PRIVILEGES ON foodshare_db.* TO 'foodshare_user'@'localhost';
   FLUSH PRIVILEGES;
   ```
3. Update `config.js`:
   ```javascript
   user: process.env.DB_USER || 'foodshare_user',
   password: process.env.DB_PASS || '',
   ```

### Option 3: Find Your MySQL Root Password

If you're using XAMPP:
- Default password is usually empty, but if you set one during installation, use that
- Check XAMPP Control Panel for MySQL configuration

If you're using WAMP:
- Default password is usually empty
- Check WAMP settings if you changed it

If you're using standalone MySQL:
- Use the password you set during MySQL installation
- If you forgot it, you may need to reset it

## Create the Database

After fixing the password, create the database:

1. Open MySQL command line or phpMyAdmin
2. Run the SQL from `database.sql`:
   ```sql
   CREATE DATABASE IF NOT EXISTS foodshare_db;
   USE foodshare_db;
   
   CREATE TABLE IF NOT EXISTS users (
       id INT AUTO_INCREMENT PRIMARY KEY,
       full_name VARCHAR(100) NOT NULL,
       email VARCHAR(100) UNIQUE NOT NULL,
       password VARCHAR(255) NOT NULL,
       role ENUM('donor', 'recipient', 'volunteer') NOT NULL,
       location VARCHAR(255),
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   );
   
   CREATE TABLE IF NOT EXISTS sessions (
       id INT AUTO_INCREMENT PRIMARY KEY,
       user_id INT NOT NULL,
       session_token VARCHAR(255) UNIQUE NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       expires_at TIMESTAMP NOT NULL,
       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   );
   
   CREATE INDEX idx_email ON users(email);
   CREATE INDEX idx_session_token ON sessions(session_token);
   ```

Or import the `database.sql` file directly.

## Test Connection

After updating the password, test the connection:
```bash
node test-db-connection.js
```

You should see:
```
✓ Database connection successful!
✓ Users table exists
```

## Quick Fix

If you know your MySQL root password is empty and it should work, try:

1. Make sure MySQL is running
2. Try connecting with MySQL command line:
   ```bash
   mysql -u root -p
   ```
   (Press Enter when asked for password if it's empty)

3. If that works, the issue might be with the connection pool. Try restarting the Node.js server.


