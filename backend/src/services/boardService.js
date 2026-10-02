import db from '../models/index.js';

const { Chore, HouseholdMember } = db;

const NUDGE_AFTER_DAYS = 5;

async function resetDoneRecurringChoresFromPreviousCycle() {
    // Find all recurring chores that are overdue and not done
    // for each if lastCompletedAt < today's calendar date
    // reset status/claimedById/dueDate, save
    // if same, dont reset, if different, reset it
    const today = new Date();
    const recurrigChores = await Chore.findAll({
        where: {
            recurrenceType: 'recurring',
            status: 'done',
        }
    })
    for (const chore of recurrigChores) {
        const completedDateString = new Date(chore.lastCompletedAt).toDateString();
        const todayDateString = today.toDateString();
        // compare the two dates, if chore.lastCompletedAt !== today, reset it
        if (completedDateString !== todayDateString) {
            const newDueDate = new Date(chore.dueDate);
            newDueDate.setDate(newDueDate.getDate() + chore.recurrenceInterval);
            chore.status = 'todo';
            chore.claimedById = null;
            chore.dueDate = newDueDate;
            await chore.save();

        }
    }
    
}

async function getGroupedChores() {
    // query all chores (include claimedBy), return the 4 buckets
    // { unclaimed, claimedTodo, inProgress, done }
    // const allChores = await Chore.findAll({ include: [{ model: HouseholdMember, as: 'claimedBy' }] });
    const rawChores = await Chore.findAll({
        include: [{ model: HouseholdMember, as: 'claimedBy' }],
    })
    const allChores = rawChores.map((chore) => ({
        ...chore.toJSON(),
        isStale: chore.isStale(),
        daysStale: chore.daysStale(),
    }));
    const unclaimed = allChores.filter((chore) => !chore.claimedById && chore.status === 'todo');
    const claimedTodo = allChores.filter((chore) => chore.claimedById && chore.status === 'todo');
    const inProgress = allChores.filter((chore) => chore.claimedById && chore.status === 'in_progress');
    const done = allChores.filter((chore) => chore.claimedById && chore.status === 'done');

    return {
        unclaimed, claimedTodo, inProgress, done
    };
}

async function computeNudges(members, allChores) {
    // for stale chores, nudge user who claimed it
    // for each member, find most recent activity across 'chores'
    // (chores where claimedById = member.id - use lastUpdatedAt)
    // flag if none found, or more than NUDGE_AFTER_DAYS since last activity
    // return array of { memberId, name, daysSinceLastActivity, }
    const nudges = [];
    const today = new Date();
    for (const member of members) {
        const memberChores = allChores.filter((chore) => chore.claimedById === member.id);
        if (memberChores.length === 0) {
            nudges.push({
                    memberId: member.id,
                    name: member.name,
                    daysSinceLastActivity: null
                });
        } else {
            const mostRecentChore = memberChores.reduce((accumulator, current) => {
                if (new Date(current.lastUpdatedAt) > new Date(accumulator.lastUpdatedAt)) {
                    return current;
                    // current = the most recent chore
                } else {
                    return accumulator;
                    // accumulator = the previous most recent chore
                } // current.lastUpdatedAt > accumulator.lastUpdatedAt ? current : accumulator
            }, memberChores[0]);
            // the output above would be the most recent chore, we need to calculate daysSinceLastActivity

            const daysSinceLastActivity = Math.floor((today - new Date(mostRecentChore.lastUpdatedAt)) / (1000 * 60 * 60 * 24));
            if (daysSinceLastActivity > NUDGE_AFTER_DAYS) {
                nudges.push({
                    memberId: member.id,
                    name: member.name,
                    daysSinceLastActivity
                });
            }
            
        }
    }
    return nudges;
}

export async function getBoardData() {
    await resetDoneRecurringChoresFromPreviousCycle();
    const buckets = await getGroupedChores();
    const members = await HouseholdMember.findAll();
    // const allChores = await Chore.findAll({ include: [{ model: HouseholdMember, as: 'claimedBy' }] });
    const allChores = [...buckets.unclaimed, ...buckets.claimedTodo, ...buckets.inProgress, ...buckets.done];
    const nudges = await computeNudges(members, allChores);
    // return { buckets, members, allChores, nudges };

    // ...buckets unpacks the 4 buckets into the returned object, 
    // so we don't have to do buckets.unclaimed, etc. in the frontend
    return { ...buckets, members, nudges};
}