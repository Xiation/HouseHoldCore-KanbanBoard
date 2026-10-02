import { Router } from 'express';
import boardRouter from './board.js';
import choresRouter from './chores.js';
import membersRouter from './members.js';
const router = Router();

router.get('/', (req, res) => res.json({ status: 'ok' }));
router.use('/board', boardRouter);
router.use('/chores', choresRouter);
router.use('/members', membersRouter);
export default router;
