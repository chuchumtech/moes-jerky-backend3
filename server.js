const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const fetch = require("node-fetch");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
app.use(cors({
  origin: "https://moesjerky.shop"
}));
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

const Item = mongoose.model("Item", new mongoose.Schema({
  name: String,
  price: Number
}));

const Order = mongoose.model("Order", new mongoose.Schema({
  customer: Object,
  cart: Array,
  amount: Number
}));

app.get("/items", async (req, res) => {
  const items = await Item.find();
  res.json(items);
});

app.put("/items/:id", async (req, res) => {
  const updated = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});

app.get("/orders", async (req, res) => {
  const orders = await Order.find();
  res.json(orders);
});

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
