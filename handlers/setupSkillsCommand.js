const { executeSetup } = require('./skillsHandler');

const data = {
  name: 'настройканавыков',
  description: 'Настроить свои навыки и ник персонажа'
};

async function execute(interaction, client) {
  await executeSetup(interaction, client);
}

module.exports = { data, execute };