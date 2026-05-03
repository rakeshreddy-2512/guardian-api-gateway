require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const logger = require('./config/logger');
const redis = require('./config/redis');
const authMiddleware = require('./middleware/auth');
const limiter = require('./middleware/rateLimit');
const cache = require('./middleware/cache');
const { register, metricsMiddleware } = require('./middleware/metrics');

const app = express();
const port = Number(process.env.PORT || 8080);
const upstreamServiceUrl = process.env.UPSTREAM_SERVICE_URL;

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(limiter);
app.use(metricsMiddleware);
app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  })
);

app.get('/health', async (req, res) => {
  const redisStatus = redis.status;
  res.status(200).json({
    status: 'ok',
    redis: redisStatus,
    uptimeSeconds: process.uptime()
  });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.post('/auth/token', (req, res) => {
  const { sub = 'service-client', role = 'consumer' } = req.body || {};
  const token = jwt.sign({ sub, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.status(200).json({ token, tokenType: 'Bearer', expiresIn: 3600 });
});

app.get('/api/posts', authMiddleware, cache(() => 'posts:list'), async (req, res) => {
  try {
    const { data } = await axios.get(`${upstreamServiceUrl}/posts`);
    res.status(200).json({ source: 'upstream', data });
  } catch (error) {
    logger.error('Upstream request failed', { error: error.message });
    res.status(502).json({ error: 'Bad Gateway', message: 'Upstream service unavailable' });
  }
});

app.get('/api/posts/:id', authMiddleware, cache((req) => `posts:${req.params.id}`), async (req, res) => {
  try {
    const { data } = await axios.get(`${upstreamServiceUrl}/posts/${req.params.id}`);
    res.status(200).json({ source: 'upstream', data });
  } catch (error) {
    logger.error('Upstream request failed', { error: error.message, postId: req.params.id });
    res.status(502).json({ error: 'Bad Gateway', message: 'Upstream service unavailable' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(port, () => {
  logger.info(`API Gateway listening on port ${port}`);
});
