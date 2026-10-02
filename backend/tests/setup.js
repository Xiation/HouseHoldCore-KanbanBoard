import { sequelize } from '../src/models/index.js';
import { beforeAll, afterAll } from 'vitest';

beforeAll(async () => {
    await sequelize.sync({ force: true });
});

afterAll(async () => {
    await sequelize.close();
})