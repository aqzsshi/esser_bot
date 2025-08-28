const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
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

function isAdmin(member) {
    return member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild);
}

const setupCommand = {
    data: new SlashCommandBuilder()
        .setName('заявки_настройка')
        .setDescription('Настройка модуля заявок (только для администраторов)')
        .addChannelOption(o => o.setName('канал').setDescription('Канал для заявок').setRequired(true))
        .addStringOption(o => o.setName('упоминания_ролей').setDescription('ID ролей для упоминания (через запятую)').setRequired(false))
        .addStringOption(o => o.setName('созвон_ролей').setDescription('ID ролей для созвона (через запятую)').setRequired(false))
        .addStringOption(o => o.setName('фото').setDescription('Ссылка на фото для embed').setRequired(false)),

    async execute(interaction) {
        if (!isAdmin(interaction.member)) {
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

const applyCommand = {
    data: new SlashCommandBuilder()
        .setName('заявка')
        .setDescription('Отправить заявку')
        .addStringOption(o => o.setName('ник').setDescription('Ваш ник').setRequired(true))
        .addStringOption(o => o.setName('возраст').setDescription('Ваш возраст').setRequired(true))
        .addStringOption(o => o.setName('опыт').setDescription('Опыт / роль').setRequired(true))
        .addStringOption(o => o.setName('о_себе').setDescription('Пару слов о себе').setRequired(false)),

    async execute(interaction, client) {
        const guildId = interaction.guildId;
        const configs = loadServerConfigs();
        const conf = configs[guildId]?.applications;
        if (!conf || !conf.familyChannelId) {
            await interaction.reply({ content: '❌ Модуль заявок не настроен.', flags: 64 });
            return;
        }

        const nick = interaction.options.getString('ник');
        const age = interaction.options.getString('возраст');
        const exp = interaction.options.getString('опыт');
        const about = interaction.options.getString('о_себе') || '—';

        const mentionRoles = (conf.mentionRoleIds || []).map(id => `<@&${id}>`).join(' ');
        const callRoles = (conf.callRoleIds || []).map(id => `<@&${id}>`).join(' ');

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('📝 Новая заявка')
            .addFields(
                { name: 'Заявитель', value: interaction.user.toString(), inline: true },
                { name: 'Ник', value: nick, inline: true },
                { name: 'Возраст', value: age, inline: true },
                { name: 'Опыт / Роль', value: exp, inline: false },
                { name: 'О себе', value: about, inline: false }
            )
            .setFooter({ text: `ID: ${interaction.user.id}` })
            .setTimestamp();
        if (conf.applicationPhotoUrl && conf.applicationPhotoUrl.startsWith('http')) embed.setImage(conf.applicationPhotoUrl);

        const approveBtn = new ButtonBuilder().setCustomId('app_approve').setLabel('✅ Принять').setStyle(ButtonStyle.Success);
        const rejectBtn = new ButtonBuilder().setCustomId('app_reject').setLabel('🛑 Отклонить').setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(approveBtn, rejectBtn);

        try {
            const channel = await client.channels.fetch(conf.familyChannelId);
            if (!channel) throw new Error('channel_not_found');

            const contentParts = [];
            if (mentionRoles) contentParts.push(mentionRoles);
            if (callRoles) contentParts.push(callRoles);

            const sent = await channel.send({ content: contentParts.join(' ') || undefined, embeds: [embed], components: [row] });

            await interaction.reply({ content: '✅ Заявка отправлена!', flags: 64 });
        } catch (e) {
            await interaction.reply({ content: '❌ Не удалось отправить заявку. Проверьте настройку канала.', flags: 64 });
        }
    },

    async handleComponent(interaction) {
        if (!interaction.isButton()) return false;
        if (interaction.customId !== 'app_approve' && interaction.customId !== 'app_reject') return false;

        if (!isAdmin(interaction.member)) {
            await interaction.reply({ content: '❌ Только администратор может выполнять это действие.', flags: 64 });
            return true;
        }

        const approved = interaction.customId === 'app_approve';
        const originalEmbed = interaction.message.embeds?.[0]?.toJSON();
        if (!originalEmbed) {
            await interaction.reply({ content: '❌ Нет данных заявки.', flags: 64 });
            return true;
        }

        const updated = EmbedBuilder.from(originalEmbed)
            .setColor(approved ? '#2ecc71' : '#e74c3c')
            .setTitle(approved ? '✅ Заявка принята' : '🛑 Заявка отклонена')
            .setTimestamp();

        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('app_approve').setLabel('✅ Принять').setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId('app_reject').setLabel('🛑 Отклонить').setStyle(ButtonStyle.Danger).setDisabled(true)
        );

        await interaction.update({ embeds: [updated], components: [disabledRow] });
        return true;
    }
};

module.exports = { commands: [setupCommand, applyCommand] };

