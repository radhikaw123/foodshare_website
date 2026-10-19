
const fs = require('fs');
const path = require('path');

const caPath = path.join(__dirname, 'aiven-ca.pem');

if (!fs.existsSync(caPath)) {
  throw new Error('Aiven CA certificate file aiven-ca.pem is missing.');
}

const ca = fs.readFileSync(caPath, 'utf8');

if (
  !ca.includes('-----BEGIN CERTIFICATE-----') ||
  !ca.includes('-----END CERTIFICATE-----')
) {
  throw new Error('Aiven CA certificate file is invalid or malformed.');
}

const DB_CONFIG = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'defaultdb',
  port: Number(process.env.DB_PORT || 22243),

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  ssl: {
    ca,
    rejectUnauthorized: true
  }
};

module.exports = { DB_CONFIG };
