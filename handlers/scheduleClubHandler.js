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

module.exports = (client) => {
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
};