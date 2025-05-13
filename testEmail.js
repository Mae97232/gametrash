const axios = require('axios');

// Fonction d'envoi d'email via l'API Brevo
const sendEmailWithAPI = async () => {
  const url = 'https://api.brevo.com/v3/smtp/email';  // Endpoint de l'API de Brevo

  // Données de l'email
  const data = {
    sender: { email: 'yorickspprt@gmail.com' }, // Ton adresse email vérifiée
    to: [{ email: 'destinataire@example.com' }], // Adresse email du destinataire
    subject: 'Test Email via Brevo API',  // Sujet du mail
    htmlContent: '<html><body><h1>Ceci est un test</h1></body></html>', // Contenu HTML de l'email
  };

  // Configuration des en-têtes, notamment la clé API de Brevo
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'api-key': 'TA_CLÉ_API',  // Remplace par ta propre clé API Brevo
    },
  };

  try {
    // Envoi de la requête POST à l'API de Brevo
    const response = await axios.post(url, data, config);
    console.log('Email envoyé avec succès:', response.data);
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error.response ? error.response.data : error.message);
  }
};

// Appeler la fonction pour envoyer l'email
sendEmailWithAPI();