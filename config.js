
const DB_CONFIG = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'foodshare_db',
  port: Number(process.env.DB_PORT || 3306),

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  // Verify the database server's TLS certificate
  ssl: process.env.DB_SSL_CA
    ? {
        ca: process.env.DB_SSL_CA,
        rejectUnauthorized: true
      }
    : {
        rejectUnauthorized: true
      }
};

module.exports = { DB_CONFIG };
