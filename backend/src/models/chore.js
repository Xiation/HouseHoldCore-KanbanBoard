// src/models/chore.js
import { Model }  from 'sequelize';

const STALE_AFTER_DAYS = 3;
export default (sequelize, DataTypes) => {
  class Chore extends Model {
    static associate(models) {
      Chore.belongsTo(models.HouseholdMember, {
        as: 'claimedBy',
        foreignKey: 'claimedById'
      });
    }
    daysStale() {
      if (this.status === 'done') return 0;
      return Math.floor((new Date() - new Date(this.lastUpdatedAt)) / (1000 * 60 * 60 * 24));
    }
    isStale() {
      return this.status !== 'done' && this.daysStale() >= STALE_AFTER_DAYS;
    }
  }

  Chore.init({
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('todo', 'in_progress', 'done'),
      allowNull: false,
      defaultValue: 'todo'
    },
    recurrenceType: {
      type: DataTypes.ENUM('one_off', 'recurring'),
      allowNull: false,
      defaultValue: 'one_off'
    },
    recurrenceInterval: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    timeEstimate: {
      type: DataTypes.ENUM('quick', 'medium', 'big'),
      allowNull: false,
    },
    claimedById: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    lastCompletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Chore',
    tableName: 'Chores',
    createdAt: false,
    updatedAt: 'lastUpdatedAt',
    
  });
  return Chore;
};

