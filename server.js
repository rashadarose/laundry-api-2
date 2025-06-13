const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");

const app = express();
app.use(cors());
app.use(express.json());

// Update with your actual credentials
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "", // replace with your MySQL password
  database: "laundryapp",
  port: 3306, // explicitly set the port
});

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
    res.json({ 
      message: "Sign in successful", 
      user: {
        id: results[0].id,
        name: results[0].name,
        email: results[0].email,
        phone: results[0].phone
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

// app.post("/api/checkout", async (req, res) => {
//   const { amount, currency = "usd", paymentMethodId } = req.body;
//   if (!amount || !paymentMethodId) {
//     return res.status(400).json({ error: "Amount and paymentMethodId are required." });
//   }
//   try {
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount, // amount in cents
//       currency,
//       payment_method: paymentMethodId,
//       confirm: true,
//       return_url: "http://localhost:3000/confirmation", // Add this line
//       automatic_payment_methods: {
//         enabled: true
//       }
//     });
//     res.json({ success: true, message: "Payment successful", paymentIntent });
//   } catch (err) {
//     res.status(400).json({ success: false, error: err.message });
//   }
// });

app.listen(3002, () => {
  console.log("Server running on http://localhost:3002");
});