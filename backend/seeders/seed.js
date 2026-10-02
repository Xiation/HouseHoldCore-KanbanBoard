import db from '../src/models/index.js';
const { sequelize, HouseholdMember, Chore } = db;


if (process.env.NODE_ENV === 'production') {
        console.log('Seeding is not allowed in production environment.');
        process.exit(1);
    }
const daysFromNow = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
 }; 

const seed = async () => {
    const [alice] = await HouseholdMember.findOrCreate({
        where: { name: 'Alice'}
    });
    const [bob] = await HouseholdMember.findOrCreate({
        where: { name: 'Bob'}
    });
    const [charlie] = await HouseholdMember.findOrCreate({
        where: { name: 'Charlie'}
    });

    // const householdMembers = [alice, bob, charlie];

   await Chore.findOrCreate({
    where: { title: 'Wash dishes' },
    defaults: {
      status: 'todo',
      recurrenceType: 'recurring',
      recurrenceInterval: 1,
      dueDate: daysFromNow(0),
      timeEstimate: 'quick',
      claimedById: null,
    },
  });

  await Chore.findOrCreate({
    where: { title: 'Take out trash' },
    defaults: {
      status: 'todo',
      recurrenceType: 'recurring',
      recurrenceInterval: 7,
      dueDate: daysFromNow(2),
      timeEstimate: 'quick',
      claimedById: alice.id,
    },
  });

  await Chore.findOrCreate({
    where: { title: 'Vacuum living room' },
    defaults: {
      status: 'in_progress',
      recurrenceType: 'recurring',
      recurrenceInterval: 7,
      dueDate: daysFromNow(0),
      timeEstimate: 'medium',
      claimedById: bob.id,
    },
  });

  const [cleanBathroom] = await Chore.findOrCreate({
    where: { title: 'Clean bathroom' },
    defaults: {
      status: 'todo',
      recurrenceType: 'one_off',
      recurrenceInterval: null,
      dueDate: daysFromNow(-4),
      timeEstimate: 'medium',
      claimedById: null,
    },
  });

  // lastUpdatedAt is auto-managed by Sequelize, so a normal save would just
  // reset it back to "now" — bypass the model layer with a raw UPDATE instead.
  await sequelize.query(
    'UPDATE "Chores" SET "lastUpdatedAt" = :backdated WHERE id = :id',
    { replacements: { backdated: daysFromNow(-5), id: cleanBathroom.id } }
  );

  await Chore.findOrCreate({
    where: { title: 'Deep clean fridge' },
    defaults: {
      status: 'done',
      recurrenceType: 'one_off',
      recurrenceInterval: null,
      dueDate: daysFromNow(-1),
      timeEstimate: 'big',
      claimedById: charlie.id,
      lastCompletedAt: new Date(),
    },
  });

  console.log('Database seeded successfully.');
};


seed().catch((err) => {
    console.error('Seeding failed:', err);
}).finally(() => {
    sequelize.close();
});