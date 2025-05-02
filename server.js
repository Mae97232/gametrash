const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const Stripe = require('stripe');
const path = require('path'); // ✅ Garde uniquement celle-ci
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'panier.html'));
});


// ✅ Envoi d'email
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
    console.error('Erreur d\'envoi :', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email.' });
  }
});

// ✅ Stripe Checkout
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
          unit_amount: item.price * 100,
        },
        quantity: item.quantity,
      })),
      success_url: 'https://mae97232.github.io/gametrash/success.html',
      cancel_url: 'https://mae97232.github.io/gametrash/cancel.html',
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Erreur Stripe :', error);
    res.status(500).json({ error: 'Erreur lors de la création de la session de paiement.' });
  }
});

// ✅ Lancer le serveur
app.listen(4242, () => {
  console.log("Serveur démarré sur http://localhost:4242");
});
