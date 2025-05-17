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
const PORT = process.env.PORT || 4242;

// Connexion MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connecté à MongoDB Atlas'))
  .catch(err => console.error('❌ Erreur MongoDB :', err));

// Webhook Stripe AVANT bodyParser.json
app.post('/webhook-stripe', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log('✔️ Webhook reçu :', event.type);
  } catch (err) {
    console.error('❌ Signature invalide :', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        expand: ['data.price.product']
      });

      // ✅ Récupérer les infos depuis les metadata
      const clientName = session.metadata.nom || "Nom non fourni";
      const adressePostale = session.metadata.adresse || "Adresse non fournie";
      const telephone = session.metadata.tel || "Téléphone non fourni";
      const email = session.metadata.email || "Email non fourni";

      const emailContent = `
        <h2>Nouvelle commande reçue</h2>
        <p><strong>Nom :</strong> ${clientName}</p>
        <p><strong>Email :</strong> ${email}</p>
        <p><strong>Téléphone :</strong> ${telephone}</p>
        <p><strong>Adresse :</strong> ${adressePostale}</p>
        <ul>
          ${lineItems.data.map(item =>
            `<li>${item.quantity} x ${item.description} (${item.price.unit_amount / 100} €)</li>`
          ).join('')}
        </ul>
      `;

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASS
        }
      });

      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: email,
        subject: "Merci pour votre commande",
        html: emailContent
      });

      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: "maelyck97232@gmail.com",
        subject: "Nouvelle commande client",
        html: emailContent
      });

      console.log('✅ Emails envoyés');
    } catch (err) {
      console.error('❌ Erreur traitement commande :', err);
    }
  }

  res.json({ received: true });
});

// Middleware après le webhook
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// User model
const User = require('./models/user');

// Inscription
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

// Connexion
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
    console.error("❌ Erreur connexion :", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Envoi manuel d'email
app.post('/send-email', async (req, res) => {
  const { to, subject, html } = req.body;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASS
    }
  });

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject,
      html
    });
    res.status(200).json({ message: 'Email envoyé.' });
  } catch (error) {
    console.error('Erreur envoi email :', error);
    res.status(500).json({ error: `Erreur lors de l'envoi de l'email : ${error.message}` });
  }
});

// Stripe checkout session
app.post('/create-checkout-session', async (req, res) => {
  const { items, client } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: items.map(item => ({
        price_data: {
          currency: 'eur',
          product_data: { name: item.name },
          unit_amount: item.price
        },
        quantity: item.quantity
      })),
      success_url: 'https://mae97232.github.io/gametrash/index.html',
      cancel_url: 'https://mae97232.github.io/gametrash/panier.html',
      shipping_address_collection: { allowed_countries: ['FR'] },
      phone_number_collection: { enabled: true },
      metadata: {
        nom: client.nom,
        email: client.email,
        tel: client.tel,
        adresse: `${client.adresse}, ${client.codePostal}, ${client.ville}`
      }
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('❌ Erreur Stripe session :', error);
    res.status(500).json({ error: 'Erreur Stripe' });
  }
});

// Accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'panier.html'));
});

// Démarrage du serveur
app.listen(4242, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:4242`);
});