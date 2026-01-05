<?php
require_once 'auth.php';

$token = $_COOKIE['session_token'] ?? null;

if (logout($token)) {
    http_response_code(200);
    echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
} else {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Logout failed']);
}
?>


