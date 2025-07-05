require('dotenv').config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const nodemailer = require('nodemailer');
//const transporter = nodemailer.createTransport({ /* SMTP config */ });
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const twilio = require('twilio');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const saltRounds = 10;

const app = express();
app.use(cors());
app.use(express.json());

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
  const { user_id, name, address, pickupDate, pickupTime, loadAmount, dropoffTime, price } = req.body;
  if (!user_id || !name || !address || !pickupDate || !pickupTime || !loadAmount || !dropoffTime || !price) {
    return res.status(400).json({ error: "All fields are required." });
  }
  const sql = `
    INSERT INTO pickup_orders (user_id, name, address, pickup_date, pickup_time, load_amount, dropoff_time, price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.query(
    sql,
    [user_id, name, address, pickupDate, pickupTime, loadAmount, dropoffTime, price],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });
      res.status(201).json({
        message: "Pickup order created successfully",
        pickupId: result.insertId,
        success: true
      });
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

    // Send SMS notification with Twilio
    if (phone) {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: 'Payment successful! Thank you for your order.',
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });
      console.log('SMS notification sent to', phone);
    }

    const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,      // your Outlook email
    pass: process.env.EMAIL_PASS,      // your app password
  },
});

const mailOptions = {
  from: process.env.EMAIL_USER, // replace with your Outlook email
  to: 'riseaboveamg@gmail.com',
  subject: 'Test Email from Nodemailer',
  text: 'Hello! This is a test email sent using Nodemailer and Outlook 365.',
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    return console.error('Error sending email:', error);
  }
  console.log('Email sent successfully:', info.response);
});





    res.json({ success: true, message: "Payment successful", paymentIntent });
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
app.put('/api/orders/:id/status', async (req, res) => {
  const { status } = req.body;
  const validStatuses = [
    'received', 'washing', 'washed', 'folding', 'folded', 'ready_for_delivery', 'delivered'
  ];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  // Get user info for notification
  db.query(
    'SELECT u.phone, u.email FROM pickup_orders p JOIN users u ON p.user_id = u.id WHERE p.id = ?',
    [req.params.id],
    async (err, results) => {
      if (err) return res.status(500).json({ error: err });
      if (results.length === 0) return res.status(404).json({ error: 'Order or user not found' });

      const { phone, email } = results[0];

      // Update status
      db.query('UPDATE pickup_orders SET status = ? WHERE id = ?', [status, req.params.id], async (err2) => {
        if (err2) return res.status(500).json({ error: err2 });

        // --- Twilio SMS ---
        if (phone) {
          const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          try {
            await client.messages.create({
              body: `Your laundry order status is now: ${status}`,
              from: process.env.TWILIO_PHONE_NUMBER,
              to: phone
            });
            console.log('SMS notification sent to', phone);
          } catch (smsErr) {
            console.error('Error sending SMS:', smsErr);
          }
        }

        // --- Nodemailer Email ---
        if (email) {
          const nodemailer = require('nodemailer');
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
            },
          });

          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Laundry Order Status Update',
            text: `Hello! Your laundry order status is now: ${status}`,
          };

          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              return console.error('Error sending email:', error);
            }
            console.log('Email sent successfully:', info.response);
          });
        }

        res.json({ success: true, message: 'Order status updated and notifications sent.' });
      });
    }
  );
});

app.get('/api/admin/orders', requireAdminJWT, (req, res) => {
  db.query('SELECT * FROM pickup_orders', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

app.listen(3002, () => {
  console.log("Server running on http://localhost:3002");
});