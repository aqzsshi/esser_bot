const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// Команда для изменения статуса бота
const statusCommand = {
    data: new SlashCommandBuilder()
        .setName('статус')
        .setDescription('Изменить статус бота (только для администраторов)')
        .addStringOption(option =>
            option.setName('тип')
                .setDescription('Тип статуса')
                .setRequired(true)
                .addChoices(
                    { name: '🎮 Играет', value: 'playing' },
                    { name: '👀 Смотрит', value: 'watching' },
                    { name: '🎵 Слушает', value: 'listening' },
                    { name: '💬 Соревнуется', value: 'competing' },
                    { name: '🔄 Стримит', value: 'streaming' },
                    { name: '📱 Пользовательский', value: 'custom' }
                ))
        .addStringOption(option =>
            option.setName('текст')
                .setDescription('Текст статуса')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('ссылка_стрима')
                .setDescription('Ссылка на стрим (только для типа "Стримит")')
                .setRequired(false)),

    async execute(interaction, client) {
        // Проверка прав администратора
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: '❌ У вас недостаточно прав для использования этой команды. Требуются права администратора.',
                flags: 64
            });
            return;
        }

        const statusType = interaction.options.getString('тип');
        const statusText = interaction.options.getString('текст');
        const streamUrl = interaction.options.getString('ссылка_стрима');

        try {
            let activityOptions = {};

            switch (statusType) {
                case 'playing':
                    activityOptions = {
                        name: statusText,
                        type: 0 // ActivityType.Playing
                    };
                    break;
                case 'watching':
                    activityOptions = {
                        name: statusText,
                        type: 3 // ActivityType.Watching
                    };
                    break;
                case 'listening':
                    activityOptions = {
                        name: statusText,
                        type: 2 // ActivityType.Listening
                    };
                    break;
                case 'competing':
                    activityOptions = {
                        name: statusText,
                        type: 5 // ActivityType.Competing
                    };
                    break;
                case 'streaming':
                    if (!streamUrl) {
                        await interaction.reply({
                            content: '❌ Для типа "Стримит" необходимо указать ссылку на стрим.',
                            flags: 64
                        });
                        return;
                    }
                    activityOptions = {
                        name: statusText,
                        type: 1, // ActivityType.Streaming
                        url: streamUrl
                    };
                    break;
                case 'custom':
                    // Для пользовательского статуса используем setPresence с activities: []
                    await client.user.setPresence({
                        activities: [],
                        status: 'online'
                    });
                    await interaction.reply({
                        content: `✅ Статус бота очищен (пользовательский статус убран).`,
                        flags: 64
                    });
                    return;
                default:
                    await interaction.reply({
                        content: '❌ Неизвестный тип статуса.',
                        flags: 64
                    });
                    return;
            }

            // Устанавливаем новый статус
            await client.user.setPresence({
                activities: [activityOptions],
                status: 'online'
            });

            const statusEmojis = {
                'playing': '🎮',
                'watching': '👀',
                'listening': '🎵',
                'competing': '💬',
                'streaming': '🔄'
            };

            const emoji = statusEmojis[statusType] || '📱';
            const typeNames = {
                'playing': 'Играет',
                'watching': 'Смотрит',
                'listening': 'Слушает',
                'competing': 'Соревнуется',
                'streaming': 'Стримит'
            };

            const typeName = typeNames[statusType] || 'Пользовательский';

            await interaction.reply({
                content: `✅ Статус бота изменен!\n\n${emoji} **${typeName}:** ${statusText}${statusType === 'streaming' ? `\n🔗 **Ссылка:** ${streamUrl}` : ''}`,
                flags: 64
            });

        } catch (error) {
            console.error('Ошибка при изменении статуса бота:', error);
            await interaction.reply({
                content: '❌ Произошла ошибка при изменении статуса бота. Попробуйте позже.',
                flags: 64
            });
        }
    }
};

// Команда для очистки статуса бота
const clearStatusCommand = {
    data: new SlashCommandBuilder()
        .setName('статус_очистить')
        .setDescription('Очистить статус бота (только для администраторов)'),

    async execute(interaction, client) {
        // Проверка прав администратора
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: '❌ У вас недостаточно прав для использования этой команды. Требуются права администратора.',
                flags: 64
            });
            return;
        }

        try {
            await client.user.setPresence({
                activities: [],
                status: 'online'
            });

            await interaction.reply({
                content: '✅ Статус бота очищен!',
                flags: 64
            });

        } catch (error) {
            console.error('Ошибка при очистке статуса бота:', error);
            await interaction.reply({
                content: '❌ Произошла ошибка при очистке статуса бота. Попробуйте позже.',
                flags: 64
            });
        }
    }
};

// Команда для показа текущего статуса бота
const showStatusCommand = {
    data: new SlashCommandBuilder()
        .setName('статус_показать')
        .setDescription('Показать текущий статус бота'),

    async execute(interaction, client) {
        try {
            const activities = client.user.presence.activities;
            
            if (activities.length === 0) {
                await interaction.reply({
                    content: '📱 **Текущий статус бота:**\nБез активности (только онлайн статус)',
                    flags: 64
                });
                return;
            }

            const activity = activities[0];
            const statusEmojis = {
                0: '🎮', // Playing
                1: '🔄', // Streaming
                2: '🎵', // Listening
                3: '👀', // Watching
                5: '💬'  // Competing
            };

            const typeNames = {
                0: 'Играет',
                1: 'Стримит',
                2: 'Слушает',
                3: 'Смотрит',
                5: 'Соревнуется'
            };

            const emoji = statusEmojis[activity.type] || '📱';
            const typeName = typeNames[activity.type] || 'Неизвестно';

            let statusText = `📱 **Текущий статус бота:**\n\n${emoji} **${typeName}:** ${activity.name}`;
            
            if (activity.type === 1 && activity.url) { // Streaming
                statusText += `\n🔗 **Ссылка:** ${activity.url}`;
            }

            await interaction.reply({
                content: statusText,
                flags: 64
            });

        } catch (error) {
            console.error('Ошибка при показе статуса бота:', error);
            await interaction.reply({
                content: '❌ Произошла ошибка при показе статуса бота. Попробуйте позже.',
                flags: 64
            });
        }
    }
};

module.exports = {
    commands: [statusCommand, clearStatusCommand, showStatusCommand]
};