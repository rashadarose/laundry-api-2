require('dotenv').config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const nodemailer = require('nodemailer'); // Replace AWS
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const saltRounds = 10;
const session = require('express-session');

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your email service
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_PASS  // Your app password
  }
});

// Replace SNS functions with Nodemailer
const sendEmail = async (to, subject, text) => {
  try {
    console.log(`📧 Sending email to: ${to}`);
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      text: text
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('❌ Email send failed:', error);
    throw error;
  }
};

const app = express();

// Update CORS to allow credentials
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://foldngo.us',
    'http://foldngo.us',
    'https://18.119.73.76',
    'http://18.119.73.76'
  ],
  credentials: true // Allow cookies to be sent
}));

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'yourStrongSecret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Add session debugging middleware (temporary)
app.use((req, res, next) => {
  console.log('=== SESSION DEBUG ===');
  console.log('Session ID:', req.sessionID);
  console.log('User ID in session:', req.session?.userId);
  console.log('User name in session:', req.session?.user?.name);
  console.log('====================');
  next();
});

// Update with your actual credentials
// if (process.env.NODE_ENV !== 'development-skip-db') {
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "", // replace with your MySQL password
  database: process.env.DB_NAME || "laundryapp",
  port: process.env.DB_PORT || 3306, // explicitly set the port
});

function requireAdminJWT(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.admin) throw new Error();
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireUserSession(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please sign in to access this resource' });
  }
  next();
}

//  db.connect(err => {
//     if (err) throw err;
//     console.log('Connected to DB');
//   });
// } else {
//   console.log('Skipping DB connection in development-skip-db mode');
// }

app.get("/api/users", (req, res) => {
  db.query("SELECT * FROM users", (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

app.post("/api/users", async (req, res) => {
  const { name, phone, email, password } = req.body;
  if (!name || !phone || !email || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }
  const password_hash = await bcrypt.hash(password, saltRounds);
  const sql = "INSERT INTO users (name, phone, email, password_hash) VALUES (?, ?, ?, ?)";
  db.query(sql, [name, phone, email, password_hash], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    // Send a success message back to the UI
    res.status(201).json({ 
      message: "User registered successfully", 
      userId: result.insertId,
      success: true
    });
  });
});

app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(results[0]);
  });
});

// GET /api/pricing - Get all active pricing tiers
app.get("/api/pricing", (req, res) => {
  db.query(
    "SELECT service_type, display_name, description, price, is_featured, is_active FROM pricing_tiers WHERE is_active = TRUE ORDER BY price ASC",
    (err, results) => {
      if (err) return res.status(500).json({ error: err });
      res.json(results);
    }
  );
});

// GET /api/pricing/:serviceType - Get specific pricing tier
app.get("/api/pricing/:serviceType", (req, res) => {
  db.query(
    "SELECT * FROM pricing_tiers WHERE service_type = ? AND is_active = TRUE",
    [req.params.serviceType],
    (err, results) => {
      if (err) return res.status(500).json({ error: err });
      if (results.length === 0) {
        return res.status(404).json({ error: 'Pricing tier not found' });
      }
      res.json(results[0]);
    }
  );
});

app.post("/api/signin", (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: "Name or email and password are required." });
  }
  const sql = `
    SELECT * FROM users 
    WHERE (name = ? OR email = ?)
    LIMIT 1
  `;
  db.query(sql, [identifier, identifier], async (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) {
      return res.status(401).json({ error: "Invalid credentials." });
    }
    const user = results[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials." });
    }
    
    // Create session
    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone
    };

    console.log('🔥 SESSION CREATED:');
    console.log('Session ID:', req.sessionID);
    console.log('User stored:', req.session.user);

    const isFirstVisit = !user.has_visited;

    // Update has_visited to true if it's the first visit
    if (isFirstVisit) {
      db.query(
        "UPDATE users SET has_visited = TRUE WHERE id = ?",
        [user.id]
      );
    }

    res.json({
      message: "Sign in successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isFirstVisit
      },
      success: true
    });
  });
});

// Check session status
app.get('/api/auth/session', (req, res) => {
  console.log('🔍 SESSION CHECK:', req.session?.user?.name || 'No user');
  
  if (req.session && req.session.user) {
    res.json({
      success: true,
      user: {
        id: req.session.user.id,
        name: req.session.user.name,
        email: req.session.user.email,
        phone: req.session.user.phone
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'No active session'
    });
  }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  console.log('🚪 LOGOUT REQUEST for:', req.session?.user?.name || 'Unknown user');
  
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Could not log out' });
    }
    res.clearCookie('connect.sid'); // Clear the session cookie
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Test session endpoint
app.get('/api/test-session', (req, res) => {
  console.log('🧪 SESSION TEST:');
  console.log('Session exists:', !!req.session);
  console.log('User ID:', req.session?.userId);
  console.log('User name:', req.session?.user?.name);
  
  if (req.session?.userId) {
    res.json({ 
      message: '✅ Session working!', 
      user: req.session.user,
      sessionId: req.sessionID
    });
  } else {
    res.json({ message: '❌ No session found' });
  }
});

// Get user orders
app.get('/api/user/orders', requireUserSession, (req, res) => {
  const userId = req.session.userId;
  
  const query = `
    SELECT 
      po.*,
      pt.display_name as pricing_display_name
    FROM pickup_orders po
    LEFT JOIN pricing_tiers pt ON po.pricing_tier = pt.service_type
    WHERE po.user_id = ?
    ORDER BY po.created_at DESC
  `;
  
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ success: true, orders: results });
  });
});

// Update user profile
app.put('/api/user/profile', requireUserSession, (req, res) => {
  const userId = req.session.userId;
  const { name, email, phone } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  
  const sql = "UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?";
  db.query(sql, [name, email, phone, userId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    
    // Update session data
    req.session.user = { ...req.session.user, name, email, phone };
    
    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      user: req.session.user
    });
  });
});

app.delete("/api/users/:id", (req, res) => {
  const userId = req.params.id;
  const sql = "DELETE FROM users WHERE id = ?";
  db.query(sql, [userId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({ message: "User deleted successfully", success: true });
  });
});

app.put("/api/users/:id", (req, res) => {
  const userId = req.params.id;
  const { name, phone, email, password_hash } = req.body;
  if (!name || !phone || !email || !password_hash) {
    return res.status(400).json({ error: "All fields are required." });
  }
  const sql = "UPDATE users SET name = ?, phone = ?, email = ?, password_hash = ? WHERE id = ?";
  db.query(sql, [name, phone, email, password_hash, userId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({ message: "User updated successfully", success: true });
  });
});

app.post("/api/pickups", (req, res) => {
  const { 
    user_id, 
    name, 
    address, 
    pickup_date, 
    pickup_time, 
    load_amount, 
    dropoff_time, 
    pricing_tier = 'self_wash',
    weight_lbs = 10,
    notes 
  } = req.body;
  
  if (!user_id || !name || !address || !pickup_date || !pickup_time || !load_amount || !dropoff_time) {
    return res.status(400).json({ error: "Required fields are missing." });
  }

  // Get pricing information
  db.query(
    "SELECT price FROM pricing_tiers WHERE service_type = ? AND is_active = TRUE",
    [pricing_tier],
    (pricingErr, pricingResults) => {
      if (pricingErr) return res.status(500).json({ error: pricingErr });
      if (pricingResults.length === 0) {
        return res.status(400).json({ error: 'Invalid pricing tier' });
      }

      const unit_price = pricingResults[0].price;
      const total_price = (unit_price * weight_lbs / 10).toFixed(2); // Price per 10lb bag
      const confirm_number = generateComNumber();

      const sql = `
        INSERT INTO pickup_orders 
        (user_id, name, address, pickup_date, pickup_time, load_amount, dropoff_time, 
         pricing_tier, unit_price, weight_lbs, price, confirm_number, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(
        sql,
        [user_id, name, address, pickup_date, pickup_time, load_amount, dropoff_time, 
         pricing_tier, unit_price, weight_lbs, total_price, confirm_number, notes || null],
        (err, result) => {
          if (err) {
            console.error('SQL Error:', err);
            return res.status(500).json({ error: err.message });
          }
          res.status(201).json({
            message: "Pickup order created successfully",
            pickupId: result.insertId,
            confirm_number,
            total_price: parseFloat(total_price),
            pricing_tier,
            unit_price,
            success: true
          });
        }
      );
    }
  );
});

app.post("/api/checkout", async (req, res) => {
  const { amount, currency = "usd", paymentMethodId, phone } = req.body;
  if (!amount || !paymentMethodId) {
    return res.status(400).json({ error: "Amount and paymentMethodId are required." });
  }
  try {
    const API_URL = process.env.REACT_APP_API_URL;
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method: paymentMethodId,
      confirm: true,
      return_url: `${API_URL}/confirmation`,
      automatic_payment_methods: { enabled: true }
    });

    // Send email notification
    try {
      await sendEmail(
        'riseaboveamg@gmail.com',
        'FoldNGo - Payment Notification',
        `New payment received! Amount: $${(amount/100).toFixed(2)}\nPayment ID: ${paymentIntent.id}`
      );
      console.log('✅ Payment notification email sent');
    } catch (emailErr) {
      console.error('❌ Email Error:', emailErr);
    }

    // Log what SMS would have been
    console.log(`📱 [SMS DISABLED] Would send to ${phone}: Payment successful! Thank you for your order.`);

    res.json({ success: true, message: "Payment successful. Email confirmation sent." });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/admin', (req, res) => {
  // const { admin_secret } = req.query;
  // if (admin_secret !== process.env.ADMIN_SECRET) {
  //   return res.status(403).send('Forbidden');
  // }
  // You can render a page, or just send data for now
  db.query('SELECT * FROM pickup_orders', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

// Admin sign-in
app.post("/api/admin/signin", (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    // Create JWT token
    const token = jwt.sign(
      { admin: true, username },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
  //    db.query('SELECT * FROM pickup_orders', (err, results) => {
  //   if (err) return res.status(500).json({ error: err });
  //   res.json(results);
  // });

    return res.json({ success: true, token });
  }
  res.status(401).json({ error: "Invalid admin credentials" });
});

// Get order status
app.get('/api/orders/:id/status', async (req, res) => {
  const [rows] = await db.query('SELECT status FROM pickup_orders WHERE id = ?', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
  res.json({ status: rows[0].status });
});

// Update order status
app.put('/api/orders/:id/status', requireAdminJWT, async (req, res) => {
  const { status } = req.body;
  const validStatuses = [
    'received', 'washing', 'completed', 'delivered'
  ];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  // Get user info for notification
  db.query(
    'SELECT u.phone, u.email, u.name FROM pickup_orders p JOIN users u ON p.user_id = u.id WHERE p.id = ?',
    [req.params.id],
    async (err, results) => {
      if (err) return res.status(500).json({ error: err });
      if (results.length === 0) return res.status(404).json({ error: 'Order or user not found' });

      const { phone, email, name } = results[0];

      // Update status
      db.query('UPDATE pickup_orders SET status = ? WHERE id = ?', [status, req.params.id], async (err2) => {
        if (err2) return res.status(500).json({ error: err2 });

        const message = `Hi ${name}! Your laundry order #${req.params.id} status is now: ${status.toUpperCase()}`;
        const subject = 'FoldNGo - Order Status Update';

        console.log(`📧 Sending notification for order ${req.params.id}`);

        // Send Email notification
        if (email) {
          try {
            await sendEmail(email, subject, message);
            console.log('✅ Email notification sent successfully');
          } catch (emailErr) {
            console.error('❌ Email Error:', emailErr);
          }
        }

        // Log what SMS would have been (for reference)
        console.log(`📱 [SMS DISABLED] Would send to ${phone}: ${message}`);

        res.json({ success: true, message: 'Order status updated and email notification sent.' });
      });
    }
  );
});

app.get('/api/admin/orders', requireAdminJWT, (req, res) => {
  const query = `
    SELECT 
      po.*,
      pt.display_name as pricing_display_name,
      pt.profit,
      pt.margin,
      u.name as user_name,
      u.email as user_email,
      u.phone as user_phone
    FROM pickup_orders po
    JOIN pricing_tiers pt ON po.pricing_tier = pt.service_type
    LEFT JOIN users u ON po.user_id = u.id
    ORDER BY po.created_at DESC
  `;
  
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

// Analytics - Pricing performance
app.get('/api/admin/analytics/pricing', requireAdminJWT, (req, res) => {
  const query = `
    SELECT 
      pt.service_type,
      pt.display_name,
      pt.price,
      pt.base_cost,
      pt.profit,
      pt.margin,
      COUNT(po.id) as total_orders,
      SUM(po.price) as total_revenue,
      SUM(po.price * pt.margin) as total_profit,
      AVG(po.weight_lbs) as avg_weight
    FROM pricing_tiers pt
    LEFT JOIN pickup_orders po ON po.pricing_tier = pt.service_type
    WHERE pt.is_active = TRUE
    GROUP BY pt.service_type
    ORDER BY total_orders DESC
  `;
  
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

// Analytics - Revenue breakdown by date and pricing tier
app.get('/api/admin/analytics/revenue', requireAdminJWT, (req, res) => {
  const { startDate, endDate } = req.query;
  
  let query = `
    SELECT 
      DATE(po.created_at) as order_date,
      po.pricing_tier,
      pt.display_name,
      COUNT(po.id) as orders_count,
      SUM(po.price) as daily_revenue,
      SUM(po.price * pt.margin) as daily_profit,
      AVG(po.weight_lbs) as avg_weight
    FROM pickup_orders po
    JOIN pricing_tiers pt ON po.pricing_tier = pt.service_type
    WHERE 1=1
  `;
  
  const params = [];
  
  if (startDate) {
    query += ` AND DATE(po.created_at) >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    query += ` AND DATE(po.created_at) <= ?`;
    params.push(endDate);
  }
  
  query += ` GROUP BY DATE(po.created_at), po.pricing_tier ORDER BY order_date DESC, daily_revenue DESC`;
  
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

function generateComNumber() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

app.get('/api/test-aws', async (req, res) => {
  try {
    // Test AWS credentials
    const topics = await sns.listTopics().promise();
    console.log('🔍 Available SNS Topics:', topics.Topics);
    
    res.json({ 
      success: true, 
      message: 'AWS SNS connected successfully',
      topics: topics.Topics,
      region: process.env.AWS_REGION
    });
  } catch (error) {
    console.error('❌ AWS Connection Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      code: error.code
    });
  }
});

app.get('/api/test-email', async (req, res) => {
  try {
    const result = await sendEmail(
      'riseaboveamg@gmail.com',
      'FoldNGo - Test Email',
      'This is a test email from your laundry app!'
    );
    
    res.json({ 
      success: true, 
      message: 'Test email sent successfully',
      messageId: result.messageId
    });
  } catch (error) {
    console.error('❌ Email Test Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

app.listen(3002, () => {
  console.log("Server running on http://localhost:3002");
});