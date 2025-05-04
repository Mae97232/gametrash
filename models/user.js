const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nom: String,
  prénom: String,
  email: { type: String, unique: true },
  password: String,
  telephone: String,
  adresse: String,
  ville: String,
  codePostal: String,
  naissance: Date
});

module.exports = mongoose.model('User', userSchema);
