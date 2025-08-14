const { EmbedBuilder } = require('discord.js');
const os = require('os');
const { images } = require('../config.json');

const data = {
  name: 'статус',
  description: 'Показать статус бота',
};

async function execute(interaction, client) {
  const totalMemMB = (os.totalmem() / 1024 / 1024).toFixed(2);
  const freeMemMB = (os.freemem() / 1024 / 1024).toFixed(2);
  const usedMemMB = (totalMemMB - freeMemMB).toFixed(2);
  const memoryUsage = ((usedMemMB / totalMemMB) * 100).toFixed(2);

  const cpuLoad = (os.loadavg()[0] * 100 / os.cpus().length).toFixed(2); 
  const botUptime = formatUptime(process.uptime());
  const ping = Math.round(client.ws.ping);

  const statusEmbed = new EmbedBuilder()
    .setTitle('Статус бота <:logolight:1366047161451544626> ')
    .setColor('#1D1D1E')
    .addFields(
      { name: '<:ping_emoji:1366068173127942146> Пинг бота:', value: `\`${ping} мс\``, inline: true },
      { name: '<a:network_emoji:1366067102938566750> Аптайм бота:', value: `\`${botUptime}\``, inline: true },
      { name: '<a:cpu_emoji:1366067507823120404> Процессор:', value: `\`${cpuLoad}%\``, inline: true },
      { name: '<:memory_emoji:1366067724052336680> Память:', value: `\`${usedMemMB}MB / ${totalMemMB}MB (${memoryUsage}%)\``, inline: true },
    )
    .setImage(images.statusCommandGif)
    .setFooter({ text: `Статус проверен: ${new Date().toLocaleString('ru-RU')}` });

  await interaction.reply({ embeds: [statusEmbed] });
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}д ${h}ч ${m}м ${s}с`;
}

module.exports = { data, execute };