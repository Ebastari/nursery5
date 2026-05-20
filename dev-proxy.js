// Simple Express proxy for Google Apps Script CORS bypass
// Jalankan: node dev-proxy.js

import express from 'express';
import fetch from 'node-fetch';
const app = express();
const PORT = 3001;

// URL Apps Script yang benar dari api.ts
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzaDhpB0PQK2P1IgvglL7pw_1hDgVRzrF6rOiyuNvyrRsi6mp8fMsJCBk5Dj58IMWE/exec';

app.use(express.json());

app.post('/api/submit', async (req, res) => {
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const text = await response.text();
    res.set('Access-Control-Allow-Origin', '*');
    res.status(response.status).send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/proxy', async (req, res) => {
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const text = await response.text();
    res.set('Access-Control-Allow-Origin', '*');
    res.status(response.status).send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}`);
});