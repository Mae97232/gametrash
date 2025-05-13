require('dotenv').config();
const nodemailer = require('nodemailer');

// Transporteur SMTP Brevo
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_PASS
  }
});

// Contenu du mail
const mailOptions = {
  from: process.env.BREVO_USER,
  to: "ton.email@gmail.com", // Remplace par ton adresse à toi
  subject: "✅ Test SMTP Brevo",
  html: "<h2>Super !</h2><p>Ton envoi d'email fonctionne bien depuis Node.js ✉️</p>"
};

// Envoi du mail
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error("❌ Erreur :", error.message);
  } else {
    console.log("✅ Email envoyé :", info.response);
  }
});
