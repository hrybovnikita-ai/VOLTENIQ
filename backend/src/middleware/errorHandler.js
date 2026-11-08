export function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, req, res, next) {
  const requested = err.status || err.statusCode;
  const status = Number.isInteger(requested) && requested >= 400 && requested <= 599 ? requested : 500;
  let message = 'Internal server error';
  if (status >= 500) {
    console.error('Request failed', { status });
    if (status === 503) message = 'Service temporarily unavailable';
  } else if (err.type) {
    message = err.type === 'entity.parse.failed' ? 'Invalid JSON body' : 'Invalid request body';
  } else {
    message = err.message;
  }
  res.status(status).json({ success: false, message });
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
