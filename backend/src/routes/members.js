import { Router } from 'express';
import db from '../models/index.js';

const { HouseholdMember } = db;

const router = Router();

router.get('/', async (req, res) => {
    const members = await HouseholdMember.findAll();
    res.json(members);
})

export default router;