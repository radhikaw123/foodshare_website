
const DB_CONFIG = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'defaultdb',
  port: Number(process.env.DB_PORT || 3306),

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  ssl: {
  ca: process.env.DB_SSL_CA?.replace(/\\n/g, '\n'),
  rejectUnauthorized: true
}
};

if (!DB_CONFIG.ssl.ca) {
  throw new Error('DB_SSL_CA is missing. Configure the Aiven CA certificate in the deployment environment.');
}

module.exports = { DB_CONFIG };
