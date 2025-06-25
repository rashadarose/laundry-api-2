require('dotenv').config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const nodemailer = require('nodemailer');
//const transporter = nodemailer.createTransport({ /* SMTP config */ });
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const twilio = require('twilio');


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

app.post("/api/users", (req, res) => {
  const { name, phone, email, password_hash } = req.body;
  if (!name || !phone || !email || !password_hash) {
    return res.status(400).json({ error: "All fields are required." });
  }
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

app.post("/api/signin", (req, res) => {
  const { identifier, password_hash } = req.body; // identifier can be name or email
  if (!identifier || !password_hash) {
    return res.status(400).json({ error: "Name or email and password are required." });
  }
  const sql = `
    SELECT * FROM users 
    WHERE (name = ? OR email = ?) AND password_hash = ?
    LIMIT 1
  `;
  db.query(sql, [identifier, identifier, password_hash], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const user = results[0];
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
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method: paymentMethodId,
      confirm: true,
      return_url: "http://localhost:3000/confirmation",
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

app.listen(3002, () => {
  console.log("Server running on http://localhost:3002");
});