import { app } from './app.js';
import { sequelize } from './config/db.js';

const PORT = process.env.PORT || 3000;

process.on('beforeExit', (code) => {
  console.log('>>> beforeExit event with code: ', code);
})

sequelize.authenticate()
  .then(() => {
    app.listen(PORT, () => console.log(`Listening on ${PORT}`));
    setInterval(() => {}, 1 << 30)
})

  .catch((err) => { console.error('DB connection failed:', err); process.exit(1); });

