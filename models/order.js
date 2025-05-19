const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  clientName: String,
  email: String,
  telephone: String,
  adresse: String,
  items: [{
    description: String,
    quantity: Number,
    price: Number
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
