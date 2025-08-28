const { EmbedBuilder } = require('discord.js');
const os = require('os');
const ms = require('ms');
const { images } = require('../config.json');

// ===== Embed Command =====
const embedData = {
  name: 'ембед',
  description: 'Отправить embed-сообщение',
  options: [
    { name: 'заголовок', description: 'Заголовок embed', type: 3, required: true },
    { name: 'описание', description: 'Описание embed', type: 3, required: true },
    { name: 'изображение', description: 'Ссылка на изображение (опционально)', type: 3, required: false },
  ],
};

async function executeEmbed(interaction, client) {
  const title = interaction.options.getString('заголовок');
  const description = interaction.options.getString('описание');
  const image = interaction.options.getString('изображение');

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor('#333333')
    .setFooter({ text: `Отправил: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

  if (image) embed.setImage(image);

  await interaction.channel.send({ embeds: [embed] });
  await interaction.reply({ content: '✅ Embed отправлен!', ephemeral: true });
}

// ===== Status Command =====
const statusData = {
  name: 'статус',
  description: 'Показать статус бота',
};

async function executeStatus(interaction, client) {
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

// ===== Spam Command =====
const activeSpams = new Map();
const { hasAdminOrOwner } = require('./permissionUtils');

const spamData = {
  name: 'спам',
  description: 'Автоматически продвигать чат вниз (только для админов)',
  options: [
    { name: 'время', description: 'Время спама (например: 10s, 2m, 1h)', type: 3, required: false },
    { name: 'стоп', description: 'Остановить спам', type: 5, required: false },
  ],
};

function hasAdminRole(member) {
  return hasAdminOrOwner(member);
}

async function executeSpam(interaction, client) {
  if (!hasAdminRole(interaction.member)) {
    return interaction.reply({ content: '❌ У вас нет прав для выполнения этой команды.', flags: 64 });
  }

  const timeArg = interaction.options.getString('время');
  const stop = interaction.options.getBoolean('стоп');
  const channel = interaction.channel;

  if (stop) {
    const spam = activeSpams.get(channel.id);
    if (spam) {
      clearInterval(spam.interval);
      activeSpams.delete(channel.id);
      return interaction.reply('🛑 Спам остановлен вручную.');
    } else {
      return interaction.reply('ℹ️ В этом канале нет активного спама.');
    }
  }

  if (!timeArg) {
    return interaction.reply('❌ Использование: `/спам время:<время>` или `/спам стоп:true`');
  }

  const duration = ms(timeArg);
  if (!duration || duration < 1000) {
    return interaction.reply('⏱ Укажи корректное время (например: 10s, 2m, 1h).');
  }

  console.log(`[ADMIN] ${interaction.user.tag} запустил спам в канале #${channel.name} на ${ms(duration, { long: true })}`);

  if (activeSpams.has(channel.id)) {
    return interaction.reply('⚠️ В этом канале уже идёт спам. Остановите его командой `/спам стоп:true`.');
  }

  await interaction.reply(`✅ Спам начат на ${ms(duration, { long: true })}`);

  const interval = setInterval(() => {
    const embed = new EmbedBuilder()
      .setColor('#1D1D1E')
      .setDescription('⬇️ *Продвигаем чат вниз...*')
      .setFooter({ text: 'Автоматический спам', iconURL: client.user.displayAvatarURL() });
    channel.send({ embeds: [embed] });
  }, 1000);

  activeSpams.set(channel.id, { interval });

  setTimeout(() => {
    clearInterval(interval);
    activeSpams.delete(channel.id);
    channel.send('🛑 Спам завершён.');
  }, duration);
}

module.exports = {
  commands: [
    { data: embedData, execute: executeEmbed },
    { data: statusData, execute: executeStatus },
    { data: spamData, execute: executeSpam }
  ]
};