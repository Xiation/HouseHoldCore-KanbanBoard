// backend/src/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
   // race condition error and data validation error
   if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
       const errors = err.errors.map((e) => e.message);
       return res.status(400).json({ error: errors.join(', ') });
   }

   // handle other types of errors here if needed
   // default response
   res.status(500).json({
       error: process.env.NODE_ENV === 'development'? err.message : 'Internal Server Error'
   });
}

export default errorHandler;