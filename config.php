<?php
// Database configuration
define('DB_HOST', 'foodshare-db.cby8gwiu2kol.eu-north-1.rds.amazonaws.com');
define('DB_USER', 'admin');
define('DB_PASS', 'RadhikaW6868');
define('DB_NAME', 'foodshare_db');
define('DB_PORT', 3306);

// Create database connection
function getDBConnection() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    
    if ($conn->connect_error) {
        die("Connection failed: " . $conn->connect_error);
    }
    
    return $conn;
}

// Set headers for JSON responses
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
?>


