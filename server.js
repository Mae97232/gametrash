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

// ⚠️ CORRECTIF pour ne pas parser le corps du webhook Stripe
app.use((req, res, next) => {
  if (req.originalUrl === '/webhook-stripe') {
    next(); // ne pas parser ce endpoint
  } else {
    bodyParser.json()(req, res, next);
  }
});

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Modèle utilisateur
const User = require('./models/user');

// [TES ROUTES REGISTER / LOGIN ... inchangées]

// Route pour créer une session de paiement Stripe
app.post('/create-checkout-session', async (req, res) => {
  const { items } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: items.map(item => ({
        price_data: {
          currency: 'eur',
          product_data: { name: item.name },
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

// ✅ Webhook Stripe — DOIT être au-dessus de `bodyParser.json()`
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
        host: "smtp-relay.brevo.com",
        port: 587,
        auth: {
          user: process.env.BREVO_USER,
          pass: process.env.BREVO_PASS
        }
      });

      await transporter.sendMail({
        from: process.env.BREVO_USER,
        to: "yorickspprt@gmail.com",
        subject: "Nouvelle commande client",
        html: emailContent
      });

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

// Lancer le serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});