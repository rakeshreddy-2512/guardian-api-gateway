const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 2,
  enableReadyCheck: true
});

redis.on('connect', () => {
  console.log('[redis] connected');
});

redis.on('error', (error) => {
  console.error('[redis] error', error.message);
});

module.exports = redis;
