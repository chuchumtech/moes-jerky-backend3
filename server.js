const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const { Client, Environment } = require("square");

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Models
const Item = mongoose.model("Item", new mongoose.Schema({
  name: String,
  price: Number
}));

const Order = mongoose.model("Order", new mongoose.Schema({
  customer: Object,
  cart: Array,
  amount: Number
}));

// Square client setup
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Sandbox
});

// Routes
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
    const paymentsApi = squareClient.paymentsApi;

    const response = await paymentsApi.createPayment({
      sourceId: token,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: {
        amount: Math.round(amount * 100), // Convert to cents
        currency: "USD"
      },
      locationId: process.env.SQUARE_LOCATION_ID
    });

    const newOrder = new Order({ cart, customer, amount });
    await newOrder.save();

    res.json({ success: true, payment: response.result.payment });
  } catch (error) {
    console.error("Square Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Payment failed"
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
