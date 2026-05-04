const mysql = require('mysql2/promise');
const { DB_CONFIG } = require('./config');

// Create connection pool
const pool = mysql.createPool(DB_CONFIG);

// Function to verify session token
async function verifySession(token) {
  if (!token) {
    return null;
  }

  try {
    // UPDATED: Added u.profile_image to the SELECT list
    const [rows] = await pool.execute(
      `SELECT s.user_id, u.id, u.full_name, u.email, u.role, u.location, u.profile_image,
              COALESCE(u.rating_sum,0) AS rating_sum, COALESCE(u.rating_count,0) AS rating_count
       FROM sessions s 
       INNER JOIN users u ON s.user_id = u.id 
       WHERE s.session_token = ? AND s.expires_at > NOW()`,
      [token]
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0];
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}

// Function to get current user from request
async function getCurrentUser(req) {
  const token = req.cookies?.session_token || 
                req.headers?.authorization?.replace('Bearer ', '') || 
                null;

  return await verifySession(token);
}

// Function to logout (delete session)
async function logout(token) {
  if (!token) {
    return false;
  }

  try {
    await pool.execute(
      'DELETE FROM sessions WHERE session_token = ?',
      [token]
    );
    return true;
  } catch (error) {
    console.error('Logout error:', error);
    return false;
  }
}

// Middleware to require authentication
async function requireAuth(req, res, next) {
  const user = await getCurrentUser(req);
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  req.user = user;
  next();
}

module.exports = {
  pool,
  verifySession,
  getCurrentUser,
  logout,
  requireAuth
};