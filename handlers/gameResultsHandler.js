const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Список карт для World of Tanks (31 карта)
const MAPS = [
    'Химмельсдорф', 'Эрленберг', 'Маллиновка', 'Прованс', 'Харьков',
    'Степи', 'Энск', 'Ласвилль', 'Руинберг', 'Зигфрид Линия',
    'Вестфилд', 'Дорога', 'Курильские острова', 'Сердце России', 'Париж',
    'Берлин', 'Лондон', 'Нормандия', 'Африканский корпус', 'Италия',
    'Польша', 'Чехия', 'Словакия', 'Венгрия', 'Румыния',
    'Болгария', 'Греция', 'Турция', 'Иран', 'Ирак', 'Сирия'
];

// Разбиваем карты на два меню (Discord.js лимит: 25 опций)
const MAPS_PART1 = MAPS.slice(0, 16); // Первые 16 карт
const MAPS_PART2 = MAPS.slice(16);     // Оставшиеся 15 карт

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

// Функция для получения списка участников сервера
function getServerMembers(guild) {
    const members = [];
    guild.members.cache.forEach(member => {
        if (!member.user.bot) {
            members.push({
                label: member.displayName || member.user.username,
                value: member.id,
                description: `@${member.user.username}`,
                emoji: '👤'
            });
        }
    });
    
    // Сортируем по алфавиту
    members.sort((a, b) => a.label.localeCompare(b.label));
    
    // Ограничиваем до 25 участников (лимит Discord.js)
    return members.slice(0, 25);
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
                flags: 64
            });
            return;
        }

        // Создаем кнопки для выбора части карт
        const part1Button = new ButtonBuilder()
            .setCustomId('maps_part1')
            .setLabel('Карты 1-16')
            .setStyle(ButtonStyle.Primary);

        const part2Button = new ButtonBuilder()
            .setCustomId('maps_part2')
            .setLabel('Карты 17-31')
            .setStyle(ButtonStyle.Primary);

        const mapsRow = new ActionRowBuilder().addComponents(part1Button, part2Button);

        await interaction.reply({
            content: '🎮 **Отчет о результате игры**\n\nВыберите группу карт:',
            components: [mapsRow],
            flags: 64
        });
    },

    async handleComponent(interaction, client) {
        if (interaction.customId === 'maps_part1') {
            // Создаем селект меню для первых 16 карт
            const mapSelect = new StringSelectMenuBuilder()
                .setCustomId('map_select')
                .setPlaceholder('Выберите карту (1-16)')
                .addOptions(
                    MAPS_PART1.map((map, index) => ({
                        label: map,
                        value: map,
                        description: `Карта ${index + 1}`
                    }))
                );

            const mapRow = new ActionRowBuilder().addComponents(mapSelect);

            await interaction.update({
                content: '🗺️ **Группа карт 1-16**\n\nВыберите конкретную карту:',
                components: [mapRow]
            });
            return true;
        }

        if (interaction.customId === 'maps_part2') {
            // Создаем селект меню для оставшихся 15 карт
            const mapSelect = new StringSelectMenuBuilder()
                .setCustomId('map_select')
                .setPlaceholder('Выберите карту (17-31)')
                .addOptions(
                    MAPS_PART2.map((map, index) => ({
                        label: map,
                        value: map,
                        description: `Карта ${index + 17}`
                    }))
                );

            const mapRow = new ActionRowBuilder().addComponents(mapSelect);

            await interaction.update({
                content: '🗺️ **Группа карт 17-31**\n\nВыберите конкретную карту:',
                components: [mapRow]
            });
            return true;
        }

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
                content: `🎯 **Выбрана карта:** ${selectedMap}\n\nТеперь выберите результат игры:`,
                components: [resultRow]
            });
            return true;
        }

        if (interaction.customId.startsWith('result_')) {
            const [, result, map] = interaction.customId.split('_');
            
            // Получаем список участников сервера
            const members = getServerMembers(interaction.guild);
            
            if (members.length === 0) {
                await interaction.update({
                    content: '❌ Не удалось получить список участников сервера.',
                    components: []
                });
                return true;
            }

            // Создаем селект меню для выбора игроков
            const playersSelect = new StringSelectMenuBuilder()
                .setCustomId(`players_select_${result}_${map}`)
                .setPlaceholder('Выберите игроков (можно выбрать несколько)')
                .setMinValues(1)
                .setMaxValues(Math.min(members.length, 10)) // Максимум 10 игроков
                .addOptions(members);

            const playersRow = new ActionRowBuilder().addComponents(playersSelect);

            await interaction.update({
                content: `🎮 **Выбран результат:** ${result === 'win' ? '🏆 Победа' : '💀 Поражение'}\n**Карта:** ${map}\n\nТеперь выберите игроков, участвовавших в игре:`,
                components: [playersRow]
            });
            return true;
        }

        if (interaction.customId.startsWith('players_select_')) {
            const [, , result, map] = interaction.customId.split('_');
            const selectedPlayerIds = interaction.values;
            
            if (selectedPlayerIds.length === 0) {
                await interaction.update({
                    content: '❌ Не выбрано ни одного игрока.',
                    components: []
                });
                return true;
            }

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

                // Получаем информацию об игроках
                const players = selectedPlayerIds.map(id => {
                    const member = interaction.guild.members.cache.get(id);
                    return member ? member.displayName || member.user.username : `ID: ${id}`;
                });

                // Создаем embed сообщение с большим фото снизу
                const embed = new EmbedBuilder()
                    .setColor(result === 'win' ? '#00ff00' : '#ff0000')
                    .setTitle(`🎮 Результат игры на карте ${map}`)
                    .setDescription(`**Результат:** ${result === 'win' ? '🏆 Победа' : '💀 Поражение'}`)
                    .addFields(
                        { name: '👥 Участники', value: players.map(p => `• ${p}`).join('\n'), inline: false },
                        { name: '🗺️ Карта', value: map, inline: true },
                        { name: '📅 Дата', value: new Date().toLocaleString('ru-RU'), inline: true },
                        { name: '📝 Отчет составил', value: interaction.user.toString(), inline: true }
                    )
                    .setImage(result === 'win' ? serverConfig.gameResults.winPhotoUrl : serverConfig.gameResults.losePhotoUrl)
                    .setFooter({ text: 'Отчет о результате игры' })
                    .setTimestamp();

                await channel.send({ embeds: [embed] });

                await interaction.update({
                    content: `✅ **Отчет успешно отправлен!**\n\n**Карта:** ${map}\n**Результат:** ${result === 'win' ? 'Победа' : 'Поражение'}\n**Игроки:** ${players.length}\n**Канал:** ${channel.toString()}`,
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
                flags: 64
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
                flags: 64
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

                await interaction.reply({ embeds: [embed], flags: 64 });
            } else {
                await interaction.reply({
                    content: '❌ Произошла ошибка при сохранении настроек. Попробуйте позже.',
                    flags: 64
                });
            }

        } catch (error) {
            console.error('Ошибка при настройке модуля отчетности:', error);
            await interaction.reply({
                content: '❌ Произошла ошибка при настройке модуля. Попробуйте позже.',
                flags: 64
            });
        }
    }
};

module.exports = {
    commands: [vsCommand, vsSetupCommand]
};