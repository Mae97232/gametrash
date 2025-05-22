const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const Stripe = require('stripe');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
require('dotenv').config();
console.log("🔑 STRIPE_SECRET_KEY =", process.env.STRIPE_SECRET_KEY?.slice(0,10) + "...");


const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
console.log("➡️ Mode Stripe :", process.env.STRIPE_SECRET_KEY.includes('sk_live') ? 'LIVE ✅' : 'TEST ❌');
const PORT = process.env.PORT || 4242;

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connecté à MongoDB Atlas'))
  .catch(err => console.error('❌ Erreur de connexion MongoDB :', err));

const Order = require('./models/order');

// ✅ PriceMap corrigé avec les bons noms depuis Stripe
const priceMap = {
  "gameboy r36s rouge": "price_1RREZoEL9cznbBHRbrCeYpXR",
  "gameboy r36s noir": "price_1RREcyEL9cznbBHRXZiSdGCE",
  "gameboy r36s orange": "price_1RREOuEL9cznbBHRrlyihpV4",
  "gameboy r36s violet": "price_1RREWjEL9cznbBHRICFULwO5",
};

app.post('/webhook-stripe', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log('✔️ Signature vérifiée :', event.type);
  } catch (err) {
    console.error('❌ Erreur de vérification de signature Webhook :', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        expand: ['data.price.product']
      });

      const details = session.customer_details || {};
      const clientName = details.name || "Nom non fourni";
      const email = details.email || "Email non fourni";
      const telephone = details.phone || "Téléphone non fourni";
      const adressePostale = details.address
        ? `${details.address.line1}, ${details.address.postal_code}, ${details.address.city}`
        : "Adresse non fournie";

      const emailContent = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #4CAF50;">🎮 Nouvelle commande GameTrash</h2>
          <p><strong>Nom :</strong> ${clientName}</p>
          <p><strong>Email :</strong> ${email}</p>
          <p><strong>Téléphone :</strong> ${telephone}</p>
          <p><strong>Adresse :</strong> ${adressePostale}</p>
          <h3>Détails de la commande :</h3>
          <ul>
            ${lineItems.data.map(item => `
              <li>${item.quantity} × <strong>${item.description}</strong> — ${(item.price.unit_amount / 100).toFixed(2)} €</li>
            `).join('')}
          </ul>
          <p style="margin-top: 20px;">Merci pour votre commande !</p>
        </div>
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
        to: ["yorickspprt@gmail.com", "yorick-972@outlook.com"],
        subject: "Nouvelle commande client",
        html: emailContent
      });

      await Order.create({
        clientName,
        email,
        telephone,
        adresse: adressePostale,
        items: lineItems.data.map(item => ({
          description: item.description,
          quantity: item.quantity,
          price: item.price.unit_amount / 100
        }))
      });

      console.log('✅ Emails envoyés & commande enregistrée');
    } catch (err) {
      console.error('❌ Erreur lors du traitement de la commande :', err);
    }
  } else {
    console.log(`ℹ️ Événement ignoré : ${event.type}`);
  }

  res.json({ received: true });
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const User = require('./models/user');

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
    res.status(200).json({ message: 'Email envoyé avec succès.' });
  } catch (error) {
    console.error('Erreur d\'envoi :', error);
    res.status(500).json({ error: `Erreur lors de l'envoi de l'email : ${error.message}` });
  }
});

app.post("/create-checkout-session", async (req, res) => {
  console.log("📥 Nouvelle requête POST /create-checkout-session reçue");
  console.log("🧾 Données reçues :", JSON.stringify(req.body, null, 2));

  try {
    const { items, client } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      console.error("❌ Erreur : 'items' manquant ou vide");
      return res.status(400).json({ error: "'items' est requis et ne peut pas être vide." });
    }

    if (!client || !client.email) {
      console.error("❌ Erreur : 'client.email' est requis");
      return res.status(400).json({ error: "'client.email' est requis." });
    }

    const lineItems = items.map((item, index) => {
      const nomProduit = item.nom?.trim().toLowerCase(); // 🔽 important
      const priceId = priceMap[nomProduit];

      console.log(`🔍 Article [${index}]:`, item);
      console.log(`🧩 Produit reçu : "${nomProduit}" — ID Stripe : ${priceId}`);

      if (!priceId) {
        console.error(`❌ Produit inconnu : "${nomProduit}"`);
        console.error("📦 Liste des produits connus :", Object.keys(priceMap));
        throw new Error(`Produit inconnu : "${nomProduit}"`);
      }

      return {
        price: priceId,
        quantity: item.quantite,
      };
    });

    console.log("✅ line_items préparés :", lineItems);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      success_url: 'https://mae97232.github.io/gametrash/index.html?payment=success',
      cancel_url: 'https://mae97232.github.io/gametrash/panier.html',
      customer_email: client.email,
      shipping_address_collection: {
        allowed_countries: ['FR']
      },
      billing_address_collection: 'required',
      phone_number_collection: {
        enabled: true
      }
    });

    console.log("✅ Session Stripe créée avec succès :", session.id);
    res.json({ id: session.id });

  } catch (error) {
    console.error("❌ Erreur dans /create-checkout-session :", error.message);
    res.status(500).json({ error: "Erreur : la session Stripe n'a pas pu être créée." });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'panier.html'));
});

// Démarrage serveur
app.listen(4242, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:4242`);
})