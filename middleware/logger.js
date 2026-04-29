export function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(JSON.stringify({
      method: req.method,
      endpoint: req.originalUrl,
      status: res.statusCode,
      response_time_ms: duration
    }));
  });
  
  next();
}