const { executeChangeName } = require('./skillsHandler');

const data = {
  name: 'навыки_имя_персонажа',
  description: 'Сменить имя персонажа'
};

async function execute(interaction, client) {
  await executeChangeName(interaction, client);
}

module.exports = { data, execute };