const { ActivityType } = require('discord.js');

// Список статусов для автоматической смены
const STATUS_LIST = [
    {
        type: ActivityType.Playing,
        text: 'World of Tanks',
        emoji: '🎮'
    },
    {
        type: ActivityType.Playing,
        text: 'с танками',
        emoji: '🛡️'
    },
    {
        type: ActivityType.Watching,
        text: 'за игроками',
        emoji: '👀'
    },
    {
        type: ActivityType.Listening,
        text: 'команды',
        emoji: '🎵'
    },
    {
        type: ActivityType.Watching,
        text: 'статистику',
        emoji: '📊'
    },
    {
        type: ActivityType.Playing,
        text: 'в команде',
        emoji: '⚔️'
    },
    {
        type: ActivityType.Watching,
        text: 'результаты',
        emoji: '🏆'
    },
    {
        type: ActivityType.Listening,
        text: 'отчеты',
        emoji: '📝'
    }
];

// Функция для установки случайного статуса
function setRandomStatus(client) {
    try {
        const randomStatus = STATUS_LIST[Math.floor(Math.random() * STATUS_LIST.length)];
        
        client.user.setPresence({
            activities: [{
                name: randomStatus.text,
                type: randomStatus.type
            }],
            status: 'online'
        });

        console.log(`🔄 Статус бота изменен: ${randomStatus.emoji} ${randomStatus.text}`);
    } catch (error) {
        console.error('❌ Ошибка при изменении статуса бота:', error);
    }
}

// Функция для установки конкретного статуса
function setSpecificStatus(client, statusIndex = 0) {
    try {
        if (statusIndex >= STATUS_LIST.length) {
            statusIndex = 0;
        }

        const status = STATUS_LIST[statusIndex];
        
        client.user.setPresence({
            activities: [{
                name: status.text,
                type: status.type
            }],
            status: 'online'
        });

        console.log(`✅ Статус бота установлен: ${status.emoji} ${status.text}`);
        return statusIndex;
    } catch (error) {
        console.error('❌ Ошибка при установке статуса бота:', error);
        return 0;
    }
}

// Функция для очистки статуса
function clearStatus(client) {
    try {
        client.user.setPresence({
            activities: [],
            status: 'online'
        });

        console.log('🧹 Статус бота очищен');
    } catch (error) {
        console.error('❌ Ошибка при очистке статуса бота:', error);
    }
}

// Функция для запуска автоматической смены статуса
function startAutoStatusChange(client, intervalMinutes = 5) {
    let currentStatusIndex = 0;
    
    // Устанавливаем начальный статус
    setSpecificStatus(client, currentStatusIndex);
    
    // Запускаем автоматическую смену
    const interval = setInterval(() => {
        currentStatusIndex = setSpecificStatus(client, currentStatusIndex + 1);
    }, intervalMinutes * 60 * 1000);

    console.log(`🚀 Автоматическая смена статуса запущена (интервал: ${intervalMinutes} минут)`);
    
    // Возвращаем функцию для остановки
    return () => {
        clearInterval(interval);
        console.log('⏹️ Автоматическая смена статуса остановлена');
    };
}

// Основная функция модуля - автоматически запускается при подключении
function initBotStatus(client) {
    // Ждем, пока бот будет готов
    client.once('ready', () => {
        console.log('🤖 Модуль автоматической смены статуса инициализирован');
        
        // Запускаем автоматическую смену статуса каждые 3 минуты
        startAutoStatusChange(client, 3);
    });
}

// Экспортируем функции для использования в основном файле
module.exports = {
    setRandomStatus,
    setSpecificStatus,
    clearStatus,
    startAutoStatusChange,
    STATUS_LIST,
    initBotStatus
};

// Автоматически запускаем модуль при подключении
module.exports = initBotStatus;