const express = require('express');
const pool = require('../db/pool');
const { generateSocialContent } = require('../services/huggingface');

const router = express.Router();

// POST /api/content/generate
// body: { topic, platforms: ["linkedin", "twitter"], auto_publish: boolean }
// Generates one content piece per requested platform.
// If auto_publish is true, the piece is stored as 'approved' immediately
// (ready for n8n to publish on its next scheduled run).
// If false, it's stored as 'draft', waiting for manual approval.
router.post('/generate', async (req, res) => {
  try {
    const { topic, platforms, auto_publish } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'topic is required' });
    }
    if (!Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({ error: 'platforms must be a non-empty array, e.g. ["linkedin", "twitter"]' });
    }

    const results = [];

    // Generate sequentially rather than in parallel - avoids hitting
    // Hugging Face's free-tier rate limit with simultaneous requests.
    for (const platform of platforms) {
      let bodyText;
      try {
        bodyText = await generateSocialContent(topic, platform);
      } catch (aiErr) {
        console.error(`AI generation failed for ${platform}:`, aiErr.message);
        results.push({ platform, error: aiErr.message });
        continue; // skip inserting this one, but keep processing other platforms
      }

      const status = auto_publish ? 'approved' : 'draft';
      const approvedAt = auto_publish ? new Date() : null;

      const insertResult = await pool.query(
        `INSERT INTO content_pieces (topic, platform, body_text, status, auto_publish, approved_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, platform, body_text, status`,
        [topic, platform, bodyText, status, Boolean(auto_publish), approvedAt]
      );

      results.push(insertResult.rows[0]);
    }

    res.json({ message: 'Content generation complete', results });
  } catch (err) {
    console.error('Generate content error:', err);
    res.status(500).json({ error: 'Failed to generate content' });
  }
});

// GET /api/content?status=draft&platform=linkedin
router.get('/', async (req, res) => {
  try {
    const { status, platform } = req.query;

    const conditions = [];
    const values = [];

    if (status) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }
    if (platform) {
      values.push(platform);
      conditions.push(`platform = $${values.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT id, topic, platform, body_text, status, auto_publish, created_at, approved_at, published_at
       FROM content_pieces
       ${whereClause}
       ORDER BY created_at DESC`,
      values
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Fetch content error:', err);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// PATCH /api/content/:id/approve
router.patch('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const check = await pool.query('SELECT id, status FROM content_pieces WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Content piece not found' });
    }

    await pool.query(
      `UPDATE content_pieces SET status = 'approved', approved_at = NOW() WHERE id = $1`,
      [id]
    );

    res.json({ message: 'Content approved', id });
  } catch (err) {
    console.error('Approve content error:', err);
    res.status(500).json({ error: 'Failed to approve content' });
  }
});

// PATCH /api/content/:id/reject
router.patch('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    const check = await pool.query('SELECT id, status FROM content_pieces WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Content piece not found' });
    }

    await pool.query(`UPDATE content_pieces SET status = 'rejected' WHERE id = $1`, [id]);

    res.json({ message: 'Content rejected', id });
  } catch (err) {
    console.error('Reject content error:', err);
    res.status(500).json({ error: 'Failed to reject content' });
  }
});

module.exports = router;