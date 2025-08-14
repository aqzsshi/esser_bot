const { getUserData, updateUserData, SKILLS } = require('./skillsHandler');
const { EmbedBuilder } = require('discord.js');

// Команда смены имени персонажа
const changeNameData = {
  name: 'навыки_админ_смена_имени',
  description: 'Админ команда для смены имени персонажа',
  options: [
    {
      name: 'пользователь',
      description: 'Пользователь, которому нужно сменить имя',
      type: 6, // USER
      required: true
    },
    {
      name: 'новое_имя',
      description: 'Новое имя персонажа',
      type: 3, // STRING
      required: true
    }
  ]
};

// Команда смены уровня навыка
const changeLevelData = {
  name: 'навыки_админ_смена_уровня',
  description: 'Админ команда для изменения уровня навыка',
  options: [
    {
      name: 'пользователь',
      description: 'Пользователь, которому нужно изменить навык',
      type: 6, // USER
      required: true
    },
    {
      name: 'навык',
      description: 'Название навыка (например: сила, стрельба)',
      type: 3, // STRING
      required: true
    },
    {
      name: 'уровень',
      description: 'Новый уровень навыка (0-5)',
      type: 4, // INTEGER
      required: true
    }
  ]
};

// Функция проверки прав администратора сервера
function hasAdminRole(member) {
  // Проверяем права администратора на сервере (не зависит от конкретной роли)
  return member.permissions.has('Administrator');
}

async function executeChangeName(interaction, client) {
  // Проверка прав администратора сервера
  if (!hasAdminRole(interaction.member)) {
    return interaction.reply({
      content: '❌ У вас нет прав администратора сервера для выполнения этой команды.',
      ephemeral: true
    });
  }

  const targetUser = interaction.options.getUser('пользователь');
  const newName = interaction.options.getString('новое_имя');

  // Проверка длины имени
  if (newName.length > 32) {
    return interaction.reply({
      content: '❌ Имя персонажа не может быть длиннее 32 символов.',
      ephemeral: true
    });
  }

  if (newName.length < 2) {
    return interaction.reply({
      content: '❌ Имя персонажа должно содержать минимум 2 символа.',
      ephemeral: true
    });
  }

  try {
    // Получаем данные пользователя
    const userData = getUserData(targetUser.id);
    
    // Сохраняем старое имя для сообщения
    const oldName = userData.characterName || 'Не настроено';
    
    // Обновляем имя
    userData.characterName = newName;
    updateUserData(targetUser.id, userData);

    // Безопасное логирование
    console.log(`[ADMIN] ${interaction.user.tag} изменил имя персонажа ${targetUser.tag} с "${oldName}" на "${newName}"`);

    const embed = new EmbedBuilder()
      .setTitle('✅ Имя персонажа изменено администратором')
      .setDescription(`**Пользователь:** ${targetUser.username}\n**Старое имя:** ${oldName}\n**Новое имя:** ${newName}`)
      .setColor('#00FF00')
      .setThumbnail(targetUser.displayAvatarURL())
      .setFooter({ text: `Изменено администратором`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Ошибка при смене имени персонажа:', error);
    await interaction.reply({
      content: '❌ Произошла ошибка при смене имени персонажа.',
      ephemeral: true
    });
  }
}

async function executeChangeLevel(interaction, client) {
  // Проверка прав администратора сервера
  if (!hasAdminRole(interaction.member)) {
    return interaction.reply({
      content: '❌ У вас нет прав администратора сервера для выполнения этой команды.',
      ephemeral: true
    });
  }

  const targetUser = interaction.options.getUser('пользователь');
  const skillName = interaction.options.getString('навык').toLowerCase();
  const newLevel = interaction.options.getInteger('уровень');

  // Проверка уровня
  if (newLevel < 0 || newLevel > 5) {
    return interaction.reply({
      content: '❌ Уровень навыка должен быть от 0 до 5.',
      ephemeral: true
    });
  }

  // Поиск навыка
  const skill = SKILLS.find(s => s.name.toLowerCase() === skillName || s.id === skillName);
  if (!skill) {
    return interaction.reply({
      content: `❌ Неизвестный навык: ${skillName}\n\nДоступные навыки:\n${SKILLS.map(s => `• ${s.name}`).join('\n')}`,
      ephemeral: true
    });
  }

  try {
    // Получаем данные пользователя
    const userData = getUserData(targetUser.id);
    
    // Проверяем, есть ли у пользователя персонаж
    if (!userData.characterName) {
      return interaction.reply({
        content: `❌ У пользователя ${targetUser.username} не настроен персонаж. Сначала используйте команду смены имени.`,
        ephemeral: true
      });
    }
    
    // Сохраняем старый уровень для сообщения
    const oldLevel = userData.skills[skill.id] || 0;
    
    // Обновляем уровень навыка
    userData.skills[skill.id] = newLevel;
    updateUserData(targetUser.id, userData);

    // Безопасное логирование
    console.log(`[ADMIN] ${interaction.user.tag} изменил навык "${skill.name}" пользователя ${targetUser.tag} с ${oldLevel} на ${newLevel}`);

    const embed = new EmbedBuilder()
      .setTitle('✅ Уровень навыка изменен администратором')
      .setDescription(`**Пользователь:** ${targetUser.username} (${userData.characterName})\n**Навык:** ${skill.emoji} ${skill.name}\n**Старый уровень:** ${oldLevel}/5\n**Новый уровень:** ${newLevel}/5`)
      .setColor('#00FF00')
      .setThumbnail(targetUser.displayAvatarURL())
      .setFooter({ text: `Изменено администратором`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Ошибка при изменении уровня навыка:', error);
    await interaction.reply({
      content: '❌ Произошла ошибка при изменении уровня навыка.',
      ephemeral: true
    });
  }
}

// Функция для определения какой команды выполнить
async function execute(interaction, client) {
  const commandName = interaction.commandName;
  
  if (commandName === 'навыки_админ_смена_имени') {
    await executeChangeName(interaction, client);
  } else if (commandName === 'навыки_админ_смена_уровня') {
    await executeChangeLevel(interaction, client);
  }
}

module.exports = { 
  changeNameData, 
  changeLevelData, 
  execute 
};