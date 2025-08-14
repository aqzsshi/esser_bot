const { Events, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

function getJoinConfig(guildId) {
  const configPath = path.join(__dirname, 'serverConfigs.json');
  try {
    if (fs.existsSync(configPath)) {
      const serverConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return serverConfigs[guildId]?.joinNotify || null;
    }
  } catch (error) {
    console.error('Ошибка чтения конфигурации сервера (joinNotify):', error);
  }
  return null;
}

module.exports = (client) => {
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      const cfg = getJoinConfig(member.guild.id);
      if (!cfg || !cfg.channelId) return;

      // Размеры изображения
      const width = 700;
      const height = 250;
      // Создаём пустое изображение
      const image = await Jimp.create(width, height, '#23272A');

      // Загружаем аватар пользователя
      const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 128 });
      const avatar = await Jimp.read(avatarURL);
      avatar.circle(); // Обрезаем в круг
      const avatarSize = 150;
      const avatarX = (width - avatarSize) / 2;
      const avatarY = 30;
      avatar.resize(avatarSize, avatarSize);
      image.composite(avatar, avatarX, avatarY);

      // Загружаем шрифты
      const fontBig = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
      const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

      // Ник (по центру под аватаркой)
      image.print(
        fontBig,
        0, avatarY + avatarSize + 10,
        {
          text: `${member.user.username} joined`,
          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
          alignmentY: Jimp.VERTICAL_ALIGN_TOP
        },
        width, 35
      );
      // Тег (по центру под ником)
      const discr = member.user.discriminator && member.user.discriminator !== '0' ? `#${member.user.discriminator}` : '';
      image.print(
        fontSmall,
        0, avatarY + avatarSize + 50,
        {
          text: discr,
          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
          alignmentY: Jimp.VERTICAL_ALIGN_TOP
        },
        width, 25
      );

      // Сохраняем в буфер
      const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
      const attachment = new AttachmentBuilder(buffer, { name: 'welcome.png' });

      // Создаём Embed
      const embed = new EmbedBuilder()
        .setTitle('👋 Новый участник!')
        .setDescription(`Приветствуем <@${member.id}> на сервере!`)
        .setColor('#1D1D1E')
        .setImage('attachment://welcome.png')
        .setTimestamp();

      // Отправляем в нужный канал
      const channel = await member.guild.channels.fetch(cfg.channelId).catch(() => null);
      if (channel && channel.isTextBased()) {
        await channel.send({ embeds: [embed], files: [attachment] });
      }

      // Отправляем приветственное сообщение в ЛС
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('👋 Добро пожаловать на сервер!')
          .setDescription(
            'Рады видеть тебя! Ознакомься с каналами сервера и правилами. Если возникнут вопросы — обратись к администрации.'
          )
          .setColor('#1D1D1E');
        await member.send({ embeds: [dmEmbed] });
      } catch (e) {
        // Игнорируем ошибку, если ЛС закрыты
      }
    } catch (err) {
      console.error('Ошибка при отправке welcome-image:', err);
    }
  });
};