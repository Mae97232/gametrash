require('dotenv').config();
const nodemailer = require('nodemailer');

async function testSendEmail() {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 2525,
      auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_PASS,
      },
      secure: false, // STARTTLS sera utilisé sur ce port
      logger: true,
      debug: true,
    });

    const info = await transporter.sendMail({
      from: process.env.BREVO_USER,
      to: 'yorickspprt@gmail.com', // Mets ton email ici pour recevoir le test
      subject: 'Test Nodemailer + Brevo',
      html: '<h1>Test email envoyé avec Nodemailer et Brevo SMTP 🚀</h1>',
    });

    console.log('Email envoyé ! ID:', info.messageId);
  } catch (error) {
    console.error('Erreur lors de l\'envoi du mail:', error);
  }
}

testSendEmail();