require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

transporter.sendMail({
  from: process.env.GMAIL_USER,
  to: 'yorickspprt@gmail.com',
  subject: 'Test direct',
  html: '<h1>Test simple</h1><p>Envoyé depuis script Node.js</p>'
}, (err, info) => {
  if (err) {
    return console.error('❌ Erreur:', err);
  }
  console.log('✅ Email envoyé:', info.response);
});