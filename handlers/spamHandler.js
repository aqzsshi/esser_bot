const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const ms = require('ms');

const activeSpams = new Map();

const data = {
  name: 'спам',
  description: 'Автоматически продвигать чат вниз (только для админов)',
  options: [
    {
      name: 'время',
      description: 'Время спама (например: 10s, 2m, 1h)',
      type: 3,
      required: false,
    },
    {
      name: 'стоп',
      description: 'Остановить спам',
      type: 5,
      required: false,
    },
  ],
};

// Функция проверки прав администратора сервера
function hasAdminRole(member) {
  // Проверяем права администратора на сервере (не зависит от конкретной роли)
  return member.permissions.has('Administrator');
}

async function execute(interaction, client) {
  // Проверка прав администратора сервера
  if (!hasAdminRole(interaction.member)) {
    return interaction.reply({
      content: '❌ У вас нет прав администратора сервера для выполнения этой команды.',
      ephemeral: true
    });
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

  // Безопасное логирование
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

module.exports = { data, execute };