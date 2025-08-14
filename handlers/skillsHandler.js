const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { images } = require('../config.json');

// Путь к файлу с данными
const DATA_FILE = path.join(__dirname, 'skillsData.json');

// Все доступные навыки
const SKILLS = [
  { id: 'strength', name: 'Сила', emoji: '<:sila:1404232366666289192>' },
  { id: 'shooting', name: 'Стрельба', emoji: '<:strelba:1404232378553073745>' },
  { id: 'cooking', name: 'Кулинария', emoji: '<:gotovka:1404232221950480436>' },
  { id: 'fishing', name: 'Рыболов', emoji: '<:ribalka:1404232355375353856>' },
  { id: 'hunting', name: 'Охота', emoji: '<:ohota:1404232274169430056>' },
  { id: 'port', name: 'Порт', emoji: '<:port:1404232325914558625>' },
  { id: 'construction', name: 'Стройка', emoji: '<:stroika:1404232389856854216>' },
  { id: 'mining', name: 'Шахтер', emoji: '<:haxta:1404232231446122526>' },
  { id: 'taxi', name: 'Таксист', emoji: '<:taxi:1404232403538542602>' },
  { id: 'farming', name: 'Фермер', emoji: '<:ferma:1404232210864799897>' },
  { id: 'treasure', name: 'Сокровищ.', emoji: '<:pois_sokrov:1404232312656232499>' },
  { id: 'diver', name: 'Дайвер', emoji: '<:ohota:1404232274169430056>' },
  { id: 'collector', name: 'Инкассатор', emoji: '<:inkosator:1404232242603098263>' },
  { id: 'busdriver', name: 'Автобус', emoji: '<:avtobusnik:1404232186206355609>' },
  { id: 'mechanic', name: 'Механик', emoji: '<:mexanik:1404232263800983663>' },
  { id: 'firefighter', name: 'Пожарный', emoji: '<:pozharnik:1404232344205787136>' },
  { id: 'trucker', name: 'Дальнобой', emoji: '<:daknoboi:1404232200395948042>' },
  { id: 'courier', name: 'Курьер', emoji: '<:kurier:1404232251662929932>' },
  { id: 'postman', name: 'Почтальон', emoji: '<:pochalion:1404232286873980948>' },
  { id: 'contractor', name: 'Подрядчик', emoji: '<:podryatchik:1404232301415632937>' }
];

// Загрузка данных из файла
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Ошибка загрузки данных навыков:', error);
  }
  return {};
}

// Сохранение данных в файл
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Ошибка сохранения данных навыков:', error);
  }
}

// Получение данных пользователя
function getUserData(userId) {
  const data = loadData();
  if (!data[userId]) {
    data[userId] = {
      characterName: '',
      skills: {}
    };
    // Инициализация всех навыков на 0
    SKILLS.forEach(skill => {
      data[userId].skills[skill.id] = 0;
    });
    saveData(data);
  }
  return data[userId];
}

// Обновление данных пользователя
function updateUserData(userId, userData) {
  const data = loadData();
  data[userId] = userData;
  saveData(data);
}

// Главная команда меню навыков
const menuData = {
  name: 'меню_навыков',
  description: 'Главное меню системы навыков'
};

async function executeMenu(interaction, client) {
  const embed = new EmbedBuilder()
    .setTitle('Система навыков ! Esser*')
    .setDescription('Добро пожаловать в систему навыков! Здесь вы можете управлять своими игровыми навыками и просматривать прогресс других игроков.')
    .setColor('#1D1D1E')
    .addFields(
      { name: '<:podryatchik:1404232301415632937> Доступные навыки', value: `${SKILLS.length} различных профессий`, inline: true },
      { name: '<:pozharnik:1404232344205787136> Максимальный уровень', value: '5 уровень', inline: true },
      { name: '<:pozharnik:1404232344205787136> Всего навыков', value: '20 типов', inline: true }
    )
    .setImage(images.skillsMenuBanner)
    .setFooter({ text: 'Выберите действие ниже', iconURL: client.user.displayAvatarURL() });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('skills_setup')
      .setLabel('⚙️ Настройка навыков')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('skills_view_own')
      .setLabel('👤 Мои навыки')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('skills_change_name')
      .setLabel('✏️ Сменить ник')
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('skills_commands')
      .setPlaceholder('Выберите команду навыков')
      .addOptions([
        {
          label: 'Настройка навыков',
          description: 'Настроить свои навыки и ник персонажа',
          value: 'setup',
          emoji: '⚙️'
        },
        {
          label: 'Сменить имя персонажа',
          description: 'Изменить имя своего персонажа',
          value: 'change_name',
          emoji: '✏️'
        },
        {
          label: 'Просмотр навыков игрока',
          description: 'Посмотреть навыки другого игрока',
          value: 'view_other',
          emoji: '🔍'
        },
        {
          label: 'Мои навыки',
          description: 'Показать ваши навыки',
          value: 'view_own',
          emoji: '👤'
        },
        {
          label: 'Помощь по командам',
          description: 'Список всех доступных команд',
          value: 'help',
          emoji: '❓'
        }
      ])
  );

  await interaction.reply({ embeds: [embed], components: [row1, row2] });
}

// Команда настройки навыков
const setupData = {
  name: 'настройканавыков',
  description: 'Настроить свои навыки и ник персонажа'
};

async function executeSetup(interaction, client) {
  const modal = new ModalBuilder()
    .setCustomId('skills_setup_modal')
    .setTitle('Настройка навыков персонажа');

  const characterNameInput = new TextInputBuilder()
    .setCustomId('character_name')
    .setLabel('Имя персонажа в игре')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(32);

  const skillTypeInput = new TextInputBuilder()
    .setCustomId('skill_type')
    .setLabel('Тип навыка (например: сила, стрельба)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('Доступные: сила, стрельба, кулинария, рыболовство...');

  const skillLevelInput = new TextInputBuilder()
    .setCustomId('skill_level')
    .setLabel('Уровень навыка (0-5)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('Введите число от 0 до 5');

  const firstRow = new ActionRowBuilder().addComponents(characterNameInput);
  const secondRow = new ActionRowBuilder().addComponents(skillTypeInput);
  const thirdRow = new ActionRowBuilder().addComponents(skillLevelInput);

  modal.addComponents(firstRow, secondRow, thirdRow);
  await interaction.showModal(modal);
}

// Команда смены ника персонажа
const changeNameData = {
  name: 'навыки_имя_персонажа',
  description: 'Сменить имя персонажа'
};

async function executeChangeName(interaction, client) {
  const modal = new ModalBuilder()
    .setCustomId('skills_change_name_modal')
    .setTitle('Смена имени персонажа');

  const newNameInput = new TextInputBuilder()
    .setCustomId('new_character_name')
    .setLabel('Новое имя персонажа')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(32);

  const firstRow = new ActionRowBuilder().addComponents(newNameInput);
  modal.addComponents(firstRow);
  await interaction.showModal(modal);
}

// Команда просмотра навыков пользователя
const viewSkillsData = {
  name: 'навыки',
  description: 'Просмотреть навыки пользователя',
  options: [
    {
      name: 'пользователь',
      description: 'Пользователь, чьи навыки нужно посмотреть',
      type: 6, // USER type
      required: true
    }
  ]
};

async function executeViewSkills(interaction, client) {
  const targetUser = interaction.options.getUser('пользователь');
  const userData = getUserData(targetUser.id);

  if (!userData.characterName) {
    return interaction.reply({
      content: `❌ У пользователя ${targetUser.username} не настроен персонаж.`
    });
  }

  const embed = createSkillsEmbed(targetUser, userData, client);
  await interaction.reply({ embeds: [embed] });
}

// Создание embed с навыками (все навыки в одном сообщении)
function createSkillsEmbed(user, userData, client) {
  const embed = new EmbedBuilder()
    .setTitle(`🎮 Навыки » ${userData.characterName}`)
    .setDescription(`(!) Информация о навыках персонажа ${userData.characterName}`)
    .setColor('#1D1D1E')
    .setThumbnail(user.displayAvatarURL())
    .setFooter({ text: `${client.user.username} • Система навыков`, iconURL: client.user.displayAvatarURL() });

  // Разбиваем все навыки на 3 колонки
  const columns = [[], [], []];
  SKILLS.forEach((skill, index) => {
    const columnIndex = index % 3;
    const level = userData.skills[skill.id] || 0;
    columns[columnIndex].push(`${skill.emoji} ${skill.name}: **${level}/5**`);
  });

  // Добавляем колонки в embed
  columns.forEach((column, columnIndex) => {
    if (column.length > 0) {
      embed.addFields({
        name: '\u200b', // Невидимый символ для пустого заголовка
        value: column.join('\n\n'),
        inline: true
      });
    }
  });

  // Добавляем настройки
  embed.addFields({
    name: '\u200b', // Пустая строка для отступа
    value: '',
    inline: false
  });
  
  embed.addFields({
    name: '<:podryatchik:1404232301415632937> Настройки',
    value: `**Настроенных навыков:** ${Object.values(userData.skills).filter(level => level > 0).length}/${SKILLS.length}`,
    inline: false
  });

  return embed;
}

// Обработка компонентов (кнопки, модалки)
async function handleComponent(interaction, client) {
  if (interaction.isButton()) {
    switch (interaction.customId) {
      case 'skills_setup':
        await executeSetup(interaction, client);
        return true;
      case 'skills_view_own':
        const userData = getUserData(interaction.user.id);
        if (!userData.characterName) {
          await interaction.reply({
            content: '❌ У вас не настроен персонаж. Используйте `/настройканавыков`',
            ephemeral: true
        });
          return true;
        }
        const embed = createSkillsEmbed(interaction.user, userData, client);
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return true;
      case 'skills_change_name':
        await executeChangeName(interaction, client);
        return true;
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'skills_setup_modal') {
      const characterName = interaction.fields.getTextInputValue('character_name');
      const skillType = interaction.fields.getTextInputValue('skill_type').toLowerCase();
      const skillLevel = parseInt(interaction.fields.getTextInputValue('skill_level'));

      // Проверка уровня
      if (isNaN(skillLevel) || skillLevel < 0 || skillLevel > 5) {
        await interaction.reply({
          content: '❌ Уровень навыка должен быть числом от 0 до 5',
          ephemeral: true
        });
        return true;
      }

      // Поиск навыка
      const skill = SKILLS.find(s => s.name.toLowerCase() === skillType || s.id === skillType);
      if (!skill) {
        await interaction.reply({
          content: `❌ Неизвестный навык: ${skillType}\n\nДоступные навыки:\n${SKILLS.map(s => `• ${s.name}`).join('\n')}`,
          ephemeral: true
        });
        return true;
      }

      // Обновление данных
      const userData = getUserData(interaction.user.id);
      userData.characterName = characterName;
      userData.skills[skill.id] = skillLevel;
      updateUserData(interaction.user.id, userData);

      const embed = new EmbedBuilder()
        .setTitle('✅ Навык обновлен!')
        .setDescription(`**Персонаж:** ${characterName}\n**Навык:** ${skill.emoji} ${skill.name}\n**Уровень:** ${skillLevel}/5`)
        .setColor('#00FF00');

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return true;
    }

    if (interaction.customId === 'skills_change_name_modal') {
      const newName = interaction.fields.getTextInputValue('new_character_name');
      
      const userData = getUserData(interaction.user.id);
      userData.characterName = newName;
      updateUserData(interaction.user.id, userData);

      const embed = new EmbedBuilder()
        .setTitle('✅ Имя персонажа изменено!')
        .setDescription(`Новое имя: **${newName}**`)
        .setColor('#00FF00');

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return true;
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'skills_commands') {
      const selectedCommand = interaction.values[0];
      
      switch (selectedCommand) {
        case 'setup':
          await executeSetup(interaction, client);
          return true;
        case 'change_name':
          await executeChangeName(interaction, client);
          return true;
        case 'view_other':
          await interaction.reply({
            content: '🔍 Используйте команду `/навыки @пользователь` для просмотра навыков другого игрока.',
            ephemeral: true
          });
          return true;
        case 'view_own':
          const userData = getUserData(interaction.user.id);
          if (!userData.characterName) {
            await interaction.reply({
              content: '❌ У вас не настроен персонаж. Используйте `/настройканавыков`',
              ephemeral: true
            });
            return true;
          }
          const embed = createSkillsEmbed(interaction.user, userData, client);
          await interaction.reply({ embeds: [embed], ephemeral: true });
          return true;
        case 'help':
          await interaction.reply({
            content: '💡 **Доступные команды навыков:**\n• `/меню_навыков` - главное меню\n• `/настройканавыков` - настроить навыки\n• `/навыки_имя_персонажа` - сменить имя\n• `/навыки @пользователь` - посмотреть навыки игрока\n\n**Доступные навыки:**\n' + SKILLS.map(s => `${s.emoji} ${s.name}`).join(', '),
            ephemeral: true
          });
          return true;
      }
    }
  }
  return false;
}

// Вспомогательные функции
function getCategorySkills(category) {
  const categoryMap = {
    'combat': ['strength', 'shooting', 'hunting'],
    'professions': ['cooking', 'taxi', 'mechanic', 'firefighter', 'contractor'],
    'transport': ['busdriver', 'trucker', 'courier', 'postman'],
    'resources': ['fishing', 'mining', 'farming', 'diver'],
    'special': ['port', 'construction', 'treasure', 'collector']
  };

  const skillIds = categoryMap[category] || [];
  return skillIds.map(id => SKILLS.find(s => s.id === id)).filter(Boolean);
}

function getCategoryName(category) {
  const names = {
    'combat': 'Боевые навыки',
    'professions': 'Профессии',
    'transport': 'Транспорт',
    'resources': 'Добыча ресурсов',
    'special': 'Специальные'
  };
  return names[category] || category;
}

module.exports = {
  menuData,
  setupData,
  changeNameData,
  viewSkillsData,
  executeMenu,
  executeSetup,
  executeChangeName,
  executeViewSkills,
  handleComponent,
  getUserData,
  updateUserData,
  SKILLS
};