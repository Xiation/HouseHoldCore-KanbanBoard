import { describe, it, expect } from 'vitest';
import db from '../src/models/index.js';

const { Chore } = db;
async function createChore({ status = 'todo', daysOld = 0}) {
    const chore = await Chore.create({
        title: 'Test Chore',
        status: status,
        timeEstimate: 'quick'
    });
    const backdated = new Date();
    backdated.setDate(backdated.getDate() - daysOld);
    await Chore.sequelize.query(
        'UPDATE "Chores" SET "lastUpdatedAt" = :backdated WHERE id = :id',
        {
            replacements: { backdated, id: chore.id }
        }
    );
    await chore.reload();
    return chore;
}

describe('Chore staleness', () => {
    it('is stale when old and not done', async () => {
        // makeCHore with daysOld past STALE_AFTER_DAYS, assert isStale() true
        const chore = await createChore({ status: 'todo', daysOld: 10 });
        expect(chore.isStale()).toBe(true);
    });
    it('is not stale when recent', async () => {
        // makeChore with daysOld less than the STALE_AFTER_DAYS, assert isStale() false
        const chore = await createChore({ status: 'todo', daysOld: 2 });
        expect(chore.isStale()).toBe(false);
    });
    it('done chore is never stale', async () => {
        // makeChore with status done, daysOld past the threshold, assert isStale() false,
        // daysStale() === 0
        const chore = await createChore({ status: 'done', daysOld: 10 });
        expect(chore.isStale()).toBe(false);
        expect(chore.daysStale()).toBe(0);
    });
});