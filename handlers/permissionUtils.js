const { PermissionFlagsBits } = require('discord.js');

const BOT_OWNER_ID = '680481711028437020';

function hasAdminOrOwner(member) {
    if (!member) return false;
    if (member.user?.id === BOT_OWNER_ID) return true;
    const hasOwnerRole = member.roles?.cache?.some(r => typeof r.name === 'string' && r.name.startsWith('Owner ('));
    if (hasOwnerRole) return true;
    return member.permissions.has(PermissionFlagsBits.Administrator) ||
           member.permissions.has(PermissionFlagsBits.ManageGuild) ||
           member.roles.cache.some(role => role.permissions.has(PermissionFlagsBits.Administrator));
}

module.exports = { hasAdminOrOwner, BOT_OWNER_ID };

