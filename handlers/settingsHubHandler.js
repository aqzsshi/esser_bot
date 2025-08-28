const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { hasAdminOrOwner } = require('./permissionUtils');
const fs = require('fs');
const path = require('path');

function loadConfigs() {
    try {
        const p = path.join(__dirname, 'serverConfigs.json');
        if (!fs.existsSync(p)) { fs.writeFileSync(p, JSON.stringify({}, null, 2)); return {}; }
        const raw = fs.readFileSync(p, 'utf8');
        const json = JSON.parse(raw);
        return typeof json === 'object' && json ? json : {};
    } catch {
        return {};
    }
}

function saveConfigs(cfg) {
    try {
        const p = path.join(__dirname, 'serverConfigs.json');
        fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
        return true;
    } catch { return false; }
}

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
    },
    async handleComponent(interaction, client) {
        if (!hasAdminOrOwner(interaction.member)) {
            await interaction.reply({ content: '❌ Недостаточно прав.', flags: 64 });
            return true;
        }
        if (!interaction.isButton()) return false;
        const getCmdMention = (name) => {
            try {
                const cmd = interaction.client.application?.commands?.cache?.find(c => c.name === name);
                if (cmd) return `</${cmd.name}:${cmd.id}>`;
            } catch {}
            return `/${name}`;
        };

        if (interaction.customId === 'open_vs_setup') {
            const mention = getCmdMention('модуль_вс_настройка');
            await interaction.reply({ content: `Нажмите по команде для быстрого ввода: ${mention}`, flags: 64 });
            return true;
        }
        if (interaction.customId === 'open_apps_setup') {
            const mention = getCmdMention('модуль_заявки_настройка');
            await interaction.reply({ content: `Нажмите по команде для быстрого ввода: ${mention}`, flags: 64 });
            return true;
        }
        return false;
    }
};

module.exports = { commands: [settingsCommand] };

