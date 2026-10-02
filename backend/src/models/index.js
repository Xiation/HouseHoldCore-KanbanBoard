// src/models/index.js
import fs from 'fs';
import path from 'path';
import Sequelize from 'sequelize';
import { fileURLToPath, pathToFileURL} from 'url';
import { sequelize } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basename = path.basename(__filename);

const db = {};

// dynamically load all model in the models directory
const modelFiles = fs.readdirSync(__dirname)
    .filter(file => {
        return (file.indexOf('.') !== 0) && 
        (file !== basename) && 
        (file.slice(-3) === '.js');
    })

for (const file of modelFiles) {
    const modelPath = path.join(__dirname, file);
    const { default: modelDefiner } = await import(pathToFileURL(modelPath).href);
    const model = modelDefiner(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
}

// setup associations
Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export { sequelize, Sequelize };
export default db;
