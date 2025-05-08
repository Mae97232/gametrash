const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const Stripe = require('stripe');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // ← Remplacement ici
require('dotenv').config();

// Initialisation
const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const PORT = process.env.PORT || 10000;

// Connexion à MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connecté à MongoDB Atlas'))
  .catch(err => console.error('❌ Erreur de connexion MongoDB :', err));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Modèle utilisateur
const User = require('./models/user');

// Route d'inscription
app.post('/register', async (req, res) => {
  try {
    const existing = await User.findOne({ email: req.body.email });
    if (existing) return res.status(400).json({ error: 'Email déjà utilisé.' });

    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = new User({ ...req.body, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'Utilisateur enregistré avec succès.' });
  } catch (err) {
    console.error('❌ Erreur enregistrement :', err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement.' });
  }
});

// Route de connexion
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  console.log("Tentative de connexion");
  console.log("Email reçu :", email);
  console.log("Mot de passe reçu :", password);

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("Utilisateur non trouvé.");
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Mot de passe incorrect.");
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }

    const { password: _, ...userSansMotDePasse } = user.toObject();
    res.status(200).json(userSansMotDePasse);
  } catch (err) {
    console.error("❌ Erreur lors de la connexion :", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Route page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'panier.html'));
});

// Route d'envoi d'email
app.post('/send-email', async (req, res) => {
  const { to, subject, html } = req.body;

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
    console.error('Erreur d\'envoi détaillée :', error);
    res.status(500).json({ error: `Erreur lors de l'envoi de l'email : ${error.message}` });
  }
});

// Route Stripe
app.post('/create-checkout-session', async (req, res) => {
  const { items } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: items.map(item => ({
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.name,
          },
          unit_amount: item.price,
        },
        quantity: item.quantity,
      })),
      success_url: 'https://mae97232.github.io/gametrash/index.html',
      cancel_url: 'https://mae97232.github.io/gametrash/panier.html',
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Erreur Stripe :', error);
    res.status(500).json({ error: 'Erreur lors de la création de la session de paiement.' });
  }
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});
