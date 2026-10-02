import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

export const sequelize = new Sequelize(url, {
    dialect: 'postgres',
    logging: false,
});