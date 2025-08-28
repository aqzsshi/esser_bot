const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { hasAdminOrOwner } = require('./permissionUtils');

const settingsCommand = {
    data: new SlashCommandBuilder()
        .setName('настройка')
        .setDescription('Управление настройками модулей бота (для админов и владельца)')
        .setDMPermission(false),
    async execute(interaction, client) {
        if (!hasAdminOrOwner(interaction.member)) {
            await interaction.reply({ content: '❌ Недостаточно прав.', flags: 64 });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('Панель настройки модулей бота')
            .setDescription('Выберите модуль для настройки. Нажмите на кнопку ниже, чтобы вызвать соответствующую команду настройки.')
            .addFields(
                { name: '🎮 Результаты игр', value: '`/модуль_вс_настройка` — канал, роли, фото', inline: false },
                { name: '📝 Заявки', value: '`/модуль_заявки_настройка` — канал, роли, фото', inline: false }
            )
            .setFooter({ text: `Запросил: ${interaction.user.tag}` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_vs_setup').setLabel('Настройка ВС').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('open_apps_setup').setLabel('Настройка Заявок').setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [embed], components: [row] });

        // Пробуем отправить приветственное ЛС
        try {
            const dmText = '👋 Добро пожаловать!\n\nЧтобы настроить бота на сервере, используйте панели `/настройка` или команды:\n• `/модуль_вс_настройка` — настроить отчёты о боях\n• `/модуль_заявки_настройка` — настроить модуль заявок\n\nЕсли нужна помощь — вызовите `/помощь`.';
            await interaction.user.send(dmText).catch(() => {});
        } catch {}
    },
    async handleComponent(interaction, client) {
        if (!hasAdminOrOwner(interaction.member)) {
            await interaction.reply({ content: '❌ Недостаточно прав.', flags: 64 });
            return true;
        }
        if (!interaction.isButton()) return false;
        if (interaction.customId === 'open_vs_setup') {
            await interaction.update({ content: 'Открываю интерфейс ввода команды `/модуль_вс_настройка`…', components: [], embeds: [] });
            try { await interaction.followUp({ content: '/модуль_вс_настройка', flags: 64 }); } catch {}
            return true;
        }
        if (interaction.customId === 'open_apps_setup') {
            await interaction.update({ content: 'Открываю интерфейс ввода команды `/модуль_заявки_настройка`…', components: [], embeds: [] });
            try { await interaction.followUp({ content: '/модуль_заявки_настройка', flags: 64 }); } catch {}
            return true;
        }
        return false;
    }
};

module.exports = { commands: [settingsCommand] };

