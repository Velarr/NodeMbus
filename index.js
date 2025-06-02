import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Firestore } from '@google-cloud/firestore';
import open from 'open';
import * as toGeoJSON from '@tmcw/togeojson';
import { DOMParser } from 'xmldom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

const firestore = new Firestore({
  projectId: 'busdb-90db1',
  keyFilename: './credentials.json'
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/enviar', upload.single('geojson'), async (req, res) => {
  try {
    const { companhia, cor, rota, nrota } = req.body;

    if (!req.file) return res.status(400).send('Arquivo obrigatório');

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    let geojson;

    if (ext === '.kml') {
      const kmlData = fs.readFileSync(filePath, 'utf8');
      const dom = new DOMParser().parseFromString(kmlData);
      geojson = toGeoJSON.kml(dom);
    } else if (ext === '.geojson') {
      const rawData = fs.readFileSync(filePath, 'utf8');
      geojson = JSON.parse(rawData);
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).send('Formato de arquivo não suportado. Envie um .kml ou .geojson.');
    }

    const data = {
      companhia,
      cor,
      rota,
      nrota: parseInt(nrota),
      geojson: JSON.stringify(geojson),
      timestamp: new Date()
    };

    const docRef = await firestore.collection('rotas').add(data);
    const autoId = docRef.id;

    fs.unlinkSync(filePath);

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
  open(`http://localhost:${PORT}`);
});
