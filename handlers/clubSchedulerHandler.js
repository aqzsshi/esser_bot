const { EmbedBuilder } = require('discord.js');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');

const sentMessages = [];

function getAllGuildSchedules() {
  const configPath = path.join(__dirname, 'serverConfigs.json');
  try {
    if (!fs.existsSync(configPath)) return {};
    const serverConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const result = {};
    for (const [guildId, cfg] of Object.entries(serverConfigs)) {
      if (cfg && Array.isArray(cfg.clubSchedules)) {
        result[guildId] = cfg.clubSchedules;
      }
    }
    return result;
  } catch (e) {
    console.error('Ошибка чтения serverConfigs.json (club schedules):', e);
    return {};
  }
}

function initClubScheduler(client) {
  setInterval(async () => {
    const now = moment().tz('Europe/Moscow');
    const currentTime = now.format('HH:mm');

    const all = getAllGuildSchedules();

    for (const [guildId, schedules] of Object.entries(all)) {
      for (const club of schedules) {
        for (const meetingTime of club.times) {
          const meetingMoment = moment.tz(meetingTime, 'HH:mm', 'Europe/Moscow');
          const diff = meetingMoment.diff(now, 'minutes');

          let messageType = '';
          if (diff === 10) {
            messageType = 'reminder';
          } else if (meetingTime === currentTime) {
            messageType = 'start';
          } else {
            continue;
          }

          const alreadySent = sentMessages.some(
            msg => msg.guildId === guildId && msg.channelId === club.channelId && msg.time === meetingTime && msg.type === messageType
          );
          if (alreadySent) continue;

          try {
            const channel = await client.channels.fetch(club.channelId);
            if (!channel || !channel.isTextBased()) continue;

            const embed = new EmbedBuilder()
              .setTitle(`Митинг клуба ${club.name}`)
              .setDescription(
                messageType === 'reminder'
                  ? `🔔 Напоминание! Через **10 минут** начнется митинг клуба **${club.name}**. Готовьтесь!`
                  : `✅ Митинг клуба **${club.name}** начинается прямо сейчас!`
              )
              .setColor('#1D1D1E')
              .setImage(club.image)
              .setTimestamp();

            const message = await channel.send({
              content: club.roleId ? `<@&${club.roleId}>` : null,
              embeds: [embed],
            });

            sentMessages.push({
              messageId: message.id,
              guildId,
              channelId: club.channelId,
              time: meetingTime,
              type: messageType,
              sentAt: Date.now(),
            });
          } catch (err) {
            console.error(`Ошибка при отправке митинга для ${club.name} (${guildId}):`, err);
          }
        }
      }
    }

    // Удаление устаревших сообщений (старше 55 минут)
    for (const msg of [...sentMessages]) {
      const age = Date.now() - msg.sentAt;
      if (age > 55 * 60 * 1000) {
        try {
          const channel = await client.channels.fetch(msg.channelId);
          const m = await channel.messages.fetch(msg.messageId);
          await m.delete();
        } catch (err) {
          // игнорируем, если удаление не удалось
        } finally {
          const idx = sentMessages.indexOf(msg);
          if (idx >= 0) sentMessages.splice(idx, 1);
        }
      }
    }
  }, 60 * 1000);
}

// ===== Slash-команда настройки расписаний клубов =====
const data = {
  name: 'клубы_уведомления',
  description: 'Настроить уведомления о митингах клубов (только для администраторов)',
  options: [
    { name: 'тип', description: 'Тип клуба (реднеки/байкеры)', type: 3, required: true },
    { name: 'канал', description: 'ID канала для уведомлений', type: 3, required: true },
    { name: 'роль', description: 'ID роли для тега', type: 3, required: true },
    { name: 'время', description: 'Время митингов через запятую (напр. 07:50, 10:50, 13:50)', type: 3, required: true },
    { name: 'фото', description: 'Ссылка на фото (баннер)', type: 3, required: true }
  ]
};

function parseTimes(input) {
  return input.split(',').map(t => t.trim()).filter(Boolean).filter(t => /^\d{2}:\d{2}$/.test(t));
}

async function executeSetup(interaction, client) {
  if (!interaction.member.permissions.has('Administrator')) {
    return interaction.reply({ content: '❌ Требуются права администратора.', ephemeral: true });
  }

  const typeRaw = interaction.options.getString('тип').toLowerCase();
  const channelId = interaction.options.getString('канал');
  const roleId = interaction.options.getString('роль');
  const timesRaw = interaction.options.getString('время');
  const imageUrl = interaction.options.getString('фото');

  if (!channelId.match(/^\d+$/)) return interaction.reply({ content: '❌ Неверный формат ID канала.', ephemeral: true });
  if (!roleId.match(/^\d+$/)) return interaction.reply({ content: '❌ Неверный формат ID роли.', ephemeral: true });
  if (!/^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)$/i.test(imageUrl)) return interaction.reply({ content: '❌ Укажите прямую ссылку на изображение (png/jpg/jpeg/gif/webp).', ephemeral: true });

  try {
    const ch = await interaction.guild.channels.fetch(channelId);
    if (!ch) return interaction.reply({ content: '❌ Канал не найден.', ephemeral: true });
  } catch { return interaction.reply({ content: '❌ Канал не найден.', ephemeral: true }); }
  try {
    const role = await interaction.guild.roles.fetch(roleId);
    if (!role) return interaction.reply({ content: '❌ Роль не найдена.', ephemeral: true });
  } catch { return interaction.reply({ content: '❌ Роль не найдена.', ephemeral: true }); }

  const times = parseTimes(timesRaw);
  if (times.length === 0) return interaction.reply({ content: '❌ Укажите корректные времена в формате HH:MM через запятую.', ephemeral: true });

  let clubId = null;
  let clubName = null;
  if (['реднеки', 'rednecks'].includes(typeRaw)) { clubId = 'rednecks'; clubName = 'Реднеки'; }
  else if (['байкеры', 'bikers'].includes(typeRaw)) { clubId = 'bikers'; clubName = 'Байкеры'; }
  else return interaction.reply({ content: '❌ Неизвестный тип клуба. Используйте: реднеки или байкеры.', ephemeral: true });

  const configPath = path.join(__dirname, 'serverConfigs.json');
  let serverConfigs = {};
  try {
    if (fs.existsSync(configPath)) serverConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error('Ошибка чтения serverConfigs.json:', e);
  }

  const guildId = interaction.guild.id;
  const current = serverConfigs[guildId]?.clubSchedules || [];
  const updated = [...current];
  const idx = updated.findIndex(c => c.clubId === clubId);
  const newEntry = { clubId, name: clubName, channelId, roleId, times, image: imageUrl };
  if (idx >= 0) updated[idx] = newEntry; else updated.push(newEntry);

  serverConfigs[guildId] = { ...serverConfigs[guildId], clubSchedules: updated };

  try {
    fs.writeFileSync(configPath, JSON.stringify(serverConfigs, null, 2), 'utf8');
  } catch (e) {
    console.error('Ошибка записи serverConfigs.json:', e);
    return interaction.reply({ content: '❌ Не удалось сохранить настройки.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ Уведомления клуба настроены')
    .setColor('#00FF00')
    .addFields(
      { name: 'Клуб', value: clubName, inline: true },
      { name: 'Канал', value: `<#${channelId}>`, inline: true },
      { name: 'Роль', value: `<@&${roleId}>`, inline: true },
      { name: 'Время', value: times.join(', '), inline: false },
      { name: 'Фото', value: imageUrl, inline: false }
    )
    .setFooter({ text: `Настроил: ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// Export as function with attached commands property
initClubScheduler.commands = [ { data, execute: executeSetup } ];

module.exports = initClubScheduler;