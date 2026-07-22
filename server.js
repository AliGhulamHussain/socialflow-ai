require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db/pool');
const contentRoutes = require('./routes/content');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'socialflow-ai-backend', db: 'connected' });
  } catch (err) {
    console.error('DB health check failed:', err.message);
    res.status(500).json({ status: 'ok', service: 'socialflow-ai-backend', db: 'disconnected', error: err.message });
  }
});

app.use('/api/content', contentRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`SocialFlow AI backend running on port ${PORT}`);
});