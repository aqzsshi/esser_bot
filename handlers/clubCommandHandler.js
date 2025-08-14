const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const moment = require('moment-timezone'); // Подключаем moment-timezone
const { images } = require('../config.json');

// Массив клубов с id и метками
const CLUBS = [
  { id: 'epsilon', label: 'Epsilon' },
  { id: 'rednecks', label: 'Rednecks' },
  { id: 'carmeet', label: 'Car Meet' },
  { id: 'bikers', label: 'Bikers' },
  { id: 'merryweather', label: 'Merryweather' }
];

const cooldowns = new Map(); // Создаём карту для отслеживания кулдаунов

const data = {
  name: 'клубы',
  description: 'Начать задание клуба',
};

async function execute(interaction, client) {
  const embed = new EmbedBuilder()
    .setTitle('🎉 Esser* Club')
    .setDescription('Нажми на кнопку, чтобы начать отчет времени.\n\n⏳ КД: 2 часа для всех заданий в клубах.')
    .setImage(images.clubMenuBanner) // Замени на нужную картинку
    .setColor('#1D1D1E');

  const row = new ActionRowBuilder().addComponents(
    CLUBS.map((club) =>
      new ButtonBuilder()
        .setCustomId(`club_${club.id}`)
        .setLabel(club.label)
        .setStyle(ButtonStyle.Secondary)
    )
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleComponent(interaction, client) {
  if (!interaction.isButton()) return false;

  // Сначала обработка refresh-кнопки
  if (interaction.customId.startsWith('refresh_')) {
    const clubId = interaction.customId.split('_')[1];
    const userId = interaction.user.id;
    const now = Date.now();
    const cooldown = 2 * 60 * 60 * 1000;
    const userCooldown = cooldowns.get(userId) || {};
    const lastUsed = userCooldown[clubId] || 0;
    if (now - lastUsed < cooldown) {
      const remainingMs = cooldown - (now - lastUsed);
      const remainingMin = Math.ceil(remainingMs / (60 * 1000));
      const endTime = moment(lastUsed + cooldown).tz('Europe/Moscow');
      const formattedTime = endTime.format('HH:mm');
      await interaction.reply({
        content: `⏳ Задание клуба **${clubId}** ещё идёт. Завершится в **${formattedTime} МСК** (через ${remainingMin} мин).`,
        ephemeral: true,
      });
      return true;
    }
    // Если КД закончился — начинаем заново
    userCooldown[clubId] = now;
    cooldowns.set(userId, userCooldown);
    const endTime = moment(now + cooldown).tz('Europe/Moscow');
    const formattedTime = endTime.format('HH:mm');
    const refreshButton = new ButtonBuilder()
      .setCustomId(`refresh_${clubId}`)
      .setLabel('Обновить/Перезапустить')
      .setStyle(ButtonStyle.Secondary);
    const startEmbed = new EmbedBuilder()
      .setTitle('🚀 Задание запущено')
      .setDescription(`Ты заново начал задание клуба **${clubId}**.`)
      .addFields({ name: '⏱ Завершится в', value: `**${formattedTime} МСК** (через 2 часа)` })
      .setColor('#1D1D1E');
    await interaction.reply({
      content: 'Задание клуба перезапущено!',
      ephemeral: true,
    });
    try {
      const dm = await interaction.user.createDM();
      await dm.send({ embeds: [startEmbed], components: [new ActionRowBuilder().addComponents(refreshButton)] });
      setTimeout(async () => {
        const endEmbed = new EmbedBuilder()
          .setTitle('✅ Задание завершено')
          .setDescription(`Задание клуба **${clubId}** завершено!\nТеперь ты можешь начать его снова.`)
          .setColor('#1D1D1E');
        try {
          await dm.send({ embeds: [endEmbed] });
        } catch (e) {
          console.warn(`❗ Ошибка при отправке ЛС после таймера: ${e.message}`);
        }
      }, cooldown);
    } catch (err) {
      console.warn(`❗ Не удалось открыть ЛС ${interaction.user.tag}:`, err.message);
    }
    return true;
  }

  // Дальше обработка club_кнопок
  const [prefix, clubId] = interaction.customId.split('_');
  if (prefix !== 'club') return false;

  const userId = interaction.user.id;
  const now = Date.now();
  const cooldown = 2 * 60 * 60 * 1000; // 2 часа
  const userCooldown = cooldowns.get(userId) || {};
  const lastUsed = userCooldown[clubId] || 0;

  if (now - lastUsed < cooldown) {
    const remainingMs = cooldown - (now - lastUsed);
    const remainingMin = Math.ceil(remainingMs / (60 * 1000));
    await interaction.reply({
      content: `⏳ Задание клуба **${clubId}** уже начато. Подождите ${remainingMin} мин.`,
      ephemeral: true,
    });
    return true;
  }

  // Устанавливаем новый кулдаун
  userCooldown[clubId] = now;
  cooldowns.set(userId, userCooldown);

  await interaction.reply({
    content: `✅ Задание клуба **${clubId}** начато. Подробности в ЛС.`,
    ephemeral: true,
  });

  const endTime = moment(now + cooldown).tz('Europe/Moscow');
  const formattedTime = endTime.format('HH:mm');

  try {
    const dm = await interaction.user.createDM();

    // Сообщение сразу — когда закончится таймер
    const refreshButton = new ButtonBuilder()
      .setCustomId(`refresh_${clubId}`)
      .setLabel('Обновить/Перезапустить')
      .setStyle(ButtonStyle.Secondary);
    const startEmbed = new EmbedBuilder()
      .setTitle('🚀 Задание запущено')
      .setDescription(`Ты начал задание клуба **${clubId}**.`)
      .addFields({ name: '⏱ Завершится в', value: `**${formattedTime} МСК** (через 2 часа)` })
      .setColor('#1D1D1E');
    await dm.send({ embeds: [startEmbed], components: [new ActionRowBuilder().addComponents(refreshButton)] });
  } catch (err) {
    console.warn(`❗ Не удалось открыть ЛС ${interaction.user.tag}:`, err.message);
    await interaction.followUp({
      content: '❌ Не удалось отправить сообщение в ЛС. Проверь, что у тебя открыты личные сообщения от сервера.',
      ephemeral: true,
    });
  }
  return true;
}

module.exports = { data, execute, handleComponent };