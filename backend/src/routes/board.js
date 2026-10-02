import { Router } from 'express';
import { getBoardData } from '../services/boardService.js';

const router = Router();

router.get('/', async (req, res) => {
   const boardData = await getBoardData();
   res.json(boardData);
});

export default router;