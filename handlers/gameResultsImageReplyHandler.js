const { AttachmentBuilder, Events } = require('discord.js');

module.exports = (client) => {
	client.on(Events.MessageCreate, async (message) => {
		try {
			// Игнорировать ботов
			if (message.author.bot) return;
			// Должен быть ответ на сообщение
			if (!message.reference || !message.reference.messageId) return;

			const replied = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
			if (!replied) return;
			// Сообщение должно быть от бота и содержать embed отчета
			if (!replied.author?.bot) return;
			if (!replied.embeds || replied.embeds.length === 0) return;

			// Проверяем наличие изображения у присланного сообщения
			const attachment = message.attachments.find(att => {
				const url = att.url?.toLowerCase() || '';
				return url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.webp');
			});
			if (!attachment) return;

			// Берем первый embed и обновляем картинку
			const embed = replied.embeds[0].toJSON();
			embed.image = { url: attachment.url };

			await replied.edit({ embeds: [embed] });
			await message.react('✅');
		} catch (err) {
			console.error('Ошибка при обновлении изображения в отчете:', err);
		}
	});
};