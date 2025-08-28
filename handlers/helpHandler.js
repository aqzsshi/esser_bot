const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const helpCommand = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Справка по боту: команды и настройка'),
    async execute(interaction, client) {
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('Помощь по боту')
            .setDescription('Ниже перечислены основные команды и способы настройки модулей.')
            .addFields(
                { name: '🎮 Результаты игр', value: '`/вс` — создать отчет\n`/вс_настройка канал роли_заполнения роли_списка фото_победы фото_поражения` — настройка', inline: false },
                { name: '🗺️ Карты войны за бизнес', value: '`/вс_мапы` — выбор карты и показ изображения', inline: false },
                { name: '📝 Заявки', value: '`/заявка` — подать заявку\n`/заявки_настройка канал [упоминания_ролей] [созвон_ролей] [фото]` — настройка', inline: false },
                { name: '📱 Статус бота', value: 'Статус меняется автоматически каждые несколько минут (модуль статус-без-команд).', inline: false }
            )
            .setFooter({ text: `Запросил: ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: 64 });
    }
};

module.exports = { commands: [helpCommand] };

