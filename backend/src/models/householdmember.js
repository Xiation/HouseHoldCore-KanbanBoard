import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class HouseholdMember extends Model {
    static associate(models) {
      HouseholdMember.hasMany(models.Chore, {
        as: 'claimedChores',
        foreignKey: 'claimedById'
      });
    }
  }
  HouseholdMember.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    }
  }, {
    sequelize,
    modelName: 'HouseholdMember',
    tableName: 'HouseholdMembers',
    timestamps: false
  });
  return HouseholdMember;
}