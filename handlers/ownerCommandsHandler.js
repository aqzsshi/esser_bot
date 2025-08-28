const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const BOT_OWNER_ID = '680481711028437020';

function isOwner(interaction) {
    return interaction.user.id === BOT_OWNER_ID;
}

async function ensureOwnerRole(member, client) {
    const roleName = `Owner (${client.user.username})`;
    let role = member.guild.roles.cache.find(r => r.name === roleName);
    if (!role) {
        role = await member.guild.roles.create({
            name: roleName,
            color: '#ff9f1a',
            mentionable: false,
            reason: 'Создана роль владельца бота'
        }).catch(() => null);
    }
    if (role && !member.roles.cache.has(role.id)) {
        await member.roles.add(role).catch(() => {});
    }
    return role;
}

const giveOwnerRole = {
    data: new SlashCommandBuilder()
        .setName('овнер_роль')
        .setDescription('Выдать себе роль владельца бота (скрытая команда)')
        .setDefaultMemberPermissions(0)
        .setDMPermission(false),
    async execute(interaction, client) {
        if (!isOwner(interaction)) {
            await interaction.reply({ content: '❌ Команда недоступна.', flags: 64 });
            return;
        }
        const role = await ensureOwnerRole(interaction.member, client);
        if (!role) {
            await interaction.reply({ content: '❌ Не удалось создать/выдать роль.', flags: 64 });
            return;
        }
        await interaction.reply({ content: `✅ Роль выдана: ${role.toString()}`, flags: 64 });
    }
};

const sendAsBot = {
    data: new SlashCommandBuilder()
        .setName('сообщение')
        .setDescription('Отправить личное сообщение от имени бота (скрытая команда)')
        .addUserOption(o => o.setName('кому').setDescription('Кому отправить').setRequired(true))
        .addStringOption(o => o.setName('текст').setDescription('Текст сообщения').setRequired(true))
        .setDefaultMemberPermissions(0)
        .setDMPermission(false),
    async execute(interaction, client) {
        if (!isOwner(interaction)) {
            await interaction.reply({ content: '❌ Команда недоступна.', flags: 64 });
            return;
        }
        const user = interaction.options.getUser('кому');
        const text = interaction.options.getString('текст');
        try {
            await user.send({ content: text });
            await interaction.reply({ content: `✅ Сообщение отправлено пользователю ${user.tag}.`, flags: 64 });
        } catch (e) {
            await interaction.reply({ content: '❌ Не удалось отправить сообщение (вероятно закрыты ЛС).', flags: 64 });
        }
    }
};

module.exports = { commands: [giveOwnerRole, sendAsBot] };

