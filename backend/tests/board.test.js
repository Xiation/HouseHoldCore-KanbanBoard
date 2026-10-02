import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import db from '../src/models/index.js';

const { Chore, HouseholdMember } = db;

describe('GET /api/board', () => {
    it('groups chores into correct buckets', async () => {
        // create one unclaimed, one claimed-todo, one in progress, one done chore
        // GET /api/board, via request(app)
        // assert response.body has all 4 buckets with the right chore in each
        // THIS TEST CASE SHOULD NEED TO BE CHECKED AGAIN LATER
        const unclaimedChore = await Chore.create({
            title: 'Unclaimed Chore',
            timeEstimate: 'quick',
            status: 'todo'
        });

        const member = await HouseholdMember.create({
            name: 'Test Member'
        });

        const claimedChore = await Chore.create({
            title: 'Claimed Chore',
            timeEstimate: 'medium',
            status: 'todo',
            claimedById: member.id
        });

        const inProgressChore = await Chore.create({
            title: 'In Progress Chore',
            timeEstimate: 'big',
            status: 'in_progress',
            claimedById: member.id
        });

        const doneChore = await Chore.create({
            title: 'Done Chore',
            timeEstimate: 'quick',
            status: 'done',
            claimedById: member.id
        });

        const response = await request(app).get('/api/board');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('unclaimed');
        expect(response.body.unclaimed).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ title: 'Unclaimed Chore' })
            ])
        );
        expect(response.body).toHaveProperty('claimedTodo');
        expect(response.body.claimedTodo).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ title: 'Claimed Chore' })
            ])
        );
        expect(response.body).toHaveProperty('inProgress');
        expect(response.body.inProgress).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ title: 'In Progress Chore' })
            ])
        );
        expect(response.body).toHaveProperty('done');
        expect(response.body.done).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ title: 'Done Chore' })
            ])
        );
    })
    
});