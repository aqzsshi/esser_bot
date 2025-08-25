const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Список карт для World of Tanks
const MAPS = [
    'Химмельсдорф', 'Эрленберг', 'Маллиновка', 'Прованс', 'Харьков',
    'Степи', 'Энск', 'Ласвилль', 'Руинберг', 'Зигфрид Линия',
    'Вестфилд', 'Дорога', 'Курильские острова', 'Сердце России', 'Париж',
    'Берлин', 'Лондон', 'Нормандия', 'Африканский корпус', 'Италия',
    'Польша', 'Чехия', 'Словакия', 'Венгрия', 'Румыния',
    'Болгария', 'Греция', 'Турция', 'Иран', 'Ирак', 'Сирия'
];

// Загрузка конфигурации серверов
function loadServerConfigs() {
    try {
        const configPath = path.join(__dirname, 'serverConfigs.json');
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch (error) {
        console.error('Ошибка загрузки конфигурации серверов:', error);
    }
    return {};
}

// Сохранение конфигурации серверов
function saveServerConfigs(configs) {
    try {
        const configPath = path.join(__dirname, 'serverConfigs.json');
        fs.writeFileSync(configPath, JSON.stringify(configs, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Ошибка сохранения конфигурации серверов:', error);
        return false;
    }
}

// Проверка прав администратора
function hasAdminPermissions(member) {
    return member.permissions.has(PermissionFlagsBits.Administrator) || 
           member.permissions.has(PermissionFlagsBits.ManageGuild) ||
           member.roles.cache.some(role => role.permissions.has(PermissionFlagsBits.Administrator));
}

// Команда /вс - выбор карты и результата
const vsCommand = {
    data: new SlashCommandBuilder()
        .setName('вс')
        .setDescription('Отчет о результате игры на карте'),
    
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        const configs = loadServerConfigs();
        const serverConfig = configs[guildId];

        if (!serverConfig || !serverConfig.gameResults) {
            await interaction.reply({
                content: '❌ Модуль отчетности результатов игр не настроен для этого сервера. Администратор должен использовать команду `/вс_настройка` для настройки.',
                ephemeral: true
            });
            return;
        }

        // Создаем селект меню для выбора карты
        const mapSelect = new StringSelectMenuBuilder()
            .setCustomId('map_select')
            .setPlaceholder('Выберите карту')
            .addOptions(
                MAPS.map((map, index) => ({
                    label: map,
                    value: map,
                    description: `Карта ${index + 1}`
                }))
            );

        const mapRow = new ActionRowBuilder().addComponents(mapSelect);

        await interaction.reply({
            content: '🎮 Выберите карту для отчета о результате игры:',
            components: [mapRow],
            ephemeral: true
        });
    },

    async handleComponent(interaction, client) {
        if (interaction.customId === 'map_select') {
            const selectedMap = interaction.values[0];
            
            // Создаем кнопки для выбора результата
            const winButton = new ButtonBuilder()
                .setCustomId(`result_win_${selectedMap}`)
                .setLabel('🏆 Победа')
                .setStyle(ButtonStyle.Success);

            const loseButton = new ButtonBuilder()
                .setCustomId(`result_lose_${selectedMap}`)
                .setLabel('💀 Поражение')
                .setStyle(ButtonStyle.Danger);

            const resultRow = new ActionRowBuilder().addComponents(winButton, loseButton);

            await interaction.update({
                content: `🎯 Выбрана карта: **${selectedMap}**\nТеперь выберите результат игры:`,
                components: [resultRow]
            });
            return true;
        }

        if (interaction.customId.startsWith('result_')) {
            const [, result, map] = interaction.customId.split('_');
            const guildId = interaction.guildId;
            const configs = loadServerConfigs();
            const serverConfig = configs[guildId];

            if (!serverConfig || !serverConfig.gameResults) {
                await interaction.update({
                    content: '❌ Конфигурация не найдена. Обратитесь к администратору.',
                    components: []
                });
                return true;
            }

            try {
                // Отправляем отчет в указанный канал
                const channel = await client.channels.fetch(serverConfig.gameResults.channelId);
                if (!channel) {
                    await interaction.update({
                        content: '❌ Канал для отчетов не найден. Обратитесь к администратору.',
                        components: []
                    });
                    return true;
                }

                // Создаем embed сообщение
                const embed = new EmbedBuilder()
                    .setColor(result === 'win' ? '#00ff00' : '#ff0000')
                    .setTitle(`🎮 Результат игры на карте ${map}`)
                    .setDescription(`**Результат:** ${result === 'win' ? '🏆 Победа' : '💀 Поражение'}`)
                    .addFields(
                        { name: '👤 Игрок', value: interaction.user.toString(), inline: true },
                        { name: '🗺️ Карта', value: map, inline: true },
                        { name: '📅 Дата', value: new Date().toLocaleString('ru-RU'), inline: true }
                    )
                    .setThumbnail(result === 'win' ? serverConfig.gameResults.winPhotoUrl : serverConfig.gameResults.losePhotoUrl)
                    .setFooter({ text: 'Отчет о результате игры' })
                    .setTimestamp();

                await channel.send({ embeds: [embed] });

                await interaction.update({
                    content: `✅ Отчет о ${result === 'win' ? 'победе' : 'поражении'} на карте **${map}** успешно отправлен!`,
                    components: []
                });

            } catch (error) {
                console.error('Ошибка при отправке отчета:', error);
                await interaction.update({
                    content: '❌ Произошла ошибка при отправке отчета. Попробуйте позже.',
                    components: []
                });
            }
            return true;
        }

        return false;
    }
};

// Команда /вс_настройка - настройка модуля
const vsSetupCommand = {
    data: new SlashCommandBuilder()
        .setName('вс_настройка')
        .setDescription('Настройка модуля отчетности результатов игр (только для администраторов)')
        .addChannelOption(option =>
            option.setName('канал')
                .setDescription('Канал для отправки отчетов о результатах игр')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('фото_победы')
                .setDescription('Ссылка на фото для победы')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('фото_поражения')
                .setDescription('Ссылка на фото для поражения')
                .setRequired(true)),
    
    async execute(interaction, client) {
        // Проверка прав администратора
        if (!hasAdminPermissions(interaction.member)) {
            await interaction.reply({
                content: '❌ У вас недостаточно прав для использования этой команды. Требуются права администратора.',
                ephemeral: true
            });
            return;
        }

        const channel = interaction.options.getChannel('канал');
        const winPhotoUrl = interaction.options.getString('фото_победы');
        const losePhotoUrl = interaction.options.getString('фото_поражения');

        // Валидация ссылок на фото
        if (!winPhotoUrl.startsWith('http') || !losePhotoUrl.startsWith('http')) {
            await interaction.reply({
                content: '❌ Ссылки на фото должны начинаться с http:// или https://',
                ephemeral: true
            });
            return;
        }

        try {
            const guildId = interaction.guildId;
            const configs = loadServerConfigs();
            
            if (!configs[guildId]) {
                configs[guildId] = {};
            }

            // Обновляем конфигурацию
            configs[guildId].gameResults = {
                channelId: channel.id,
                winPhotoUrl: winPhotoUrl,
                losePhotoUrl: losePhotoUrl
            };

            // Сохраняем конфигурацию
            if (saveServerConfigs(configs)) {
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ Настройка модуля отчетности завершена')
                    .addFields(
                        { name: '📺 Канал для отчетов', value: channel.toString(), inline: true },
                        { name: '🏆 Фото победы', value: winPhotoUrl, inline: true },
                        { name: '💀 Фото поражения', value: losePhotoUrl, inline: true }
                    )
                    .setDescription('Теперь игроки могут использовать команду `/вс` для отправки отчетов о результатах игр.')
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({
                    content: '❌ Произошла ошибка при сохранении настроек. Попробуйте позже.',
                    ephemeral: true
                });
            }

        } catch (error) {
            console.error('Ошибка при настройке модуля отчетности:', error);
            await interaction.reply({
                content: '❌ Произошла ошибка при настройке модуля. Попробуйте позже.',
                ephemeral: true
            });
        }
    }
};

module.exports = {
    commands: [vsCommand, vsSetupCommand]
};