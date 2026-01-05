# FoodShare Backend Setup Instructions

This guide will help you set up the MySQL backend for the FoodShare application.

## Prerequisites

1. **XAMPP** (or similar PHP/MySQL stack):
   - Download from: https://www.apachefriends.org/
   - Includes: Apache, PHP, MySQL, phpMyAdmin

2. **Alternative Options**:
   - WAMP (Windows)
   - MAMP (Mac)
   - LAMP (Linux)
   - Or install PHP and MySQL separately

## Step 1: Install XAMPP

1. Download and install XAMPP
2. Start Apache and MySQL services from XAMPP Control Panel

## Step 2: Setup Database

1. Open phpMyAdmin: http://localhost/phpmyadmin
2. Click on "SQL" tab
3. Copy and paste the contents of `database.sql` file
4. Click "Go" to execute
5. This will create:
   - Database: `foodshare_db`
   - Table: `users` (for storing user accounts)
   - Table: `sessions` (for managing user sessions)

## Step 3: Configure Database Connection

1. Open `config.php` file
2. Update the database credentials if needed:
   ```php
   define('DB_HOST', 'localhost');  // Usually 'localhost'
   define('DB_USER', 'root');        // Default XAMPP username
   define('DB_PASS', '');           // Default XAMPP password (empty)
   define('DB_NAME', 'foodshare_db');
   ```

## Step 4: Place Files in Web Server Directory

1. Copy all PHP files to your web server directory:
   - **XAMPP**: `C:\xampp\htdocs\food_share_a\` (or your project folder)
   - **WAMP**: `C:\wamp64\www\food_share_a\`
   - **MAMP**: `/Applications/MAMP/htdocs/food_share_a/`

2. Make sure these files are in the same directory:
   - `config.php`
   - `signup.php`
   - `login.php`
   - `auth.php`
   - `logout.php`
   - All your HTML files

## Step 5: Test the Setup

1. Open your browser
2. Navigate to: `http://localhost/food_share_a/` (or your project path)
3. Try signing up with a new account
4. Try logging in with the created account

## Step 6: Security Considerations

### For Production:

1. **Change Database Password**:
   - Update `config.php` with a strong password
   - Create a dedicated MySQL user (not root)

2. **Enable HTTPS**:
   - Use SSL certificate for secure connections

3. **Update Session Security**:
   - In `signup.php` and `login.php`, the cookie is set with `httponly` flag
   - Consider adding `secure` flag for HTTPS: `setcookie(..., '', true, true)`

4. **Input Validation**:
   - Already implemented in PHP files
   - Consider adding CSRF protection for production

## File Structure

```
food_share_a/
├── config.php          # Database configuration
├── signup.php          # User registration endpoint
├── login.php           # User login endpoint
├── auth.php            # Authentication helper functions
├── logout.php          # User logout endpoint
├── database.sql        # Database schema
├── index.html          # Landing page
├── login.html          # Login page
├── signup.html         # Signup page
├── dashboard.html      # Dashboard (protected)
└── ... (other HTML files)
```

## API Endpoints

### POST /signup.php
- **Body**: JSON
  ```json
  {
    "full_name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "donor",
    "location": "New York"
  }
  ```
- **Response**: 
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "user": {...},
    "session_token": "..."
  }
  ```

### POST /login.php
- **Body**: JSON
  ```json
  {
    "email": "john@example.com",
    "password": "password123"
  }
  ```
- **Response**: 
  ```json
  {
    "success": true,
    "message": "Login successful",
    "user": {...},
    "session_token": "..."
  }
  ```

### POST /logout.php
- **Response**: 
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```

## Troubleshooting

### Database Connection Error
- Check if MySQL is running in XAMPP Control Panel
- Verify database credentials in `config.php`
- Ensure database `foodshare_db` exists

### 404 Error on PHP Files
- Check file paths are correct
- Ensure files are in the web server directory (htdocs)
- Check Apache is running

### CORS Errors
- Already handled in `config.php` with CORS headers
- If issues persist, check browser console

### Password Not Working
- Passwords are hashed using `password_hash()`
- Verify password is at least 6 characters
- Check database to see if user was created

## Testing with Sample Data

You can manually insert a test user in phpMyAdmin:

```sql
INSERT INTO users (full_name, email, password, role, location) 
VALUES ('Test User', 'test@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'donor', 'Test City');
-- Password: password
```

## Next Steps

1. Add password reset functionality
2. Add email verification
3. Add profile update endpoints
4. Add donation management endpoints
5. Implement proper error logging

## Support

If you encounter issues:
1. Check XAMPP error logs
2. Check browser console for JavaScript errors
3. Check PHP error logs (usually in XAMPP/logs/)
4. Verify all file paths are correct


