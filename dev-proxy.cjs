// Proxy server for local development (CommonJS)
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = 3001; // Port proxy
const APPSCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzaDhpB0PQK2P1IgvglL7pw_1hDgVRzrF6rOiyuNvyrRsi6mp8fMsJCBk5Dj58IMWE/exec';

app.use(cors());
app.use(express.json());

// Proxy POST ke Apps Script
app.post('/api/proxy', async (req, res) => {
  try {
    const response = await fetch(APPSCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(req.body),
    });
    const data = await response.text();
    res.status(response.status).send(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy GET ke Apps Script (untuk fetchApiData, getUsers, dll)
app.get('/api/data', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const url = qs ? `${APPSCRIPT_URL}?${qs}` : APPSCRIPT_URL;
    const response = await fetch(url, { redirect: 'follow' });
    const data = await response.text();
    res.status(response.status).send(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
