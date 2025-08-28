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
        if (!interaction.isButton() && !interaction.isModalSubmit()) return false;

        // Открываем модал для ВС
        if (interaction.isButton() && interaction.customId === 'open_vs_setup') {
            const cfg = loadConfigs();
            const g = cfg[interaction.guildId]?.gameResults || {};

            const modal = new ModalBuilder().setCustomId('vs_setup_modal').setTitle('Настройка модуля ВС');
            const ch = new TextInputBuilder().setCustomId('vs_channel').setLabel('ID канала для отчетов').setStyle(TextInputStyle.Short).setRequired(true).setValue(g.channelId || '');
            const submitRoles = new TextInputBuilder().setCustomId('vs_submit_roles').setLabel('ID ролей (кто заполняет), запятые').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue((g.submitterRoleIds||[]).join(','));
            const listRoles = new TextInputBuilder().setCustomId('vs_list_roles').setLabel('ID ролей (список игроков), запятые').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue((g.allowedRoleIds||[]).join(','));
            const win = new TextInputBuilder().setCustomId('vs_win').setLabel('URL фото победы').setStyle(TextInputStyle.Short).setRequired(true).setValue(g.winPhotoUrl || '');
            const lose = new TextInputBuilder().setCustomId('vs_lose').setLabel('URL фото поражения').setStyle(TextInputStyle.Short).setRequired(true).setValue(g.losePhotoUrl || '');
            modal.addComponents(
                new ActionRowBuilder().addComponents(ch),
                new ActionRowBuilder().addComponents(submitRoles),
                new ActionRowBuilder().addComponents(listRoles),
                new ActionRowBuilder().addComponents(win),
                new ActionRowBuilder().addComponents(lose)
            );
            await interaction.showModal(modal);
            return true;
        }

        // Открываем модал для заявок
        if (interaction.isButton() && interaction.customId === 'open_apps_setup') {
            const cfg = loadConfigs();
            const a = cfg[interaction.guildId]?.applications || {};
            const modal = new ModalBuilder().setCustomId('apps_setup_modal').setTitle('Настройка модуля заявок');
            const ch = new TextInputBuilder().setCustomId('apps_channel').setLabel('ID канала для заявок').setStyle(TextInputStyle.Short).setRequired(true).setValue(a.familyChannelId || '');
            const mention = new TextInputBuilder().setCustomId('apps_mention').setLabel('ID ролей упоминаний (запятые)').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue((a.mentionRoleIds||[]).join(','));
            const call = new TextInputBuilder().setCustomId('apps_call').setLabel('ID ролей для созвона (запятые)').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue((a.callRoleIds||[]).join(','));
            const photo = new TextInputBuilder().setCustomId('apps_photo').setLabel('URL фото (опционально)').setStyle(TextInputStyle.Short).setRequired(false).setValue(a.applicationPhotoUrl || '');
            modal.addComponents(
                new ActionRowBuilder().addComponents(ch),
                new ActionRowBuilder().addComponents(mention),
                new ActionRowBuilder().addComponents(call),
                new ActionRowBuilder().addComponents(photo)
            );
            await interaction.showModal(modal);
            return true;
        }

        // Сохранение ВС
        if (interaction.isModalSubmit() && interaction.customId === 'vs_setup_modal') {
            const channelId = interaction.fields.getTextInputValue('vs_channel').trim();
            const submitterRoleIds = interaction.fields.getTextInputValue('vs_submit_roles').split(',').map(s=>s.trim()).filter(s=>/^\d+$/.test(s));
            const allowedRoleIds = interaction.fields.getTextInputValue('vs_list_roles').split(',').map(s=>s.trim()).filter(s=>/^\d+$/.test(s));
            const winPhotoUrl = interaction.fields.getTextInputValue('vs_win').trim();
            const losePhotoUrl = interaction.fields.getTextInputValue('vs_lose').trim();

            const cfg = loadConfigs();
            if (!cfg[interaction.guildId]) cfg[interaction.guildId] = {};
            cfg[interaction.guildId].gameResults = { channelId, submitterRoleIds, allowedRoleIds, winPhotoUrl, losePhotoUrl };
            saveConfigs(cfg);
            await interaction.reply({ content: '✅ Настройки ВС сохранены.', flags: 64 });
            return true;
        }

        // Сохранение Заявок
        if (interaction.isModalSubmit() && interaction.customId === 'apps_setup_modal') {
            const channelId = interaction.fields.getTextInputValue('apps_channel').trim();
            const mentionRoleIds = interaction.fields.getTextInputValue('apps_mention').split(',').map(s=>s.trim()).filter(s=>/^\d+$/.test(s));
            const callRoleIds = interaction.fields.getTextInputValue('apps_call').split(',').map(s=>s.trim()).filter(s=>/^\d+$/.test(s));
            const applicationPhotoUrl = interaction.fields.getTextInputValue('apps_photo').trim();

            const cfg = loadConfigs();
            if (!cfg[interaction.guildId]) cfg[interaction.guildId] = {};
            cfg[interaction.guildId].applications = { familyChannelId: channelId, mentionRoleIds, callRoleIds, applicationPhotoUrl };
            saveConfigs(cfg);
            await interaction.reply({ content: '✅ Настройки заявок сохранены.', flags: 64 });
            return true;
        }
        return false;
    }
};

module.exports = { commands: [settingsCommand] };

