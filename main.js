const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');
const path = require('path');
const fs = require('fs');
let shepherd = require('./routes/shepherd');
let app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
  next();
});

app.use(bodyParser.json({ limit: '1mb' })); // support json encoded bodies
app.use(bodyParser.urlencoded({
  limit: '1mb',
  extended: true,
})); // support encoded bodies

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});

// explorer, dex
app.use('/api', shepherd);
app.use('/public', express.static(path.join(__dirname, 'public')));

// web wallet
app.use('/wallet', express.static(path.join(__dirname, 'wallet')));

let options = {};

if (!config.isDev) {
  options = {
    key: fs.readFileSync('certs/priv.pem'),
    cert: fs.readFileSync('certs/cert.pem'),
  };
}

const server = require(config.isDev ? 'http' : 'https')
                .createServer(app, options)
                .listen(config.port, config.isDev ? 'localhost' : config.ip);

console.log(`Komodo Atomic Explorer Server is running at ${config.isDev ? 'localhost' : config.ip}:${config.port}`);

shepherd.getOverview(true);
shepherd.getSummary(true);
shepherd.getRates();
shepherd.getMMCoins();
shepherd.updateStats();
shepherd.getBTCFees();