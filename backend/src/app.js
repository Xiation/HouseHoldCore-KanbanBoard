import express from 'express';
import cors from 'cors';
import apiRouter from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';

export const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);
app.use(errorHandler);