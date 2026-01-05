<?php
require_once 'config.php';

// Function to verify session token
function verifySession($token) {
    if (empty($token)) {
        return null;
    }
    
    $conn = getDBConnection();
    
    // Check if session exists and is not expired
    $stmt = $conn->prepare("
        SELECT s.user_id, u.id, u.full_name, u.email, u.role, u.location 
        FROM sessions s 
        INNER JOIN users u ON s.user_id = u.id 
        WHERE s.session_token = ? AND s.expires_at > NOW()
    ");
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        $stmt->close();
        $conn->close();
        return null;
    }
    
    $user = $result->fetch_assoc();
    $stmt->close();
    $conn->close();
    
    return $user;
}

// Function to get current user from session
function getCurrentUser() {
    $token = $_COOKIE['session_token'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? null;
    
    if ($token && strpos($token, 'Bearer ') === 0) {
        $token = substr($token, 7);
    }
    
    return verifySession($token);
}

// Function to logout (delete session)
function logout($token) {
    if (empty($token)) {
        return false;
    }
    
    $conn = getDBConnection();
    $stmt = $conn->prepare("DELETE FROM sessions WHERE session_token = ?");
    $stmt->bind_param("s", $token);
    $result = $stmt->execute();
    $stmt->close();
    $conn->close();
    
    setcookie('session_token', '', time() - 3600, '/');
    
    return $result;
}
?>


