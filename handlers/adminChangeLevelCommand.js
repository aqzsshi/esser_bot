const { changeLevelData, execute } = require('./adminSkillsCommand');

const data = changeLevelData;

async function executeCommand(interaction, client) {
  await execute(interaction, client);
}

module.exports = { data, execute: executeCommand };