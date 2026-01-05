const mysql = require('mysql2/promise');
const { DB_CONFIG } = require('./config');

async function testConnection() {
  console.log('Testing database connection...');
  console.log('Config:', { ...DB_CONFIG, password: '***' });
  
  try {
    const connection = await mysql.createConnection(DB_CONFIG);
    console.log('✓ Database connection successful!');
    
    // Test query
    const [rows] = await connection.execute('SELECT DATABASE() as current_db');
    console.log('Current database:', rows[0].current_db);
    
    // Check if tables exist
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'users'"
    );
    
    if (tables.length > 0) {
      console.log('✓ Users table exists');
    } else {
      console.log('✗ Users table does NOT exist');
      console.log('Please run database.sql to create the tables');
    }
    
    await connection.end();
  } catch (error) {
    console.error('✗ Database connection failed!');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('Errno:', error.errno);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\nMySQL server is not running. Please start MySQL.');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\nDatabase does not exist. Please create it using database.sql');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\nAccess denied. Check your database credentials in config.js');
    }
  }
}

testConnection();


