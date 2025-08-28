const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Список карт для World of Tanks, разбитый на категории
const MAP_CATEGORIES = {
    'Классические карты': [
        'Химмельсдорф', 'Эрленберг', 'Маллиновка', 'Прованс', 'Харьков',
        'Степи', 'Энск', 'Ласвилль', 'Руинберг', 'Зигфрид Линия'
    ],
    'Современные карты': [
        'Вестфилд', 'Дорога', 'Курильские острова', 'Сердце России', 'Париж',
        'Берлин', 'Лондон', 'Нормандия', 'Африканский корпус', 'Италия'
    ],
    'Европейские карты': [
        'Польша', 'Чехия', 'Словакия', 'Венгрия', 'Румыния',
        'Болгария', 'Греция', 'Турция', 'Иран', 'Ирак', 'Сирия'
    ]
};

// Загрузка конфигурации серверов
function loadServerConfigs() {
    try {
        const configPath = path.join(__dirname, 'serverConfigs.json');
        
        // Если файл не существует, создаем новый с базовой структурой
        if (!fs.existsSync(configPath)) {
            console.log('Файл serverConfigs.json не найден, создаем новый...');
            const defaultConfig = {};
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        
        // Читаем существующий файл
        const data = fs.readFileSync(configPath, 'utf8');
        
        // Проверяем, что файл содержит валидный JSON
        let configs;
        try {
            configs = JSON.parse(data);
        } catch (parseError) {
            console.error('Файл serverConfigs.json поврежден, создаем новый...');
            const defaultConfig = {};
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        
        // Проверяем, что это объект
        if (typeof configs !== 'object' || configs === null) {
            console.error('Файл serverConfigs.json содержит неверную структуру, создаем новый...');
            const defaultConfig = {};
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        
        return configs;
    } catch (error) {
        console.error('Критическая ошибка при загрузке конфигураций серверов:', error);
        console.log('Создаем новый файл конфигурации...');
        
        try {
            const configPath = path.join(__dirname, 'serverConfigs.json');
            const defaultConfig = {};
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        } catch (createError) {
            console.error('Не удалось создать файл конфигурации:', createError);
            return {};
        }
    }
}

// Сохранение конфигурации серверов
function saveServerConfigs(configs) {
    try {
        const configPath = path.join(__dirname, 'serverConfigs.json');
        
        // Создаем резервную копию перед сохранением
        if (fs.existsSync(configPath)) {
            const backupPath = configPath + '.backup';
            fs.copyFileSync(configPath, backupPath);
        }
        
        // Сохраняем новую конфигурацию
        fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
        
        // Удаляем резервную копию после успешного сохранения
        const backupPath = configPath + '.backup';
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
        }
        
        return true;
    } catch (error) {
        console.error('Ошибка при сохранении конфигураций серверов:', error);
        
        // Пытаемся восстановить из резервной копии
        try {
            const configPath = path.join(__dirname, 'serverConfigs.json');
            const backupPath = configPath + '.backup';
            if (fs.existsSync(backupPath)) {
                fs.copyFileSync(backupPath, configPath);
                console.log('Восстановлена резервная копия конфигурации');
            }
        } catch (restoreError) {
            console.error('Не удалось восстановить резервную копию:', restoreError);
        }
        
        return false;
    }
}

// Проверка прав администратора или владельца бота (Owner (имя бота))
const BOT_OWNER_ID = '680481711028437020';
function hasAdminPermissions(member) {
    if (!member) return false;
    if (member.user?.id === BOT_OWNER_ID) return true;
    const hasOwnerRole = member.roles?.cache?.some(r => r.name.startsWith('Owner ('));
    if (hasOwnerRole) return true;
    return member.permissions.has(PermissionFlagsBits.Administrator) || 
           member.permissions.has(PermissionFlagsBits.ManageGuild) ||
           member.roles.cache.some(role => role.permissions.has(PermissionFlagsBits.Administrator));
}

function hasSubmitPermissions(member, submitterRoleIds) {
    if (hasAdminPermissions(member)) return true;
    if (!Array.isArray(submitterRoleIds) || submitterRoleIds.length === 0) return false;
    return member.roles.cache.some(role => submitterRoleIds.includes(role.id));
}

// Функция для получения списка участников сервера с нужными ролями
function getServerMembers(guild, allowedRoleIds) {
    const members = [];
    
    guild.members.cache.forEach(member => {
        if (!member.user.bot) {
            // Проверяем, есть ли у участника хотя бы одна из разрешенных ролей
            const hasAllowedRole = member.roles.cache.some(role => 
                allowedRoleIds.includes(role.id)
            );
            
            if (hasAllowedRole) {
                members.push({
                    label: member.displayName || member.user.username,
                    value: member.id,
                    description: `@${member.user.username}`,
                    emoji: '👤'
                });
            }
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

        // Проверяем права пользователя на отправку отчетов
        const submitterRoleIds = serverConfig.gameResults.submitterRoleIds || [];
        if (!hasSubmitPermissions(interaction.member, submitterRoleIds)) {
            await interaction.reply({
                content: '❌ У вас нет прав для заполнения отчетов. Обратитесь к администратору.',
                flags: 64
            });
            return;
        }

        // Создаем селект меню для выбора категории карт
        const categorySelect = new StringSelectMenuBuilder()
            .setCustomId('category_select')
            .setPlaceholder('Выберите категорию карт')
            .addOptions(
                Object.keys(MAP_CATEGORIES).map((category, index) => ({
                    label: category,
                    value: category,
                    description: `${MAP_CATEGORIES[category].length} карт`
                }))
            );

        const categoryRow = new ActionRowBuilder().addComponents(categorySelect);

        await interaction.reply({
            content: '🎮 **Отчет о результате игры**\n\nВыберите категорию карт для создания отчета:',
            components: [categoryRow],
            flags: 64
        });
    },

    async handleComponent(interaction, client) {
        if (interaction.customId === 'category_select') {
            const selectedCategory = interaction.values[0];
            const maps = MAP_CATEGORIES[selectedCategory];
            
            // Создаем селект меню для выбора карты из выбранной категории
            const mapSelect = new StringSelectMenuBuilder()
                .setCustomId('map_select')
                .setPlaceholder(`Выберите карту из категории "${selectedCategory}"`)
                .addOptions(
                    maps.map((map, index) => ({
                        label: map,
                        value: `${selectedCategory}:${map}`,
                        description: `Карта ${index + 1}`
                    }))
                );

            const mapRow = new ActionRowBuilder().addComponents(mapSelect);

            await interaction.update({
                content: `🗺️ **Выбрана категория:** ${selectedCategory}\n\nТеперь выберите конкретную карту:`,
                components: [mapRow]
            });
            return true;
        }

        if (interaction.customId === 'map_select') {
            const [category, selectedMap] = interaction.values[0].split(':');
            
            // Кнопки выбора типа боя: Дефф / Атака
            const defBtn = new ButtonBuilder()
                .setCustomId(`cat_def_${selectedMap}`)
                .setLabel('🛡️ Дефф')
                .setStyle(ButtonStyle.Secondary);

            const atkBtn = new ButtonBuilder()
                .setCustomId(`cat_atk_${selectedMap}`)
                .setLabel('⚔️ Атака')
                .setStyle(ButtonStyle.Secondary);

            const catRow = new ActionRowBuilder().addComponents(defBtn, atkBtn);

            await interaction.update({
                content: `🎯 **Выбрана карта:** ${selectedMap} (${category})\n\nВыберите тип боя:`,
                components: [catRow]
            });
            return true;
        }

        // Выбор категории боя
        if (interaction.customId.startsWith('cat_')) {
            const [, cat, map] = interaction.customId.split('_'); // cat: def|atk

            const winButton = new ButtonBuilder()
                .setCustomId(`result_win_${cat}_${map}`)
                .setLabel('🏆 Победа')
                .setStyle(ButtonStyle.Success);

            const loseButton = new ButtonBuilder()
                .setCustomId(`result_lose_${cat}_${map}`)
                .setLabel('💀 Поражение')
                .setStyle(ButtonStyle.Danger);

            const resultRow = new ActionRowBuilder().addComponents(winButton, loseButton);

            await interaction.update({
                content: `🛡️⚔️ **Тип боя:** ${cat === 'def' ? 'Дефф' : 'Атака'}\nТеперь выберите результат игры:`,
                components: [resultRow]
            });
            return true;
        }

        // Выбор результата
        if (interaction.customId.startsWith('result_')) {
            const [, result, cat, map] = interaction.customId.split('_');
            
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

            // Получаем список участников сервера с нужными ролями
            const members = getServerMembers(interaction.guild, serverConfig.gameResults.allowedRoleIds || []);
            
            if (members.length === 0) {
                await interaction.update({
                    content: '❌ Не найдено участников с разрешенными ролями. Обратитесь к администратору для настройки ролей.',
                    components: []
                });
                return true;
            }

            // Создаем селект меню для выбора игроков
            const playersSelect = new StringSelectMenuBuilder()
                .setCustomId(`players_select_${cat}_${result}_${map}`)
                .setPlaceholder('Выберите игроков (можно выбрать несколько)')
                .setMinValues(1)
                .setMaxValues(Math.min(members.length, 10))
                .addOptions(members);

            const playersRow = new ActionRowBuilder().addComponents(playersSelect);

            await interaction.update({
                content: `🎮 **Выбран результат:** ${result === 'win' ? '🏆 Победа' : '💀 Поражение'}\n**Тип боя:** ${cat === 'def' ? 'Дефф' : 'Атака'}\n\nТеперь выберите игроков, участвовавших в игре:`,
                components: [playersRow]
            });
            return true;
        }

        if (interaction.customId.startsWith('players_select_')) {
            const [, , cat, result, map] = interaction.customId.split('_');
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

                // Упоминания игроков
                const mentionList = selectedPlayerIds.map(id => `• <@${id}>`).join('\n');

                // Создаем embed сообщение с большим фото снизу
                const embed = new EmbedBuilder()
                    .setColor(result === 'win' ? '#00ff00' : '#ff0000')
                    .setTitle(`🎮 Результат игры на карте ${map}`)
                    .setDescription(`**Тип боя:** ${cat === 'def' ? 'Дефф' : 'Атака'}\n**Результат:** ${result === 'win' ? '🏆 Победа' : '💀 Поражение'}`)
                    .addFields(
                        { name: '👥 Участники', value: mentionList, inline: false },
                        { name: '🗺️ Карта', value: map, inline: true },
                        { name: '📅 Дата', value: new Date().toLocaleString('ru-RU'), inline: true },
                        { name: '📝 Отчет составил', value: interaction.user.toString(), inline: true }
                    )
                    .setImage(result === 'win' ? serverConfig.gameResults.winPhotoUrl : serverConfig.gameResults.losePhotoUrl)
                    .setFooter({ text: 'Отчет о результате игры' })
                    .setTimestamp();

                const sent = await channel.send({ embeds: [embed] });

                await interaction.update({
                    content: `✅ **Отчет успешно отправлен!**\n\n**Карта:** ${map}\n**Тип боя:** ${cat === 'def' ? 'Дефф' : 'Атака'}\n**Результат:** ${result === 'win' ? 'Победа' : 'Поражение'}\n**Игроки:** ${selectedPlayerIds.length}\n**Канал:** ${channel.toString()}`,
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
            option.setName('роли_заполнения')
                .setDescription('ID ролей (через запятую), кто может заполнять отчеты')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('роли_списка')
                .setDescription('ID ролей (через запятую), кто будет отображаться в списке игроков')
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
        const submitRolesText = interaction.options.getString('роли_заполнения');
        const listRolesText = interaction.options.getString('роли_списка');
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

        // Разбираем ID ролей
        const parseIds = (text) => (text || '')
            .split(',')
            .map(id => id.trim())
            .filter(id => /^\d+$/.test(id));

        const submitterRoleIds = parseIds(submitRolesText);
        const allowedRoleIds = parseIds(listRolesText);
        
        if (submitterRoleIds.length === 0) {
            await interaction.reply({
                content: '❌ Укажите хотя бы одну роль, которая может заполнять отчеты (роли_заполнения).',
                flags: 64
            });
            return;
        }
        if (allowedRoleIds.length === 0) {
            await interaction.reply({
                content: '❌ Укажите хотя бы одну роль для списка игроков (роли_списка).',
                flags: 64
            });
            return;
        }

        // Проверяем, что роли существуют на сервере (только информативно)
        const invalidSubmit = [];
        for (const id of submitterRoleIds) {
            try { const r = await interaction.guild.roles.fetch(id); if (!r) invalidSubmit.push(id); } catch { invalidSubmit.push(id); }
        }
        const invalidList = [];
        for (const id of allowedRoleIds) {
            try { const r = await interaction.guild.roles.fetch(id); if (!r) invalidList.push(id); } catch { invalidList.push(id); }
        }

        if (invalidSubmit.length > 0 || invalidList.length > 0) {
            await interaction.reply({
                content: `⚠️ Некоторые роли не найдены.\nОтправители: ${invalidSubmit.length ? invalidSubmit.join(', ') : 'все найдены'}\nСписок: ${invalidList.length ? invalidList.join(', ') : 'все найдены'}\nНастройки будут сохранены без отсутствующих ролей.`,
                flags: 64
            });
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
                submitterRoleIds: submitterRoleIds.filter(id => !invalidSubmit.includes(id)),
                allowedRoleIds: allowedRoleIds.filter(id => !invalidList.includes(id)),
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
                        { name: '✍️ Роли, кто может заполнять', value: submitterRoleIds.filter(id => !invalidSubmit.includes(id)).map(id => `<@&${id}>`).join(', '), inline: false },
                        { name: '👥 Роли списка игроков', value: allowedRoleIds.filter(id => !invalidList.includes(id)).map(id => `<@&${id}>`).join(', '), inline: false },
                        { name: '🏆 Фото победы', value: winPhotoUrl, inline: true },
                        { name: '💀 Фото поражения', value: losePhotoUrl, inline: true }
                    )
                    .setDescription('Теперь игроки могут использовать команду `/вс` для отправки отчетов о результатах игр.')
                    .setTimestamp();

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ embeds: [embed], flags: 64 });
                } else {
                    await interaction.reply({ embeds: [embed], flags: 64 });
                }
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