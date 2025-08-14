const { changeNameData, execute } = require('./adminSkillsCommand');

const data = changeNameData;

async function executeCommand(interaction, client) {
  await execute(interaction, client);
}

module.exports = { data, execute: executeCommand };