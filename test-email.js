require('dotenv').config();
const nodemailer = require('nodemailer');

// Vérification des variables d'environnement
const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASS;

if (!user || !pass) {
  console.error('❌ Erreur : Veuillez définir GMAIL_USER et GMAIL_APP_PASS dans votre fichier .env');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user, pass }
});

const mailOptions = {
  from: user,
  to: 'yorickspprt@gmail.com',  // ton adresse test
  subject: 'Test Nodemailer avec mot de passe d’application',
  html: '<h1>Test simple</h1><p>Envoyé depuis script Node.js</p>'
};

transporter.sendMail(mailOptions, (err, info) => {
  if (err) {
    console.error('❌ Erreur lors de l\'envoi de l\'email :', err);
    return;
  }
  console.log('✅ Email envoyé avec succès :', info.response);
});
