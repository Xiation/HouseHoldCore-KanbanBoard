import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import db from '../src/models/index.js';

const { Chore, HouseholdMember } = db;

describe('nudges in GET /api/board', () => {
    it('flags a member with no recent activity', async () => {
        // create a member with a chore backdated
        // past the NUDGE_AFTER_DAYS threshold
        //GET /api/board, assert nudges array includes them
        // CHECK THE TEST
        const member = await HouseholdMember.create({
            name: 'Inactive Member',
        });

        const chore = await Chore.create({
            title: ' Old Chore',
            timeEstimate: 'quick',
            status: 'todo',
            claimedById: member.id
        })

        const backdated = new Date();
        backdated.setDate(backdated.getDate() - 10);
        await Chore.sequelize.query(
        'UPDATE "Chores" SET "lastUpdatedAt" = :backdated WHERE id = :id',
        {
            replacements: { backdated, id: chore.id }
        }
    );

        const response = await request(app).get('/api/board');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('nudges');
        expect(response.body.nudges).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'Inactive Member' })
            ])
        );
    })

    it('does not flag a member with recent activity', async () => {
        // create member with a chore updated just now
        // assert nudges array does NOT include them
        const member = await HouseholdMember.create({
            name: 'Active Member',
        });

        const chore = await Chore.create({
            title: 'Recent Chore',
            timeEstimate: 'quick',
            status: 'todo',
            claimedById: member.id
        });

        const response = await request(app).get('/api/board');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('nudges');
        expect(response.body.nudges).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'Active Member' })
            ])
        );
    })

    it('flags a brand-new member with zero chores ever', async () => {
        // create a member with no chores
        // assert nudges array includes them
        const member = await HouseholdMember.create({
            name: 'New Member',
        });

        const response = await request(app).get('/api/board');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('nudges');
        expect(response.body.nudges).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'New Member' })
            ])
        );
    });
});