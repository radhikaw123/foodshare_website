// Database configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'radhika@123',
  database: process.env.DB_NAME || 'foodshare_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

module.exports = { DB_CONFIG };

