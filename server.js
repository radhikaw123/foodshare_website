const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { pool } = require('./auth'); // Ensure auth.js is updated as per previous step
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));

// INCREASED LIMIT for Base64 Images (Essential for photo uploads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cookieParser());
app.use(express.static('.')); // Serve static files

// Helper function to generate session token
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper function to set session cookie
function setSessionCookie(res, token) {
  const expires = new Date();
  expires.setDate(expires.getDate() + 30); // 30 days
  res.cookie('session_token', token, {
    expires: expires,
    httpOnly: true,
    secure: false, // Set to true in production if using HTTPS
    sameSite: 'lax',
    path: '/'
  });
}

// --- AUTH ROUTES ---

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await pool.execute(
      'INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)',
      [user.id, sessionToken, expiresAt]
    );

    setSessionCookie(res, sessionToken);

    // Return user info (including profile_image if it exists)
    res.json({
      success: true,
      message: 'Login successful',
      session_token: sessionToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        location: user.location,
        profile_image: user.profile_image // Send image to frontend
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/signup
app.post('/api/signup', async (req, res) => {
  try {
    const { fullName, email, password, role, location } = req.body;

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      'INSERT INTO users (full_name, email, password, role, location) VALUES (?, ?, ?, ?, ?)',
      [fullName, email, hashedPassword, role, location || '']
    );

    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await pool.execute(
      'INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)',
      [result.insertId, sessionToken, expiresAt]
    );

    setSessionCookie(res, sessionToken);

    res.status(201).json({
      success: true,
      message: 'User created',
      user: { id: result.insertId, full_name: fullName, email, role, location }
    });

  } catch (error) {
    console.error('Signup error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/logout
app.post('/api/logout', async (req, res) => {
  const token = req.cookies?.session_token;
  if (token) {
    await pool.execute('DELETE FROM sessions WHERE session_token = ?', [token]);
  }
  res.clearCookie('session_token');
  res.json({ success: true });
});

// GET /api/verify - Used by check-auth.js
app.get('/api/verify', async (req, res) => {
  try {
    const { verifySession } = require('./auth');
    const token = req.cookies?.session_token || req.headers?.authorization?.replace('Bearer ', '');
    const user = await verifySession(token);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid session' });
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// --- PROFILE ROUTES (NEW) ---

// PUT /api/profile - Update User Profile & Image
app.put('/api/profile', async (req, res) => {
  try {
    const { verifySession } = require('./auth');
    const token = req.cookies?.session_token || req.headers?.authorization?.replace('Bearer ', '');
    const user = await verifySession(token);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { full_name, email, location, profile_image } = req.body;

    // Build the query dynamically
    let query = 'UPDATE users SET full_name = ?, email = ?, location = ?';
    let params = [full_name, email, location];

    // Only update image if a new one is sent
    if (profile_image) {
      query += ', profile_image = ?';
      params.push(profile_image);
    }

    query += ' WHERE id = ?';
    params.push(user.id);

    await pool.execute(query, params);

    // Return updated user data
    res.json({ 
      success: true, 
      message: 'Profile updated',
      user: {
        ...user,
        full_name,
        email,
        location,
        profile_image: profile_image || user.profile_image
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- DONATION ROUTES ---

// POST /api/donations - Create Donation
app.post('/api/donations', async (req, res) => {
  try {
    const { verifySession } = require('./auth');
    const token = req.cookies?.session_token || req.headers?.authorization?.replace('Bearer ', '');
    const user = await verifySession(token);

    if (!user) {
      return res.status(401).json({ success: false, message: 'You must be logged in' });
    }

    const { title, description, food_type, quantity, pickup_location, best_before_date, image_data } = req.body;

    // Insert into DB
    const [result] = await pool.execute(
      `INSERT INTO donations 
      (user_id, title, description, food_type, quantity, pickup_location, best_before_date, image_data, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available')`,
      [user.id, title, description, food_type, quantity, pickup_location, best_before_date, image_data]
    );

    res.json({ success: true, message: 'Donation created', donationId: result.insertId });

  } catch (error) {
    console.error('Create donation error:', error);
    res.status(500).json({ success: false, message: error.message || 'Database error' });
  }
});

// GET /api/donations - Get All Donations
app.get('/api/donations', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT d.*, u.full_name as donor_name 
       FROM donations d 
       JOIN users u ON d.user_id = u.id 
       ORDER BY d.created_at DESC`
    );
    res.json({ success: true, donations: rows });
  } catch (error) {
    console.error('Get donations error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch donations' });
  }
});
// PUT /api/donations/:id/request - Mark a donation as requested by recipient
app.put('/api/donations/:id/request', async (req, res) => {
  try {
    const { verifySession } = require('./auth');
    const token = req.cookies?.session_token || req.headers?.authorization?.replace('Bearer ', '');
    const user = await verifySession(token);

    // 1. Verify user exists and is a recipient
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (user.role !== 'recipient') {
      return res.status(403).json({ success: false, message: 'Only recipients can request donations' });
    }

    const donationId = req.params.id;

    // 2. Check if donation exists and is currently available
    const [check] = await pool.execute('SELECT status FROM donations WHERE id = ?', [donationId]);
    if (check.length === 0) {
        return res.status(404).json({success: false, message: 'Donation not found'});
    }
    if (check[0].status !== 'available') {
        return res.status(400).json({success: false, message: 'This donation is no longer available'});
    }

    // 3. Update the donation status and set recipient_id
    await pool.execute(
      'UPDATE donations SET status = ?, recipient_id = ? WHERE id = ?',
      ['requested', user.id, donationId]
    );

    res.json({ success: true, message: 'Donation requested successfully' });

  } catch (error) {
    console.error('Request donation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});