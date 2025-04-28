const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config(); // Pour utiliser .env

const PORT = process.env.PORT || 10000;

// Autoriser ton site Netlify
app.use(cors({
  origin: ['https://gamecash.netlify.app'] // remplace ici par ton vrai domaine Netlify
}));

// Middleware pour lire le JSON
app.use(express.json());

// Test API
app.get('/', (req, res) => {
  res.send('✅ API Server is running.');
});

// Route d'envoi d'email
app.post('/send-email', async (req, res) => {
  const { to, subject, html } = req.body;

  const nodemailer = require('nodemailer');

  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    auth: {
      user: process.env.BREVO_USER,
      pass: process.env.BREVO_PASS
    }
  });

  try {
    await transporter.sendMail({
      from: process.env.BREVO_USER,
      to,
      subject,
      html
    });
    res.status(200).json({ message: 'Email envoyé avec succès.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email.' });
  }
});

// Lancer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
});
