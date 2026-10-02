'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Chores', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('todo', 'in_progress', 'done'),
        allowNull: false,
        defaultValue: 'todo'
      },
      recurrenceType: {
        type: Sequelize.ENUM('one_off', 'recurring'),
        allowNull: false,
        defaultValue: 'one_off'
      },
      recurrenceInterval: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      dueDate: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      timeEstimate: {
        type: Sequelize.ENUM('quick', 'medium', 'big'),
        allowNull: false,
      },
      claimedById: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'HouseholdMembers',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      lastUpdatedAt:{
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      lastCompletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Chores');
  }
};