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
      flags: 64
    });
  }

  // Показываем embed с кнопкой
  const DEFAULT_PHOTO_URL = 'https://i.ibb.co/8nmDpF27/image.png';
  const startEmbed = new EmbedBuilder()
    .setTitle('Добро пожаловать! <:logolight:1366047161451544626> ')
    .setDescription('Пожалуйста, нажмите на кнопку ниже, чтобы подать заявку в семью.')
    .setImage(serverConfig.applicationPhotoUrl || DEFAULT_PHOTO_URL)
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
      await interaction.reply({ content: '❌ Произошла ошибка при открытии формы заявки. Попробуйте позже.', flags: 64 });
    }
    return;
  } else if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'applicationModal') {
    const guildId = interaction.guild.id;
    const serverConfig = getServerConfig(guildId);

    if (!serverConfig) {
      return interaction.reply({
        content: '❌ Модуль заявок не настроен для этого сервера.',
        flags: 64
      });
    }

    await interaction.reply({ content: '✅ Заявка отправлена!', flags: 64 });
    
    // Отправка заявки в канал
    try {
      const familyChannel = await client.channels.fetch(serverConfig.familyChannelId);
      if (!familyChannel) {
        await interaction.editReply({ content: '❌ Ошибка: канал семьи не найден. Обратитесь к администратору.', flags: 64 });
        return;
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
        content: (serverConfig.mentionRoleIds || []).map(id => `<@&${id}>`).join(' '),
        embeds: [applicationEmbed],
        components: [new ActionRowBuilder().addComponents(acceptButton, declineButton)],
      });
    } catch (error) {
      console.error('Ошибка при отправке заявки:', error);
      await interaction.editReply({ content: '❌ Произошла ошибка при отправке заявки. Попробуйте позже.', flags: 64 });
    }
  } else if (interaction.isButton() && (interaction.customId.startsWith('accept_') || interaction.customId.startsWith('decline_'))) {
    const userId = interaction.customId.split('_')[1];
    const status = interaction.customId.startsWith('accept_') ? '🟢 Принято' : '🔴 Отклонено';
    const message = interaction.message;
    const embed = message.embeds[0];
    if (!embed || !embed.description) {
      return interaction.reply({ content: '❗ Ошибка: невозможно обновить статус. Описание не найдено.', flags: 64 });
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
    await interaction.reply({ content: `Вы изменили статус на **${status}**.`, flags: 64 });
  }
}

module.exports = { data, execute, handleComponent };

function formatDate(date) {
  return date.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }).replace(',', '');
}

