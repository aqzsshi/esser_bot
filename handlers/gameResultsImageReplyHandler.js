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
				const contentType = (att.contentType || '').toLowerCase();
				if (contentType.startsWith('image/')) return true;
				const url = (att.url || '').toLowerCase();
				return url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.webp') || url.endsWith('.gif') || url.endsWith('.bmp');
			});
			if (!attachment) return;

			// Скачиваем изображение и загружаем на catbox.moe
			let hostedUrl = null;
			try {
				const resp = await fetch(attachment.url);
				if (!resp.ok) throw new Error(`download failed: ${resp.status}`);
				const arrayBuffer = await resp.arrayBuffer();
				const fileName = attachment.name || 'image.png';

				const form = new FormData();
				form.append('reqtype', 'fileupload');
				form.append('fileToUpload', new Blob([arrayBuffer]), fileName);

				const upload = await fetch('https://catbox.moe/user/api.php', {
					method: 'POST',
					body: form
				});
				const text = await upload.text();
				if (upload.ok && /^https?:\/\//i.test(text)) {
					hostedUrl = text.trim();
				}
			} catch (e) {
				console.error('Ошибка загрузки на catbox.moe:', e);
			}

			const finalUrl = hostedUrl || attachment.url;

			// Берем первый embed и обновляем картинку
			const embed = replied.embeds[0].toJSON();
			embed.image = { url: finalUrl };
			if (hostedUrl) {
				const prev = embed.description || '';
				embed.description = prev ? `${prev}\n🔗 Прямая ссылка: ${hostedUrl}` : `🔗 Прямая ссылка: ${hostedUrl}`;
			}

			await replied.edit({ embeds: [embed] });
			await message.react('✅');
		} catch (err) {
			console.error('Ошибка при обновлении изображения в отчете:', err);
		}
	});
};