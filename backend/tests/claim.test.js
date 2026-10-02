import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import db from '../src/models/index.js';

const { Chore, HouseholdMember } = db;

describe('POST /api/chores/:id/claim', () => {
    it('claims an unclaimed chore, sets status in_progress', async () => {
        // create unclaimed chore + member, POST claim
        // assert claimedById + status updated
        const chore = await Chore.create({
            title: 'Unclaimed Chore',
            timeEstimate: 'quick',
            status: 'todo'
        })
        const member = await HouseholdMember.create({
            name: 'Test Member'
        })

        const response = await request(app)
            .post(`/api/chores/${chore.id}/claim`)
            .send({ memberId: member.id });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', chore.id);
        expect(response.body).toHaveProperty('claimedById', member.id);
        expect(response.body).toHaveProperty('status', 'in_progress');
    })

    it('rejects claiming an already-claimed chore with 404', async () => {
        // create already-claimed chore;
        // try claiming with a diferent member, assert 404
        const member1 = await HouseholdMember.create({
            name: 'Member 1'
        });
        const member2 = await HouseholdMember.create({
            name: 'Member 2'
        });

        const chore = await Chore.create({
            title: 'Claimed Chore',
            timeEstimate: 'quick',
            status: 'in_progress',
            claimedById: member1.id
        });

        const response = await request(app)
            .post(`/api/chores/${chore.id}/claim`)
            .send({ memberId: member2.id });

        expect(response.status).toBe(404);
    });
});