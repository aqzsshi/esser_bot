const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const data = {
  name: 'заявки_настройка',
  description: 'Настроить модуль заявок для сервера (только для администраторов)',
  options: [
    {
      name: 'канал',
      description: 'ID канала для отправки заявок',
      type: 3, // STRING type
      required: true
    },
    {
      name: 'роли_уведомления',
      description: 'ID ролей для уведомлений (через запятую)',
      type: 3, // STRING type
      required: true
    },
    {
      name: 'роль_принятия',
      description: 'ID роли для выдачи при принятии заявки',
      type: 3, // STRING type
      required: true
    },
    {
      name: 'фото_заявки',
      description: 'Ссылка на фото для заявок',
      type: 3, // STRING type
      required: true
    }
  ]
};

async function execute(interaction, client) {
  // Проверяем права администратора
  if (!interaction.member.permissions.has('Administrator')) {
    return interaction.reply({
      content: '❌ У вас нет прав для настройки модуля заявок. Требуются права администратора.',
      ephemeral: true
    });
  }

  const guildId = interaction.guild.id;
  const channelId = interaction.options.getString('канал');
  const mentionRolesStr = interaction.options.getString('роли_уведомления');
  const callRoleId = interaction.options.getString('роль_принятия');
  const applicationPhotoUrl = interaction.options.getString('фото_заявки');

  // Валидация входных данных
  if (!channelId.match(/^\d+$/)) {
    return interaction.reply({
      content: '❌ Неверный формат ID канала. ID должен состоять только из цифр.',
      ephemeral: true
    });
  }

  if (!callRoleId.match(/^\d+$/)) {
    return interaction.reply({
      content: '❌ Неверный формат ID роли принятия. ID должен состоять только из цифр.',
      ephemeral: true
    });
  }

  // Проверяем существование канала
  try {
    const channel = await interaction.guild.channels.fetch(channelId);
    if (!channel) {
      return interaction.reply({
        content: '❌ Канал с указанным ID не найден на этом сервере.',
        ephemeral: true
      });
    }
  } catch (error) {
    return interaction.reply({
      content: '❌ Не удалось найти канал с указанным ID.',
      ephemeral: true
    });
  }

  // Проверяем существование роли принятия
  try {
    const role = await interaction.guild.roles.fetch(callRoleId);
    if (!role) {
      return interaction.reply({
        content: '❌ Роль с указанным ID не найдена на этом сервере.',
        ephemeral: true
      });
    }
  } catch (error) {
    return interaction.reply({
      content: '❌ Не удалось найти роль с указанным ID.',
      ephemeral: true
    });
  }

  // Парсим роли уведомлений
  const mentionRoleIds = mentionRolesStr.split(',').map(id => id.trim()).filter(id => id.match(/^\d+$/));
  
  if (mentionRoleIds.length === 0) {
    return interaction.reply({
      content: '❌ Не указаны корректные ID ролей для уведомлений.',
      ephemeral: true
    });
  }

  // Проверяем существование ролей уведомлений
  for (const roleId of mentionRoleIds) {
    try {
      const role = await interaction.guild.roles.fetch(roleId);
      if (!role) {
        return interaction.reply({
          content: `❌ Роль с ID ${roleId} не найдена на этом сервере.`,
          ephemeral: true
        });
      }
    } catch (error) {
      return interaction.reply({
        content: `❌ Не удалось найти роль с ID ${roleId}.`,
        ephemeral: true
      });
    }
  }

  // Валидация URL фото
  if (!applicationPhotoUrl.match(/^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)$/i)) {
    return interaction.reply({
      content: '❌ Неверный формат ссылки на фото. Укажите прямую ссылку на изображение.',
      ephemeral: true
    });
  }

  // Сохраняем настройки
  const configPath = path.join(__dirname, 'serverConfigs.json');
  let serverConfigs = {};
  
  try {
    if (fs.existsSync(configPath)) {
      serverConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (error) {
    console.error('Ошибка чтения конфигурации серверов:', error);
  }

  // Обновляем настройки для текущего сервера
  serverConfigs[guildId] = {
    ...serverConfigs[guildId],
    applications: {
      familyChannelId: channelId,
      mentionRoleIds: mentionRoleIds,
      callRoleIds: [callRoleId],
      applicationPhotoUrl: applicationPhotoUrl
    }
  };

  try {
    fs.writeFileSync(configPath, JSON.stringify(serverConfigs, null, 2), 'utf8');
  } catch (error) {
    console.error('Ошибка сохранения конфигурации серверов:', error);
    return interaction.reply({
      content: '❌ Произошла ошибка при сохранении настроек.',
      ephemeral: true
    });
  }

  // Создаем embed подтверждения
  const confirmEmbed = new EmbedBuilder()
    .setTitle('✅ Настройки заявок обновлены!')
    .setColor('#00FF00')
    .addFields(
      { name: '📺 Канал заявок', value: `<#${channelId}>`, inline: true },
      { name: '🔔 Роли уведомлений', value: mentionRoleIds.map(id => `<@&${id}>`).join(', '), inline: true },
      { name: '🎯 Роль принятия', value: `<@&${callRoleId}>`, inline: true },
      { name: '🖼️ Фото заявок', value: applicationPhotoUrl, inline: false }
    )
    .setFooter({ text: `Настроил: ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.reply({ embeds: [confirmEmbed] });
}

module.exports = { data, execute };