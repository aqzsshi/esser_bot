const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const data = {
  name: 'ембед',
  description: 'Отправить embed-сообщение',
  options: [
    {
      name: 'заголовок',
      description: 'Заголовок embed',
      type: 3,
      required: true,
    },
    {
      name: 'описание',
      description: 'Описание embed',
      type: 3,
      required: true,
    },
    {
      name: 'изображение',
      description: 'Ссылка на изображение (опционально)',
      type: 3,
      required: false,
    },
  ],
};

async function execute(interaction, client) {
  const title = interaction.options.getString('заголовок');
  const description = interaction.options.getString('описание');
  const image = interaction.options.getString('изображение');

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor('#333333')
    .setFooter({ text: `Отправил: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

  if (image) embed.setImage(image);

  // Отправляем сообщение напрямую в канал без плашки
  await interaction.channel.send({ embeds: [embed] });
  
  // Отвечаем эфемерно, чтобы скрыть команду
  await interaction.reply({ content: '✅ Embed отправлен!', ephemeral: true });
}

module.exports = { data, execute };