const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const fetch = require("node-fetch");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

// --- Delivery Date Schema ---
const DeliveryDateSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true } // Store as ISO string
});
const DeliveryDate = mongoose.model('DeliveryDate', DeliveryDateSchema);

// --- CORS setup to allow your live frontend ---
app.use((req, res, next) => {
  const allowedOrigins = [
    "https://moesjerky.shop",
    "http://localhost:3000",
    "https://heartfelt-strudel-c08548.netlify.app",
    "https://moesjerkytest.netlify.app"
  ];
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

// --- MongoDB connection ---
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// --- MongoDB schemas ---
const Item = mongoose.model("Item", new mongoose.Schema({
  name: String,
  price: Number
}));

const Order = mongoose.model("Order", new mongoose.Schema({
  customer: Object,
  cart: Array,
  amount: Number,
  status: { type: String, default: "Processing" },
  createdAt: { type: Date, default: Date.now },
  orderNumber: { type: Number, unique: true, index: true },
  deliveryDate: { type: String, required: true } // <-- Added field
}));

const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  code: String
}));

// --- User endpoints ---
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

// --- Product endpoints ---
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

app.put("/items/:id", async (req, res) => {
  const updated = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});

// --- Orders endpoints ---
app.get("/orders", async (req, res) => {
  const orders = await Order.find();
  res.json(orders);
});

app.get("/order/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/orders/:id", async (req, res) => {
  try {
    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Order not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update order" });
  }
});

// --- Payment & Order creation (with deliveryDate) ---
app.post("/payment", async (req, res) => {
  const { token, amount, cart, customer, deliveryDate } = req.body;
  if (!token || !amount || !cart || !customer || !deliveryDate) {
    return res.status(400).json({ success: false, error: "Missing data" });
  }

  try {
    // Square payment logic
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

    // --- Sequential Order Number Logic ---
    let lastOrder = await Order.findOne().sort({ orderNumber: -1 }).exec();
    let nextOrderNumber = lastOrder && lastOrder.orderNumber ? lastOrder.orderNumber + 1 : 1001;

    const newOrder = new Order({ cart, customer, amount, orderNumber: nextOrderNumber, deliveryDate });
    await newOrder.save();

    res.json({ success: true, payment: data.payment, orderNumber: nextOrderNumber });
  } catch (err) {
    console.error("Payment error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// --- Delivery Dates API ---
app.get('/delivery-dates', async (req, res) => {
  try {
    const dates = await DeliveryDate.find().sort({ date: 1 });
    res.json(dates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dates' });
  }
});

app.post('/delivery-dates', async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'Date required' });
    const exists = await DeliveryDate.findOne({ date });
    if (exists) return res.status(400).json({ error: 'Date already exists' });
    const newDate = new DeliveryDate({ date });
    await newDate.save();
    res.json(newDate);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add date' });
  }
});

app.delete('/delivery-dates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await DeliveryDate.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete date' });
  }
});

// GET featured product
app.get('/featured-product', async (req, res) => {
  const doc = await db.collection('config').findOne({ _id: 'featured' });
  if (!doc) return res.json({ productId: null, badgeText: '' });
  res.json({ productId: doc.productId, badgeText: doc.badgeText });
});

// POST featured product
app.post('/featured-product', async (req, res) => {
  const { productId, badgeText } = req.body;
  if (!productId) return res.status(400).json({ error: "Missing productId" });
  await db.collection('config').updateOne(
    { _id: 'featured' },
    { $set: { productId, badgeText: badgeText || "" } },
    { upsert: true }
  );
  res.json({ productId, badgeText });
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
