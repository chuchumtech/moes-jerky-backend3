const express = require('express');
const router = express.Router();

// GET featured product
router.get('/', async (req, res) => {
  const doc = await req.db.collection('config').findOne({ _id: 'featured' });
  if (!doc) return res.json({ productId: null, badgeText: '' });
  res.json({ productId: doc.productId, badgeText: doc.badgeText });
});

// POST featured product
router.post('/', async (req, res) => {
  const { productId, badgeText } = req.body;
  if (!productId) return res.status(400).json({ error: "Missing productId" });
  await req.db.collection('config').updateOne(
    { _id: 'featured' },
    { $set: { productId, badgeText: badgeText || "" } },
    { upsert: true }
  );
  res.json({ productId, badgeText });
});

module.exports = router;
