const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionType } = require('discord.js');
const path = require('path');
const fs = require('fs');

const data = {
  name: 'заявка',
  description: 'Подать заявку в семью',
};

// Функция для получения настроек сервера
function getServerConfig(guildId) {
  const configPath = path.join(__dirname, 'serverConfigs.json');
  try {
    if (fs.existsSync(configPath)) {
      const serverConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return serverConfigs[guildId]?.applications || null;
    }
  } catch (error) {
    console.error('Ошибка чтения конфигурации сервера:', error);
  }
  return null;
}

async function execute(interaction, client) {
  const guildId = interaction.guild.id;
  const serverConfig = getServerConfig(guildId);

  if (!serverConfig) {
    return interaction.reply({
      content: '❌ Модуль заявок не настроен для этого сервера. Администратор должен использовать команду `/заявки_настройка` для настройки.',
      ephemeral: true
    });
  }

  // Показываем embed с кнопкой
  const startEmbed = new EmbedBuilder()
    .setTitle('Добро пожаловать! <:logolight:1366047161451544626> ')
    .setDescription('Пожалуйста, нажмите на кнопку ниже, чтобы подать заявку в семью.')
    .setImage(serverConfig.applicationPhotoUrl || 'attachment://FamilyPhoto.png')
    .setColor('#1D1D1E');

  const applicationButton = new ButtonBuilder()
    .setCustomId('apply')
    .setLabel('Подать заявку')
    .setEmoji('1366047161451544626')
    .setStyle(ButtonStyle.Secondary);

  const replyOptions = {
    embeds: [startEmbed],
    components: [new ActionRowBuilder().addComponents(applicationButton)]
  };

  // Если используется кастомное фото, не добавляем файл
  if (!serverConfig.applicationPhotoUrl) {
    replyOptions.files = [path.join(__dirname, 'images', 'FamilyPhoto.png')];
  }

  await interaction.reply(replyOptions);
}

// Обработка кнопки и модалки
async function handleComponent(interaction, client) {
  if (interaction.isButton() && interaction.customId === 'apply') {
    try {
      const modal = new ModalBuilder()
        .setCustomId('applicationModal')
        .setTitle('Заполнение заявки')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('realName')
              .setLabel('Как вас зовут (ирл)?')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('nickname')
              .setLabel('Ваш ник в игре?')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('age')
              .setLabel('Ваш возраст (ирл)?')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('level')
              .setLabel('Ваш уровень в игре?')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('reason')
              .setLabel('Почему вы хотите к нам?')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          )
        );
      await interaction.showModal(modal);
    } catch (error) {
      console.error('Ошибка при показе модального окна:', error);
      await interaction.reply({ content: '❌ Произошла ошибка при открытии формы заявки. Попробуйте позже.', ephemeral: true });
    }
    return true;
  } else if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'applicationModal') {
    const guildId = interaction.guild.id;
    const serverConfig = getServerConfig(guildId);

    if (!serverConfig) {
      return interaction.reply({
        content: '❌ Модуль заявок не настроен для этого сервера.',
        ephemeral: true
      });
    }

    await interaction.reply({ content: '✅ Заявка отправлена!', ephemeral: true });
    
    // Отправка заявки в канал
    try {
      const familyChannel = await client.channels.fetch(serverConfig.familyChannelId);
      if (!familyChannel) {
        await interaction.editReply({ content: '❌ Ошибка: канал семьи не найден. Обратитесь к администратору.', ephemeral: true });
        return true;
      }
      
      const fields = [
        `1. Как вас зовут (ирл): ${interaction.fields.getTextInputValue('realName')}`,
        `2. Ваш ник в игре: ${interaction.fields.getTextInputValue('nickname')}`,
        `3. Ваш возраст (ирл): ${interaction.fields.getTextInputValue('age')}`,
        `4. Ваш уровень в игре: ${interaction.fields.getTextInputValue('level')}`,
        `5. Почему вы хотите к нам: ${interaction.fields.getTextInputValue('reason')}`,
      ].join('\n');
      const applicationEmbed = new EmbedBuilder()
        .setTitle('Новая заявка в семью!')
        .setColor('#1D1D1E')
        .setDescription(`Статус: 🔵 На рассмотрении\n\n${fields}\n\nЗаявку заполнил: ${interaction.user}\nДата и время отправки: \`${formatDate(new Date())}\``);
      const acceptButton = new ButtonBuilder()
        .setCustomId(`accept_${interaction.user.id}`)
        .setLabel('Принять')
        .setStyle(ButtonStyle.Success);
      const declineButton = new ButtonBuilder()
        .setCustomId(`decline_${interaction.user.id}`)
        .setLabel('Отклонить')
        .setStyle(ButtonStyle.Danger);
      await familyChannel.send({
        content: serverConfig.mentionRoleIds.map(id => `<@&${id}>`).join(' '),
        embeds: [applicationEmbed],
        components: [new ActionRowBuilder().addComponents(acceptButton, declineButton)],
      });
    } catch (error) {
      console.error('Ошибка при отправке заявки:', error);
      await interaction.editReply({ content: '❌ Произошла ошибка при отправке заявки. Попробуйте позже.', ephemeral: true });
    }
    return true;
  } else if (interaction.isButton() && (interaction.customId.startsWith('accept_') || interaction.customId.startsWith('decline_'))) {
    const userId = interaction.customId.split('_')[1];
    const status = interaction.customId.startsWith('accept_') ? '🟢 Принято' : '🔴 Отклонено';
    const message = interaction.message;
    const embed = message.embeds[0];
    if (!embed || !embed.description) {
      await interaction.reply({ content: '❗ Ошибка: невозможно обновить статус. Описание не найдено.', ephemeral: true });
      return true;
    }
    let newDescription = embed.description.replace(/Статус: .*/, `Статус: ${status}\nРассмотрел: <@${interaction.user.id}>`);
    const updatedEmbed = EmbedBuilder.from(embed)
      .setDescription(newDescription);
    await message.edit({
      embeds: [updatedEmbed],
      components: [
        new ActionRowBuilder().addComponents(
          message.components?.[0]?.components.map(button => ButtonBuilder.from(button).setDisabled(true)) || []
        )
      ]
    });
    try {
      const user = await client.users.fetch(userId);
      if (user && status === '🟢 Принято') {
        const guild = interaction.guild || message.guild;
        if (guild) {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member) {
            const serverConfig = getServerConfig(guild.id);
            if (serverConfig && serverConfig.callRoleIds) {
              for (const roleId of serverConfig.callRoleIds) {
                if (!member.roles.cache.has(roleId)) {
                  await member.roles.add(roleId).catch(() => {});
                }
              }
            }
          }
        }
        const acceptEmbed = new EmbedBuilder()
          .setTitle('🎉 Ваша заявка принята!')
          .setDescription('В скором времени вас пригласят на беседу!')
          .setColor('#1D1D1E');
        await user.send({ embeds: [acceptEmbed] });
      } else if (user) {
        const declineEmbed = new EmbedBuilder()
          .setTitle('❌ Ваша заявка отклонена')
          .setDescription('К сожалению, ваша заявка была отклонена. Спасибо за интерес!')
          .setColor('#1D1D1E');
        await user.send({ embeds: [declineEmbed] });
      }
    } catch (err) {
      console.error('Ошибка при отправке ЛС или выдаче роли:', err);
    }
    await interaction.reply({ content: `Вы изменили статус на **${status}**.`, ephemeral: true });
    return true;
  }
  return false;
}

function formatDate(date) {
  return date.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }).replace(',', '');
}

// ==== Команда настройки модуля заявок (объединено из adminApplicationSetupCommand) ====
const setupData = {
  name: 'заявки_настройка',
  description: 'Настроить модуль заявок для сервера (только для администраторов)',
  options: [
    {
      name: 'канал',
      description: 'ID канала для отправки заявок',
      type: 3,
      required: true
    },
    {
      name: 'роли_уведомления',
      description: 'ID ролей для уведомлений (через запятую)',
      type: 3,
      required: true
    },
    {
      name: 'роль_принятия',
      description: 'ID роли для выдачи при принятии заявки',
      type: 3,
      required: true
    },
    {
      name: 'фото_заявки',
      description: 'Ссылка на фото для заявок',
      type: 3,
      required: true
    }
  ]
};

async function executeSetup(interaction, client) {
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

  if (!channelId.match(/^\d+$/)) {
    return interaction.reply({ content: '❌ Неверный формат ID канала. ID должен состоять только из цифр.', ephemeral: true });
  }
  if (!callRoleId.match(/^\d+$/)) {
    return interaction.reply({ content: '❌ Неверный формат ID роли принятия. ID должен состоять только из цифр.', ephemeral: true });
  }

  try {
    const channel = await interaction.guild.channels.fetch(channelId);
    if (!channel) return interaction.reply({ content: '❌ Канал с указанным ID не найден на этом сервере.', ephemeral: true });
  } catch {
    return interaction.reply({ content: '❌ Не удалось найти канал с указанным ID.', ephemeral: true });
  }

  try {
    const role = await interaction.guild.roles.fetch(callRoleId);
    if (!role) return interaction.reply({ content: '❌ Роль с указанным ID не найдена на этом сервере.', ephemeral: true });
  } catch {
    return interaction.reply({ content: '❌ Не удалось найти роль с указанным ID.', ephemeral: true });
  }

  const mentionRoleIds = mentionRolesStr.split(',').map(id => id.trim()).filter(id => id.match(/^\d+$/));
  if (mentionRoleIds.length === 0) {
    return interaction.reply({ content: '❌ Не указаны корректные ID ролей для уведомлений.', ephemeral: true });
  }
  for (const roleId of mentionRoleIds) {
    try {
      const role = await interaction.guild.roles.fetch(roleId);
      if (!role) return interaction.reply({ content: `❌ Роль с ID ${roleId} не найдена на этом сервере.`, ephemeral: true });
    } catch {
      return interaction.reply({ content: `❌ Не удалось найти роль с ID ${roleId}.`, ephemeral: true });
    }
  }

  if (!applicationPhotoUrl.match(/^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)$/i)) {
    return interaction.reply({ content: '❌ Неверный формат ссылки на фото. Укажите прямую ссылку на изображение.', ephemeral: true });
  }

  const configPath = path.join(__dirname, 'serverConfigs.json');
  let serverConfigs = {};
  try {
    if (fs.existsSync(configPath)) {
      serverConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (error) {
    console.error('Ошибка чтения конфигурации серверов:', error);
  }

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
    return interaction.reply({ content: '❌ Произошла ошибка при сохранении настроек.', ephemeral: true });
  }

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

const commands = [
  { data, execute, handleComponent },
  { data: setupData, execute: executeSetup, handleComponent }
];

module.exports = { data, execute, handleComponent, commands };