const express = require('express');
const app = express();
const path = require('path');
const port = 3000;

// Utilise le middleware pour servir les fichiers statiques (comme signup.html)
app.use(express.static(path.join(__dirname, 'public')));

// Route pour afficher la page d'inscription
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'signup.html'));
});

// Route pour traiter l'inscription (à compléter pour ajouter à MongoDB)
app.post('/signup', (req, res) => {
  const { name, email, password } = req.body;
  console.log('Nom:', name);
  console.log('Email:', email);
  console.log('Mot de passe:', password);
  res.send('Inscription réussie !');
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
