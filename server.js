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

// Route Stripe pour créer la session de paiement
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

// Webhook Stripe pour gérer les événements de paiement
app.post('/webhook-stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; // Votre secret webhook Stripe

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log('Erreur de signature :', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Gérer l'événement 'checkout.session.completed'
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Informations sur le client
    const clientName = session.customer_details.name;
    const clientEmail = session.customer_details.email;
    const clientPhone = session.customer_details.phone;
    const clientAddress = session.customer_details.address;

    // Récupérer les articles de la commande
    const orderItems = session.line_items.data;
    let orderDetails = '';
    orderItems.forEach(item => {
      orderDetails += `${item.quantity} x ${item.description}\n`;
    });

    // Créer le contenu de l'email pour l'administrateur
    const adminMailOptions = {
      from: process.env.BREVO_USER, // Votre email d'expéditeur
      to: 'yorickspprt@gmail.com',  // L'email de l'administrateur
      subject: 'Nouvelle commande reçue',
      text: `Nouvelle commande reçue :

Nom du client : ${clientName}
Email : ${clientEmail}
Téléphone : ${clientPhone}
Adresse : ${clientAddress}
Détails de la commande :
${orderDetails}`
    };

    // Créer le contenu de l'email pour le fournisseur
    const supplierMailOptions = {
      from: process.env.BREVO_USER, // Votre email d'expéditeur
      to: 'service@qbuytech.com',  // L'email du fournisseur
      subject: 'Commande à préparer',
      text: `Nouvelle commande à expédier :

Nom du client : ${clientName}
Téléphone : ${clientPhone}
Adresse : ${clientAddress}
Détails de la commande :
${orderDetails}`
    };

    // Envoyer l'email à l'administrateur
    nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_PASS
      }
    }).sendMail(adminMailOptions, (err, info) => {
      if (err) {
        console.log('Erreur en envoyant l\'email à l\'admin :', err);
      } else {
        console.log('Email envoyé à l\'admin :', info.response);
      }
    });

    // Envoyer l'email au fournisseur
    nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_PASS
      }
    }).sendMail(supplierMailOptions, (err, info) => {
      if (err) {
        console.log('Erreur en envoyant l\'email au fournisseur :', err);
      } else {
        console.log('Email envoyé au fournisseur :', info.response);
      }
    });
  }

  // Répondre à Stripe pour dire que le webhook a été reçu avec succès
  res.status(200).send('Webhook reçu');
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});

const bodyParser = require('body-parser'); // Ajoute ça en haut si pas encore présent

// Stripe nécessite le "raw body" pour valider la signature du webhook
app.post('/webhook-stripe', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Erreur de vérification du webhook :', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ Événement reçu et vérifié
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Affiche les infos de la commande dans la console pour test
    console.log('✅ Paiement réussi :');
    console.log('Nom du client :', session.customer_details.name);
    console.log('Email :', session.customer_details.email);
    console.log('Téléphone :', session.customer_details.phone);
    console.log('Adresse :', session.customer_details.address);
    console.log('Produits commandés :', session.display_items || session.line_items);

    // Tu peux ici envoyer les emails avec nodemailer si tu veux
  }

  res.status(200).send('✅ Webhook reçu avec succès');
});