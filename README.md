# FoodShare - Node.js Backend

FoodShare is a web application for reducing food waste by connecting donors, recipients, and volunteers.

## Quick Start

### Prerequisites

1. **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
2. **MySQL Database** - Make sure MySQL is running and the database is set up

### Database Setup

1. Make sure MySQL is running
2. Create the database using the `database.sql` file:
   ```sql
   mysql -u root -p < database.sql
   ```
   Or import it through phpMyAdmin or your MySQL client

3. Update database credentials in `config.js` if needed (defaults are for XAMPP):
   ```javascript
   host: 'localhost',
   user: 'root',
   password: '',
   database: 'foodshare_db'
   ```

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

### Running the Server

Start the server:
```bash
npm start
```

Or:
```bash
node server.js
```

The server will run on `http://localhost:3000`

### Accessing the Application

- Open your browser and navigate to: `http://localhost:3000`
- The splash page will redirect to the login page after 3 seconds
- Sign up for a new account or log in with existing credentials

## API Endpoints

All API endpoints are prefixed with `/api`:

- `POST /api/login` - User login
- `POST /api/signup` - User registration
- `POST /api/logout` - User logout
- `GET /api/verify` - Verify session token
- `GET /api/health` - Health check

## Project Structure

```
food_share_a/
├── server.js          # Main Express server
├── config.js          # Database configuration
├── auth.js            # Authentication helpers
├── package.json       # Node.js dependencies
├── database.sql       # Database schema
├── index.html         # Splash page
├── login.html         # Login page
├── signup.html        # Signup page
├── dashboard.html     # Dashboard (protected)
├── profile.html       # User profile (protected)
└── ... (other HTML/CSS files)
```

## Features

- User authentication (login, signup, logout)
- Session management with secure tokens
- Password hashing with bcrypt
- Cookie-based session storage
- CORS enabled for cross-origin requests

## Development

The server serves static files from the current directory, so all HTML, CSS, and JavaScript files are accessible directly.

## Notes

- Make sure MySQL is running before starting the server
- The default port is 3000 (change in `server.js` if needed)
- Session tokens expire after 30 days
- Passwords must be at least 6 characters


