const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(cors());
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
  const isValid = token && amount > 0;
  if (!isValid) return res.status(400).json({ success: false, error: "Invalid payment" });

  const newOrder = new Order({ cart, customer, amount });
  await newOrder.save();

  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));