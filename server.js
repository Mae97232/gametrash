const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // ✅ Stripe
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ CORS
app.use(cors({
  origin: '*', // Pour plus de sécurité, remplace par l'URL de ton site ex: ['https://gamecash.netlify.app']
}));

app.use(express.json());

// ✅ Test API
app.get('/', (req, res) => {
  res.send('✅ API Server is running.');
});

// ✅ Envoi Email
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

// ✅ Stripe : Créer une session de paiement
app.post('/create-checkout-session', async (req, res) => {
  try {
    const items = req.body.items; // [{ nom, prix, quantite }]
    
    const line_items = items.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.nom,
        },
        unit_amount: item.prix * 100, // en centimes
      },
      quantity: item.quantite,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items,
      success_url: 'https://gamecash.netlify.app/success.html',
      cancel_url: 'https://gamecash.netlify.app/panier.html',
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Erreur Stripe:', err);
    res.status(500).json({ error: 'Erreur création session Stripe' });
  }
});

// ✅ Lancer serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
});
