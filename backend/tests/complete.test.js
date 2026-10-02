import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import db from '../src/models/index.js';

const { Chore, HouseholdMember } = db;

describe('POST /api/chores/:id/complete', () => {
    it('one_off chore becomes done, dueDate unchanged, lastCompletedAt set', async () => {
        // create one_off chore, POST complete
        // assert status === done, dueDate unchanged, lastCompletedt set
        const chore = await Chore.create({
            title: 'One-off Chore',
            timeEstimate: 'quick',
            status: 'todo',
            recurrenceType: 'one_off'
        })
        const response = await request(app)
            .post(`/api/chores/${chore.id}/complete`)
            .send({});
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'done');
        expect(response.body).toHaveProperty('dueDate', chore.dueDate);
        expect(response.body).toHaveProperty('lastCompletedAt');
    })

    it('recurring chore resets to todo, clears claimedById, advances dueDate', async () => {
        // create recurring chore, POST complete
        // assert status === todo, claimedById === null + dueDate advanced by interval
        const member = await HouseholdMember.create({
            name: 'Test Member'
        });
        
        const chore = await Chore.create({
            title: 'Recurring Chore',
            timeEstimate: 'quick',
            status: 'in_progress',
            recurrenceType: 'recurring',
            recurrenceInterval: 7,
            dueDate: new Date(),
            claimedById: member.id
        })
        const response = await request(app)
            .post(`/api/chores/${chore.id}/complete`)
            .send({});
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'todo');
        expect(response.body).toHaveProperty('claimedById', null);
        const expectedDueDate = new Date(chore.dueDate);
        expectedDueDate.setDate(expectedDueDate.getDate() + chore.recurrenceInterval);
        expect(new Date(response.body.dueDate)).toEqual(expectedDueDate);
    })
})