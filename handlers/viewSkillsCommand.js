const { executeViewSkills } = require('./skillsHandler');

const data = {
  name: 'навыки',
  description: 'Просмотреть навыки пользователя',
  options: [
    {
      name: 'пользователь',
      description: 'Пользователь, чьи навыки нужно посмотреть',
      type: 6, // USER type
      required: true
    }
  ]
};

async function execute(interaction, client) {
  await executeViewSkills(interaction, client);
}

module.exports = { data, execute };