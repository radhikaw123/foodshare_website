require('dotenv').config();
const nodemailer = require('nodemailer');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { pool } = require('./auth'); // Ensure auth.js is updated as per previous step

// on startup ensure 'volunteer_id' column exists (migration)
(async () => {
  try {
    const [cols] = await pool.execute("SHOW COLUMNS FROM donations LIKE 'volunteer_id'");
    if (cols.length === 0) {
      await pool.execute('ALTER TABLE donations ADD COLUMN volunteer_id INT NULL');
      await pool.execute('ALTER TABLE donations ADD CONSTRAINT fk_volunteer FOREIGN KEY (volunteer_id) REFERENCES users(id) ON DELETE SET NULL');
      console.log('Migration: added volunteer_id column');
    }

    // ensure ratings columns exist on donations for preventing double ratings
    const [rateCols] = await pool.execute("SHOW COLUMNS FROM donations LIKE 'donor_rating'");
    if (rateCols.length === 0) {
      await pool.execute('ALTER TABLE donations ADD COLUMN donor_rating TINYINT NULL');
      await pool.execute('ALTER TABLE donations ADD COLUMN volunteer_rating TINYINT NULL');
      console.log('Migration: added rating columns to donations');
    }

    // ensure users have mobile_number column (needed by edit-profile)
    const [phoneCols] = await pool.execute("SHOW COLUMNS FROM users LIKE 'mobile_number'");
    if (phoneCols.length === 0) {
      await pool.execute("ALTER TABLE users ADD COLUMN mobile_number VARCHAR(20) NULL");
      console.log('Migration: added mobile_number to users');
    }

    // ensure users have aggregate rating fields
    const [userCols] = await pool.execute("SHOW COLUMNS FROM users LIKE 'rating_sum'");
    if (userCols.length === 0) {
      await pool.execute('ALTER TABLE users ADD COLUMN rating_sum INT DEFAULT 0');
      await pool.execute('ALTER TABLE users ADD COLUMN rating_count INT DEFAULT 0');
      console.log('Migration: added rating_sum and rating_count to users');
    }
  } catch (err) {
    console.error('Error checking/adding rating columns:', err.message);
  }
})();
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

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
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'raware371322@kkwagh.edu.in',
    pass: 'krdm dfez sytq sgpa'
  }
});
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
// ...existing code...

// PUT /api/profile - Update user profile
app.put('/api/profile', async (req, res) => {
  try {
    const { verifySession } = require('./auth');
    const token = req.cookies?.session_token || req.headers?.authorization?.replace('Bearer ', '');
    const user = await verifySession(token);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { full_name, email, location, mobile_number, profile_image } = req.body;

    // Validate mobile number if provided
    if (mobile_number) {
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(mobile_number.replace(/\D/g, ''))) {
        return res.status(400).json({ success: false, message: 'Invalid phone number format' });
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    // Check if email already exists (if changed)
    const [existingUser] = await pool.execute(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, user.id]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    // Update user in database
    let query = 'UPDATE users SET full_name = ?, email = ?, location = ?, mobile_number = ?';
    let params = [full_name, email, location, mobile_number || null];

    if (profile_image) {
      query += ', profile_image = ?';
      params.push(profile_image);
    }

    query += ' WHERE id = ?';
    params.push(user.id);

    await pool.execute(query, params);

    // Fetch updated user data
    const [updatedUserData] = await pool.execute(
      'SELECT id, email, full_name, location, mobile_number, profile_image, role FROM users WHERE id = ?',
      [user.id]
    );

    if (updatedUserData.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const updatedUser = updatedUserData[0];

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
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
            `SELECT d.*, u.full_name as donor_name, u.location as donor_location,
              r.full_name as receiver_name, COALESCE(d.recipient_location, r.location) as receiver_location
             FROM donations d 
             JOIN users u ON d.user_id = u.id 
             LEFT JOIN users r ON d.recipient_id = r.id
             ORDER BY d.created_at DESC`
    );
    res.json({ success: true, donations: rows });
  } catch (error) {
    console.error('Get donations error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch donations' });
  }
});

// allow recipients to rate a completed donation, updating both donor and volunteer
app.put('/api/donations/:id/rate', async (req, res) => {
  try {
    const { verifySession } = require('./auth');
    const token = req.cookies?.session_token || req.headers?.authorization?.replace('Bearer ', '');
    const user = await verifySession(token);

    if (!user || user.role !== 'recipient') {
      return res.status(403).json({ success: false, message: 'Only recipients may rate' });
    }

    const donationId = req.params.id;
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be 1 to 5' });
    }

    // fetch donation to validate ownership and status
    const [[donation]] = await pool.execute('SELECT user_id, volunteer_id, recipient_id, status, donor_rating, volunteer_rating FROM donations WHERE id = ?', [donationId]);
    if (!donation) {
      return res.status(404).json({ success: false, message: 'Donation not found' });
    }
    if (donation.recipient_id !== user.id) {
      return res.status(403).json({ success: false, message: 'You did not request this donation' });
    }
    if (donation.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Only completed donations can be rated' });
    }
    // prevent double rating
    if (donation.donor_rating && donation.volunteer_rating) {
      return res.status(400).json({ success: false, message: 'You have already rated this donation' });
    }

    // update donor's aggregate rating
    await pool.execute('UPDATE users SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?', [rating, donation.user_id]);
    // update volunteer's aggregate rating if exists
    if (donation.volunteer_id) {
      await pool.execute('UPDATE users SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?', [rating, donation.volunteer_id]);
    }

    // mark donation as rated so recipient can't rate again
    await pool.execute('UPDATE donations SET donor_rating = ?, volunteer_rating = ? WHERE id = ?', [rating, rating, donationId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Rating error:', error);
    res.status(500).json({ success: false, message: 'Failed to save rating' });
  }
});

// GET /api/donations/all - Get All Donations (for volunteers to see complete information)
// Only return items that are unassigned or already assigned to the requesting volunteer.
app.get('/api/donations/all', async (req, res) => {
  try {
    const { verifySession } = require('./auth');
    const token = req.cookies?.session_token || req.headers?.authorization?.replace('Bearer ', '');
    const user = await verifySession(token);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Check if user is a volunteer
    if (user.role !== 'volunteer') {
      return res.status(403).json({ success: false, message: 'Only volunteers can view all donations' });
    }

    // ensure donation table has volunteer_id column (should be added via migration)
    const [rows] = await pool.execute(
            `SELECT d.*, u.full_name as donor_name, u.location as donor_location,
              r.full_name as receiver_name, COALESCE(d.recipient_location, r.location) as receiver_location,
              v.full_name as volunteer_name
             FROM donations d 
             JOIN users u ON d.user_id = u.id 
             LEFT JOIN users r ON d.recipient_id = r.id
             LEFT JOIN users v ON d.volunteer_id = v.id
             WHERE d.volunteer_id IS NULL OR d.volunteer_id = ?
             ORDER BY d.created_at DESC`,
      [user.id]
    );
    res.json({ success: true, donations: rows });
  } catch (error) {
    console.error('Get all donations error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch donations' });
  }
});

// GET /api/users/:id - Get user details (for donor phone/more info)
app.get('/api/users/:id', async (req, res) => {
  try {
    const { verifySession } = require('./auth');
    const token = req.cookies?.session_token || req.headers?.authorization?.replace('Bearer ', '');
    const currentUser = await verifySession(token);

    if (!currentUser) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userId = req.params.id;
    const [rows] = await pool.execute(
      'SELECT id, full_name, email, role, location, mobile_number, profile_image FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user: rows[0] });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user details' });
  }
});

// GET /api/donations/:id - Get Single Donation Details (for volunteers)
app.get('/api/donations/:id', async (req, res) => {
  try {
    const { verifySession } = require('./auth');
    const token = req.cookies?.session_token || req.headers?.authorization?.replace('Bearer ', '');
    const user = await verifySession(token);

    if (!user || user.role !== 'volunteer') {
      return res.status(403).json({ success: false, message: 'Only volunteers can view donation details' });
    }

    const donationId = req.params.id;

    const [rows] = await pool.execute(
            `SELECT d.*, u.full_name as donor_name, u.location as donor_location, u.mobile_number as donor_phone,
              r.full_name as receiver_name, COALESCE(d.recipient_location, r.location) as receiver_location,
              v.full_name as volunteer_name
             FROM donations d 
             JOIN users u ON d.user_id = u.id 
             LEFT JOIN users r ON d.recipient_id = r.id
             LEFT JOIN users v ON d.volunteer_id = v.id
             WHERE d.id = ?`,
      [donationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Donation not found' });
    }

    res.json({ success: true, donation: rows[0] });
  } catch (error) {
    console.error('Get donation details error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch donation details' });
  }
});

// DELETE /api/donations/:id - Delete a donation (only owner/donor can delete)
app.delete('/api/donations/:id', async (req, res) => {
  try {
    const { verifySession } = require('./auth');
    const token = req.cookies?.session_token || req.headers?.authorization?.replace('Bearer ', '');
    const user = await verifySession(token);

    if (!user) {
      return res.status(401).json({ success: false, message: 'You must be logged in' });
    }

    const donationId = req.params.id;

    // ensure the donation belongs to this user
    const [[existing]] = await pool.execute('SELECT user_id FROM donations WHERE id = ?', [donationId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Donation not found' });
    }
    if (existing.user_id !== user.id) {
      return res.status(403).json({ success: false, message: 'You can only delete your own donations' });
    }

    // perform delete
    await pool.execute('DELETE FROM donations WHERE id = ?', [donationId]);
    res.json({ success: true, message: 'Donation deleted' });
  } catch (error) {
    console.error('Delete donation error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting donation' });
  }
});

// PUT /api/donations/:id/accept - Volunteer accepts a donation (claims it)
app.put('/api/donations/:id/accept', async (req, res) => {
  try {
    const { verifySession } = require('./auth');
    const token = req.cookies?.session_token || req.headers?.authorization?.replace('Bearer ', '');
    const user = await verifySession(token);

    if (!user || user.role !== 'volunteer') {
      return res.status(403).json({ success: false, message: 'Only volunteers can accept donations' });
    }

    const donationId = req.params.id;
    const [[donation]] = await pool.execute('SELECT volunteer_id, status FROM donations WHERE id = ?', [donationId]);
    if (!donation) {
      return res.status(404).json({ success: false, message: 'Donation not found' });
    }
    if (donation.volunteer_id && donation.volunteer_id !== user.id) {
      return res.status(403).json({ success: false, message: 'This donation has already been claimed' });
    }
    if (donation.volunteer_id === user.id) {
      return res.json({ success: true, message: 'Already claimed by you' });
    }

    if (donation.status !== 'requested') {
      return res.status(400).json({ success: false, message: 'Only requested donations can be accepted' });
    }

    await pool.execute('UPDATE donations SET volunteer_id = ?, status = ? WHERE id = ?', [user.id, 'in-transit', donationId]);
    res.json({ success: true, message: 'Donation accepted' });
  } catch (error) {
    console.error('Accept donation error:', error);
    res.status(500).json({ success: false, message: 'Server error accepting donation' });
  }
});

// PUT /api/donations/:id/complete - Mark donation as completed (for volunteers)
app.put('/api/donations/:id/complete', async (req, res) => {
  try {
    const { verifySession } = require('./auth');
    const token = req.cookies?.session_token || req.headers?.authorization?.replace('Bearer ', '');
    const user = await verifySession(token);

    if (!user || user.role !== 'volunteer') {
      return res.status(403).json({ success: false, message: 'Only volunteers can complete deliveries' });
    }

    const donationId = req.params.id;

    // Check if donation exists
    const [check] = await pool.execute('SELECT status FROM donations WHERE id = ?', [donationId]);
    if (check.length === 0) {
      return res.status(404).json({ success: false, message: 'Donation not found' });
    }

    if (check[0].status === 'completed') {
      return res.status(400).json({ success: false, message: 'Donation is already completed' });
    }

    // Update donation status to completed
    await pool.execute(
      'UPDATE donations SET status = ? WHERE id = ?',
      ['completed', donationId]
    );

    res.json({ success: true, message: 'Donation marked as completed' });
  } catch (error) {
    console.error('Complete donation error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete donation' });
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

    // 3. Expect recipient_location in the body and update the donation
    const { recipient_location } = req.body || {};

    if (!recipient_location || recipient_location.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Recipient address is required' });
    }

    await pool.execute(
      'UPDATE donations SET status = ?, recipient_id = ?, recipient_location = ? WHERE id = ?',
      ['requested', user.id, recipient_location, donationId]
    );

    res.json({ success: true, message: 'Donation requested successfully' });

  } catch (error) {
    console.error('Request donation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== SCHEDULED TASK: Auto-delete unrequested donations after 24 hours =====
async function deleteExpiredDonations() {
  try {
    // Get current time minus 24 hours
    const expiryTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Delete donations that are:
    // 1. In 'available' status (not requested by anyone)
    // 2. Created more than 24 hours ago
    const [result] = await pool.execute(
      `DELETE FROM donations 
       WHERE status = 'available' 
       AND created_at < ? 
       AND recipient_id IS NULL`,
      [expiryTime]
    );
    
    if (result.affectedRows > 0) {
      console.log(`[Auto-cleanup] Deleted ${result.affectedRows} expired donation(s)`);
    }
  } catch (error) {
    console.error('[Auto-cleanup] Error deleting expired donations:', error.message);
  }
}

// Run the cleanup job every hour (3600000 milliseconds)
setInterval(deleteExpiredDonations, 60 * 60 * 1000);

// Also run cleanup once on server startup
deleteExpiredDonations();

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`[Auto-cleanup] Scheduled donation cleanup job is running (every 60 minutes)`);
});
// ...existing code...

// Helper function to generate OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/donations/:id/generate-otp - Generate and send OTP to receiver
app.post('/api/donations/:id/generate-otp', async (req, res) => {
  try {
    const { verifySession } = require('./auth');
    const token = req.cookies?.session_token || req.headers?.authorization?.replace('Bearer ', '');
    const user = await verifySession(token);

    if (!user || user.role !== 'volunteer') {
      return res.status(403).json({ success: false, message: 'Only volunteers can generate OTP' });
    }

    const donationId = req.params.id;

    // Get donation details
    const [donation] = await pool.execute(
      'SELECT d.*, r.email as receiver_email, r.full_name as receiver_name FROM donations d LEFT JOIN users r ON d.recipient_id = r.id WHERE d.id = ?',
      [donationId]
    );

    if (!donation || donation.length === 0) {
      return res.status(404).json({ success: false, message: 'Donation not found' });
    }

    const donationData = donation[0];

    // OTP should only be generated once a volunteer has claimed the donation and
    // it is in transit. Previously we restricted this to `requested` status which
    // prevented generation after the volunteer accepted the delivery. Change the
    // check to `in-transit` so that the OTP can be produced when the volunteer
    // clicks **Complete Delivery** on the detail page.
    if (donationData.status !== 'in-transit') {
      return res.status(400).json({
        success: false,
        message: 'OTP can only be generated for in-transit deliveries'
      });
    }

    if (!donationData.recipient_id) {
      return res.status(400).json({ success: false, message: 'No receiver assigned to this donation' });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database
    await pool.execute(
      'INSERT INTO delivery_otp (donation_id, receiver_id, otp_code, expires_at) VALUES (?, ?, ?, ?)',
      [donationId, donationData.recipient_id, otp, expiresAt]
    );

    // TODO: Send OTP via email/SMS (for now, log it)
    await transporter.sendMail({
  from: '"FoodShare Delivery" <raware371322@kkwagh.edu.in>',
  to: donationData.receiver_email,
  subject: 'FoodShare Delivery OTP Verification',
  html: `
    <h2>FoodShare Delivery Verification</h2>
    <p>Hello ${donationData.receiver_name},</p>
    <p>Your OTP for delivery confirmation is:</p>
    <h1 style="letter-spacing:3px;">${otp}</h1>
    <p>This OTP will expire in 10 minutes.</p>
    <p>Please share this code with the volunteer after receiving the food.</p>
  `
});

    // respond success to caller
    res.json({ success: true, message: 'OTP generated and sent to receiver' });

  } catch (error) {
    console.error('Generate OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/donations/:id/verify-otp - Verify OTP and mark delivery as complete
app.post('/api/donations/:id/verify-otp', async (req, res) => {
  try {
    const { verifySession } = require('./auth');
    const token = req.cookies?.session_token || req.headers?.authorization?.replace('Bearer ', '');
    const user = await verifySession(token);

    if (!user || user.role !== 'volunteer') {
      return res.status(403).json({ success: false, message: 'Only volunteers can verify OTP' });
    }

    const donationId = req.params.id;
    const { otp_code } = req.body;

    if (!otp_code || otp_code.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'OTP is required' });
    }

    // Get the latest OTP for this donation
    const [otpRecord] = await pool.execute(
      'SELECT * FROM delivery_otp WHERE donation_id = ? AND is_used = FALSE ORDER BY created_at DESC LIMIT 1',
      [donationId]
    );

    if (!otpRecord || otpRecord.length === 0) {
      return res.status(400).json({ success: false, message: 'No active OTP found for this donation' });
    }

    const otpData = otpRecord[0];

    // Check if OTP has expired
    if (new Date() > new Date(otpData.expires_at)) {
      return res.status(400).json({ success: false, message: 'OTP has expired' });
    }

    // Check if OTP matches
    if (otpData.otp_code !== otp_code.trim()) {
      return res.status(401).json({ success: false, message: 'Invalid OTP' });
    }

    // Mark OTP as used
    await pool.execute('UPDATE delivery_otp SET is_used = TRUE WHERE id = ?', [otpData.id]);

    // Mark donation as completed
    await pool.execute(
      'UPDATE donations SET status = ? WHERE id = ?',
      ['completed', donationId]
    );

    res.json({ success: true, message: 'Delivery completed successfully! OTP verified.' });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ...existing code...