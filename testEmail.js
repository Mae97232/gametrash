require('dotenv').config();
const nodemailer = require('nodemailer');

// Affichage des valeurs pour vérification
console.log('✅ GMAIL_USER:', process.env.GMAIL_USER);
console.log('✅ GMAIL_PASS:', process.env.GMAIL_PASS ? '✔️ existe' : '❌ manquant');

// Création du transporteur
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

// Envoi de l'email de test
transporter.sendMail({
  from: process.env.GMAIL_USER,
  to: 'yorickspprt@gmail.com',
  subject: 'Test direct',
  html: '<h1>Test simple</h1><p>Envoyé depuis script Node.js</p>'
}, (err, info) => {
  if (err) {
    return console.error('❌ Erreur lors de l\'envoi de l\'email :', err);
  }
  console.log('✅ Email envoyé avec succès :', info.response);
});
