import { Router } from 'express';
import { z } from 'zod';
import db from '../models/index.js';

const { Chore, HouseholdMember } = db;
const router = Router();

const claimSchema = z.object({
    memberId: z.number().int().positive(),
});

router.post('/:choreId/claim', async (req, res) => {
    const id = parseInt(req.params.choreId, 10);
    if (isNaN(id)) 
        return res.status(400).json({ error: 'Invalid chore ID'});
    const parseResult = claimSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors.map(e => e.message).join(', ') });
    }
    const { memberId } = parseResult.data;
    if (!await HouseholdMember.findByPk(memberId)) {
        return res.status(404).json({ error: 'Household member not found' });
    }
    const chore = await Chore.findOne({
        where: { id, claimedById: null }
    });
    if (!chore) {
        return res.status(404).json({ error: 'Chore already claimed' });
    }
    chore.claimedById = memberId;
    chore.status = 'in_progress';
    await chore.save();
    res.json(chore);
})

router.post('/:choreId/complete', async (req, res) => {
    const id = parseInt(req.params.choreId, 10);
    if (isNaN(id)) 
        return res.status(400).json({ error: 'Invalid chore ID'});
    const chore = await Chore.findByPk(id);
    if (!chore) {
        return res.status(404).json({ error: 'Chore not found' });
    }
    // branch on chore.recurrenceType
    // one off -> status = done, lastCompletedAt = now
    // recurring -> status = todo, claimedById = null, advance dueDate by recurrenceInterval, 
    // from the existing dueDate - same pattern as the delayed reset of recurring chores in boardService.js

    if (chore.recurrenceType === 'recurring') {
        chore.status = 'todo';
        chore.claimedById = null;
        const newDueDate = new Date(chore.dueDate);
        newDueDate.setDate(newDueDate.getDate() + chore.recurrenceInterval);
        chore.dueDate = newDueDate;
    } else {
        chore.status = 'done';
    }
    chore.lastCompletedAt = new Date();
    await chore.save();
    res.json(chore);
})

export default router;