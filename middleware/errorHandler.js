const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = {};

  // Mongoose ValidationError
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const fieldErrors = {};
    for (const field of Object.keys(err.errors)) {
      fieldErrors[field] = err.errors[field].message;
    }
    message = 'Validation failed';
    details.fields = fieldErrors;
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value for "${field}". This ${field} already exists.`;
    details.field = field;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please authenticate again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token has expired. Please authenticate again.';
  }

  // Build response
  const response = {
    error: message,
    ...details,
  };

  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
