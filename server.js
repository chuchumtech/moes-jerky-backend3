const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const fetch = require("node-fetch");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

// ✅ CORS setup to allow your live frontend
app.use((req, res, next) => {
  const allowedOrigins = ["https://moesjerky.shop", "http://localhost:3000", "https://heartfelt-strudel-c08548.netlify.app", "https://moesjerkytest.netlify.app"];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// ✅ MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// ✅ MongoDB schemas
const Item = mongoose.model("Item", new mongoose.Schema({
  name: String,
  price: Number
}));

const Order = mongoose.model("Order", new mongoose.Schema({
  customer: Object,
  cart: Array,
  amount: Number,
  status: { type: String, default: "Processing" }, // ✅ NEW
  createdAt: { type: Date, default: Date.now }     // ✅ useful for sorting
}));

const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  code: String
}));

app.get("/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

app.post("/users", async (req, res) => {
  const user = new User(req.body);
  await user.save();
  res.json({ success: true });
});

app.put("/users/:id", async (req, res) => {
  const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});

app.delete("/users/:id", async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// ✅ Get all products
app.get("/items", async (req, res) => {
  const items = await Item.find();
  res.json(items);
});

app.post("/items", async (req, res) => {
  try {
    await Item.deleteMany({});
    await Item.insertMany(req.body);
    res.json({ success: true });
  } catch (err) {
    console.error("Error saving items:", err);
    res.status(500).json({ success: false, error: "Failed to save items" });
  }
});

// ✅ Update product
app.put("/items/:id", async (req, res) => {
  const updated = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});

// ✅ Get all orders
app.get("/orders", async (req, res) => {
  const orders = await Order.find();
  res.json(orders);
});

// ✅ Handle payments + save orders
app.post("/payment", async (req, res) => {
  const { token, amount, cart, customer } = req.body;
  if (!token || !amount || !cart || !customer) {
    return res.status(400).json({ success: false, error: "Missing data" });
  }

  try {
    const response = await fetch("https://connect.squareupsandbox.com/v2/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        "Square-Version": "2023-08-16"
      },
      body: JSON.stringify({
        source_id: token,
        idempotency_key: crypto.randomUUID(),
        amount_money: {
          amount: Math.round(amount * 100),
          currency: "USD"
        },
        location_id: process.env.SQUARE_LOCATION_ID
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Square error:", data);
      return res.status(500).json({ success: false, error: data.errors?.[0]?.detail || "Payment failed" });
    }

    const newOrder = new Order({ cart, customer, amount });
    await newOrder.save();

    res.json({ success: true, payment: data.payment });
  } catch (err) {
    console.error("Payment error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
