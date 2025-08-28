const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

function loadServerConfigs() {
    try {
        const configPath = path.join(__dirname, 'serverConfigs.json');
        if (!fs.existsSync(configPath)) {
            fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
            return {};
        }
        const data = fs.readFileSync(configPath, 'utf8');
        try {
            const json = JSON.parse(data);
            return typeof json === 'object' && json ? json : {};
        } catch {
            fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
            return {};
        }
    } catch {
        return {};
    }
}

function saveServerConfigs(configs) {
    try {
        const configPath = path.join(__dirname, 'serverConfigs.json');
        fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
        return true;
    } catch {
        return false;
    }
}

const setupApplicationsCommand = {
    data: new SlashCommandBuilder()
        .setName('заявки_настройка')
        .setDescription('Настройка модуля заявок (только для администраторов)')
        .addChannelOption(o => o.setName('канал').setDescription('Канал для заявок').setRequired(true))
        .addStringOption(o => o.setName('упоминания_ролей').setDescription('ID ролей для упоминания (через запятую)').setRequired(false))
        .addStringOption(o => o.setName('созвон_ролей').setDescription('ID ролей для созвона (через запятую)').setRequired(false))
        .addStringOption(o => o.setName('фото').setDescription('Ссылка на фото для embed').setRequired(false)),

    async execute(interaction) {
        // Проверка прав (учитываем владельца и роль Owner (имя бота))
        const { hasAdminOrOwner } = require('./permissionUtils');
        const isAdmin = hasAdminOrOwner(interaction.member);
        if (!isAdmin) {
            await interaction.reply({ content: '❌ Недостаточно прав.', flags: 64 });
            return;
        }

        const channel = interaction.options.getChannel('канал');
        const mentionRoles = (interaction.options.getString('упоминания_ролей') || '').split(',').map(s => s.trim()).filter(Boolean);
        const callRoles = (interaction.options.getString('созвон_ролей') || '').split(',').map(s => s.trim()).filter(Boolean);
        const photo = interaction.options.getString('фото') || '';

        const guildId = interaction.guildId;
        const configs = loadServerConfigs();
        if (!configs[guildId]) configs[guildId] = {};

        configs[guildId].applications = {
            familyChannelId: channel.id,
            mentionRoleIds: mentionRoles.filter(id => /^\d+$/.test(id)),
            callRoleIds: callRoles.filter(id => /^\d+$/.test(id)),
            applicationPhotoUrl: photo
        };

        if (!saveServerConfigs(configs)) {
            await interaction.reply({ content: '❌ Ошибка сохранения.', flags: 64 });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('✅ Модуль заявок настроен')
            .addFields(
                { name: 'Канал', value: channel.toString(), inline: true },
                { name: 'Упоминания', value: mentionRoles.filter(id => /^\d+$/.test(id)).map(id => `<@&${id}>`).join(', ') || '—', inline: false },
                { name: 'Созвон', value: callRoles.filter(id => /^\d+$/.test(id)).map(id => `<@&${id}>`).join(', ') || '—', inline: false },
            )
            .setTimestamp();
        if (photo && photo.startsWith('http')) embed.setImage(photo);

        await interaction.reply({ embeds: [embed], flags: 64 });
    }
};

module.exports = { commands: [setupApplicationsCommand] };

