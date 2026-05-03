const redis = require('../config/redis');

function cache(keyBuilder, ttlSeconds = Number(process.env.CACHE_TTL_SECONDS || 60)) {
  return async (req, res, next) => {
    const key = keyBuilder(req);

    try {
      const cached = await redis.get(key);
      if (cached) {
        return res.status(200).json({
          source: 'cache',
          data: JSON.parse(cached)
        });
      }

      const originalJson = res.json.bind(res);
      res.json = async (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          await redis.set(key, JSON.stringify(body), 'EX', ttlSeconds);
        }
        return originalJson(body);
      };

      return next();
    } catch (error) {
      return next();
    }
  };
}

module.exports = cache;
