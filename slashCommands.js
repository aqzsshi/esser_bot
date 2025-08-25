const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

function loadCommands(client) {
  client.commands = new Collection();
  const commandFiles = fs.readdirSync(path.join(__dirname, 'handlers'))
    .filter(file => file.endsWith('Command.js') || file.endsWith('Handler.js'));

  for (const file of commandFiles) {
    const commandPath = path.join(__dirname, 'handlers', file);
    const commandModule = require(commandPath);
    if (Array.isArray(commandModule.commands)) {
      for (const cmd of commandModule.commands) {
        if (cmd?.data && typeof cmd.execute === 'function') {
          client.commands.set(cmd.data.name, cmd);
        }
      }
    } else if (commandModule.data && typeof commandModule.execute === 'function') {
      client.commands.set(commandModule.data.name, commandModule);
    }
  }
}

async function registerCommands(client) {
  try {
    // Регистрируем команды глобально для всех серверов
    const commandsData = Array.from(client.commands.values()).map(cmd => cmd.data);
    await client.application.commands.set(commandsData);
    console.log('✅ Slash-команды зарегистрированы глобально для всех серверов!');
    console.log(`📋 Зарегистрировано команд: ${commandsData.length}`);
    
    // Показываем список зарегистрированных команд
    console.log('📝 Зарегистрированные команды:');
    commandsData.forEach(cmd => {
      console.log(`  • /${cmd.name} - ${cmd.description}`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка при глобальной регистрации команд:', error);
    
    // Если глобальная регистрация не удалась, пробуем зарегистрировать на конкретном сервере
    const fallbackGuildId = process.env.FALLBACK_GUILD_ID;
    if (fallbackGuildId) {
      console.log('🔄 Пробуем зарегистрировать команды на сервере (fallback):', fallbackGuildId);
      const guild = client.guilds.cache.get(fallbackGuildId);
      if (guild) {
        try {
          const commandsData = Array.from(client.commands.values()).map(cmd => cmd.data);
          await guild.commands.set(commandsData);
          console.log('✅ Slash-команды зарегистрированы на сервере (fallback)!');
        } catch (guildError) {
          console.error('❌ Ошибка при регистрации на сервере (fallback):', guildError);
        }
      } else {
        console.warn('⚠️ Fallback guild не найден в кеше.');
      }
    }
  }
}

function handleInteractions(client) {
  client.on('interactionCreate', async (interaction) => {
      // ===== Slash-команды =====
      if (interaction.isChatInputCommand()) {
          // Запрет на ЛС, кроме /клубы
          if (interaction.channel && interaction.channel.type === 1 && interaction.commandName !== 'клубы') {
              await interaction.reply({
                  content: '❌ Эту команду нельзя вызывать в личных сообщениях бота.',
                  flags: 64
              });
              return;
          }

          const command = client.commands.get(interaction.commandName);
          if (!command) return;

          try {
              await command.execute(interaction, client);
          } catch (error) {
              console.error(error);
              if (!interaction.replied) {
                  await interaction.reply({ content: 'Произошла ошибка при выполнении команды.', flags: 64 });
              }
          }
          return;
      }

      // ===== Кнопки, селекты, модалки =====
      if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
          let handled = false;

          // Проверка всех зарегистрированных команд
          for (const cmd of client.commands.values()) {
              // Обработка кнопок / селектов / модалок в handleComponent
              if (typeof cmd.handleComponent === 'function') {
                  try {
                      const wasHandled = await cmd.handleComponent(interaction, client);
                      if (wasHandled) {
                          handled = true;
                          break;
                      }
                  } catch (err) {
                      console.error(`Ошибка в handleComponent команды ${cmd.data?.name}:`, err);
                  }
              }

              // Доп. обработка модалок, если они в handleModal
              if (interaction.isModalSubmit() && typeof cmd.handleModal === 'function') {
                  try {
                      const wasHandled = await cmd.handleModal(interaction, client);
                      if (wasHandled) {
                          handled = true;
                          break;
                      }
                  } catch (err) {
                      console.error(`Ошибка в handleModal команды ${cmd.data?.name}:`, err);
                  }
              }
          }

          // Если никто не обработал — пробуем skillsHandler
          if (!handled) {
              try {
                  const { handleComponent } = require('./handlers/skillsHandler'); // путь проверь!
                  const wasHandled = await handleComponent(interaction, client);
                  if (wasHandled) handled = true;
              } catch (e) {
                  console.error('Ошибка при обработке компонента в skillsHandler:', e);
              }
          }
      }
  });
}


// Функция для очистки всех команд (использовать только при необходимости)
async function clearAllCommands(client) {
  try {
    await client.application.commands.set([]);
    console.log('🗑️ Все глобальные команды очищены!');
  } catch (error) {
    console.error('❌ Ошибка при очистке команд:', error);
  }
}

module.exports = { loadCommands, registerCommands, handleInteractions, clearAllCommands }; 