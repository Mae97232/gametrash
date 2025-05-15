const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const Stripe = require('stripe');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const PORT = process.env.PORT || 10000;

// Connexion à MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connecté à MongoDB Atlas'))
  .catch(err => console.error('❌ Erreur de connexion MongoDB :', err));

// Middleware
app.use(cors());
app.use(bodyParser.json());
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

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Email ou mot de passe incorrect." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Email ou mot de passe incorrect." });

    const { password: _, ...userSansMotDePasse } = user.toObject();
    res.status(200).json(userSansMotDePasse);
  } catch (err) {
    console.error("❌ Erreur lors de la connexion :", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'panier.html'));
});

// Envoi d'email manuel (test)
app.post('/send-email', async (req, res) => {
  const { to, subject, html } = req.body;

  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 2525,
    auth: {
      user: process.env.BREVO_USER,
      pass: process.env.BREVO_SMTP_KEY
    },
    logger: true,
    debug: true
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

// Stripe Checkout
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

// Webhook Stripe
app.post('/webhook-stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Erreur de signature Webhook :', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        expand: ['data.price.product']
      });

      const client = session.customer_details;
      const clientName = client.name;
      const clientEmail = client.email;
      const clientPhone = client.phone || 'Non fourni';
      const address = client.address;
      const addressStr = `${address.line1}, ${address.postal_code}, ${address.city}, ${address.country}`;

      let produits = '';
      lineItems.data.forEach(item => {
        produits += `<li>${item.quantity} x ${item.description} (${item.price.unit_amount / 100} EUR)</li>`;
      });

      const emailContent = `
        <h2>Nouvelle commande reçue</h2>
        <p><strong>Nom :</strong> ${clientName}</p>
        <p><strong>Email :</strong> ${clientEmail}</p>
        <p><strong>Téléphone :</strong> ${clientPhone}</p>
        <p><strong>Adresse de livraison :</strong> ${addressStr}</p>
        <p><strong>Produits commandés :</strong></p>
        <ul>${produits}</ul>
      `;

      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 2525,
        auth: {
          user: process.env.BREVO_USER,
          pass: process.env.BREVO_SMTP_KEY
        },
        logger: true,
        debug: true
      });

      // Email à toi
      await transporter.sendMail({
        from: process.env.BREVO_USER,
        to: "yorickspprt@gmail.com",
        subject: "Nouvelle commande client",
        html: emailContent
      });

      // Email au fournisseur
      await transporter.sendMail({
        from: process.env.BREVO_USER,
        to: "service@qbuytech.com",
        subject: "Commande à expédier",
        html: emailContent
      });

      console.log("✅ Emails envoyés après commande");
    } catch (err) {
      console.error("❌ Erreur envoi email après paiement :", err);
    }
  }

  res.json({ received: true });
});
app.get('/test-email', async (req, res) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 2525,
    auth: {
      user: process.env.BREVO_USER,
      pass: process.env.BREVO_SMTP_KEY
    },
    logger: true,
    debug: true
  });

  try {
    await transporter.sendMail({
      from: process.env.BREVO_USER,
      to: "yorickspprt@gmail.com",
      subject: "✅ Test Brevo via Nodemailer",
      html: "<p>Ceci est un test envoyé via Nodemailer + Brevo 🚀</p>"
    });

    res.send("✅ Email de test envoyé !");
  } catch (err) {
    console.error("❌ Erreur envoi test :", err);
    res.status(500).send(`Erreur : ${err.message}`);
  }
});

// Lancer le serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});