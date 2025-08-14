const { executeMenu } = require('./skillsHandler');

const data = {
  name: 'меню_навыков',
  description: 'Главное меню системы навыков'
};

async function execute(interaction, client) {
  await executeMenu(interaction, client);
}

module.exports = { data, execute };