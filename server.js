// Simple optional backend (Node.js + Express) to support project export placeholder
// Run with: node server.js (after npm install)
// Provides endpoint to accept generated site JSON and return a zipped archive (TODO)

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname)));

app.get('/health', (req,res)=> res.json({ ok:true, time: Date.now() }));

// Placeholder: accept { files: { filename: content } }
app.post('/api/zip', async (req,res)=>{
  const { files } = req.body || {};
  if(!files || typeof files !== 'object'){
    return res.status(400).json({ error: 'Invalid payload' });
  }
  // For now just echo - real impl could create an in-memory zip
  res.json({ received: Object.keys(files), message: 'ZIP creation not yet implemented on server. Use client-side download.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Dev assistant backend running on http://localhost:'+PORT));
