const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Firestore } = require('@google-cloud/firestore');

const app = express();
const upload = multer({ dest: 'uploads/' });

let credentialsPath;

if (process.env.GOOGLE_CREDENTIALS_BASE64) {
  // VERCEL: decodifica o base64 e escreve um arquivo temporário
  credentialsPath = path.join('/tmp', 'credentials.json');
  fs.writeFileSync(credentialsPath, Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64'));
} else {
  // Local: usa o arquivo direto
  credentialsPath = path.join(__dirname, 'credentials.json');
}

const firestore = new Firestore({
  projectId: 'busdb-90db1',
  keyFilename: credentialsPath
});


// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rota GET para enviar o index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const contadorDocRef = firestore.collection('counters').doc('rotas');

app.post('/enviar', upload.single('geojson'), async (req, res) => {
  try {
    const { companhia, cor, rota, nrota } = req.body;

    if (!req.file) return res.status(400).send('Arquivo GeoJSON obrigatório');

    const rawData = fs.readFileSync(req.file.path, 'utf8');
    const geojson = JSON.parse(rawData);

    const data = {
      companhia,
      cor,
      rota,
      nrota: parseInt(nrota),
      geojson: JSON.stringify(geojson),
      timestamp: new Date()
    };

    // Cria um novo documento com ID automático
    const docRef = await firestore.collection('rotas').add(data);
    const autoId = docRef.id;

    // Remove o arquivo temporário
    fs.unlinkSync(req.file.path);

    res.send(`
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Sucesso</title>
        <script>
          let segundos = 5;
          function countdown() {
            document.getElementById('timer').innerText = segundos;
            if (segundos > 0) {
              segundos--;
              setTimeout(countdown, 1000);
            } else {
              window.location.href = "/";
            }
          }
          window.onload = countdown;
        </script>
      </head>
      <body>
        <h1>Rota enviada com sucesso!</h1>
        <p>ID automático da rota: ${autoId}</p>
        <p>Redirecionando para o formulário em <span id="timer">5</span> segundos...</p>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao processar a rota.');
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
