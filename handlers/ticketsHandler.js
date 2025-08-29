const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { hasAdminOrOwner } = require('./permissionUtils');

function loadConfigs() {
  try {
    const p = path.join(__dirname, 'serverConfigs.json');
    if (!fs.existsSync(p)) { fs.writeFileSync(p, JSON.stringify({}, null, 2)); return {}; }
    const raw = fs.readFileSync(p, 'utf8');
    const json = JSON.parse(raw);
    return typeof json === 'object' && json ? json : {};
  } catch { return {}; }
}

function saveConfigs(cfg) {
  try {
    const p = path.join(__dirname, 'serverConfigs.json');
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
    return true;
  } catch { return false; }
}

// Скриншоты/иконки от пользователя (можно использовать в эмбедах)
const TICKET_IMAGES = [
  'https://files.catbox.moe/da0w4w.png','https://files.catbox.moe/6jzhtq.png','https://files.catbox.moe/43nnxn.png','https://files.catbox.moe/szn6b0.png',
  'https://files.catbox.moe/pplqpl.png','https://files.catbox.moe/9myp7x.png','https://files.catbox.moe/wns56v.png','https://files.catbox.moe/t580p5.png',
  'https://files.catbox.moe/htftvq.png','https://files.catbox.moe/yjvg4i.png','https://files.catbox.moe/ixic2v.png','https://files.catbox.moe/rjgbjp.png',
  'https://files.catbox.moe/rkl6vf.png','https://files.catbox.moe/esi5qq.png','https://files.catbox.moe/14u0x0.png','https://files.catbox.moe/ejgfof.png',
  'https://files.catbox.moe/31j2cu.png','https://files.catbox.moe/8u1yxj.png','https://files.catbox.moe/66xa00.png','https://files.catbox.moe/wlj27x.png',
  'https://files.catbox.moe/la691o.png'
];

// Категории и приоритеты (можно расширять после парсинга сайта)
const DEFAULT_CATEGORIES = [
  { id: 'general', label: 'Общее' },
  { id: 'technical', label: 'Техническая' },
  { id: 'payment', label: 'Оплата' },
  { id: 'appeal', label: 'Апелляция' }
];
const DEFAULT_PRIORITIES = [
  { id: 'low', label: 'Низкий' },
  { id: 'normal', label: 'Обычный' },
  { id: 'high', label: 'Высокий' }
];

// /модуль_тикеты_настройка
const ticketsSetup = {
  data: new SlashCommandBuilder()
    .setName('модуль_тикеты_настройка')
    .setDescription('Настройка модуля тикетов (только для администраторов)')
    .addChannelOption(o => o.setName('канал').setDescription('Канал для публикации тикетов/уведомлений').setRequired(true))
    .addStringOption(o => o.setName('обработчики_ролей').setDescription('ID ролей обработчиков (через запятую)').setRequired(false))
    .addStringOption(o => o.setName('категории').setDescription('Список категорий через запятую (label)').setRequired(false))
    .addStringOption(o => o.setName('приоритеты').setDescription('Список приоритетов через запятую (label)').setRequired(false)),
  async execute(interaction) {
    if (!hasAdminOrOwner(interaction.member)) {
      await interaction.reply({ content: '❌ Недостаточно прав.', flags: 64 });
      return;
    }
    const channel = interaction.options.getChannel('канал');
    const rolesText = interaction.options.getString('обработчики_ролей') || '';
    const catsText = interaction.options.getString('категории') || '';
    const prioText = interaction.options.getString('приоритеты') || '';

    const handlerRoleIds = rolesText.split(',').map(s=>s.trim()).filter(s=>/^\d+$/.test(s));
    const categories = catsText ? catsText.split(',').map(s=>({ id: s.trim().toLowerCase().replace(/\s+/g,'_'), label: s.trim() })).filter(c=>c.label) : DEFAULT_CATEGORIES;
    const priorities = prioText ? prioText.split(',').map(s=>({ id: s.trim().toLowerCase(), label: s.trim() })).filter(p=>p.label) : DEFAULT_PRIORITIES;

    const cfg = loadConfigs();
    if (!cfg[interaction.guildId]) cfg[interaction.guildId] = {};
    cfg[interaction.guildId].tickets = {
      channelId: channel.id,
      handlerRoleIds,
      categories,
      priorities,
      nextId: cfg[interaction.guildId]?.tickets?.nextId || 1
    };
    saveConfigs(cfg);

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('✅ Модуль тикетов настроен')
      .addFields(
        { name: 'Канал', value: channel.toString(), inline: true },
        { name: 'Роли обработчиков', value: handlerRoleIds.map(id=>`<@&${id}>`).join(', ') || '—', inline: false },
        { name: 'Категории', value: categories.map(c=>c.label).join(', '), inline: false },
        { name: 'Приоритеты', value: priorities.map(p=>p.label).join(', '), inline: false }
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed], flags: 64 });
  }
};

// /тикет — создание тикета
const ticketCreate = {
  data: new SlashCommandBuilder()
    .setName('тикет')
    .setDescription('Создать тикет')
    .addStringOption(o=>o.setName('тема').setDescription('Краткая тема').setRequired(true))
    .addStringOption(o=>o.setName('описание').setDescription('Подробности').setRequired(true))
    .addStringOption(o=>o.setName('категория').setDescription('ID категории (опционально)').setRequired(false))
    .addStringOption(o=>o.setName('приоритет').setDescription('ID приоритета (опционально)').setRequired(false)),
  async execute(interaction, client) {
    const cfg = loadConfigs();
    const tcfg = cfg[interaction.guildId]?.tickets;
    if (!tcfg) {
      await interaction.reply({ content: '❌ Модуль тикетов не настроен. Обратитесь к администратору.', flags: 64 });
      return;
    }
    const title = interaction.options.getString('тема');
    const desc = interaction.options.getString('описание');
    const catId = (interaction.options.getString('категория')||'').toLowerCase();
    const prioId = (interaction.options.getString('приоритет')||'').toLowerCase();
    const cat = (tcfg.categories||DEFAULT_CATEGORIES).find(c=>c.id===catId) || null;
    const prio = (tcfg.priorities||DEFAULT_PRIORITIES).find(p=>p.id===prioId) || null;

    const ticketId = tcfg.nextId || 1;
    tcfg.nextId = ticketId + 1;
    cfg[interaction.guildId].tickets = tcfg;
    saveConfigs(cfg);

    const image = TICKET_IMAGES[ticketId % TICKET_IMAGES.length];
    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle(`🎫 Тикет #${ticketId} — ${title}`)
      .setDescription(desc)
      .addFields(
        { name: 'Категория', value: cat ? cat.label : '—', inline: true },
        { name: 'Приоритет', value: prio ? prio.label : '—', inline: true },
        { name: 'Автор', value: interaction.user.toString(), inline: true },
        { name: 'Статус', value: '🔵 Открыт', inline: true }
      )
      .setImage(image)
      .setTimestamp();

    const assignBtn = new ButtonBuilder().setCustomId(`ticket_assign_${ticketId}`).setLabel('Взять в работу').setStyle(ButtonStyle.Primary);
    const closeBtn = new ButtonBuilder().setCustomId(`ticket_close_${ticketId}`).setLabel('Закрыть').setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(assignBtn, closeBtn);

    const channel = await client.channels.fetch(tcfg.channelId).catch(()=>null);
    if (!channel) {
      await interaction.reply({ content: '❌ Канал для тикетов не найден. Обратитесь к администратору.', flags: 64 });
      return;
    }
    const sent = await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ Тикет #${ticketId} создан: ${sent.url}`, flags: 64 });
  },
  async handleComponent(interaction) {
    if (!interaction.isButton()) return false;
    if (!interaction.customId.startsWith('ticket_')) return false;
    const [ , action, id ] = interaction.customId.split('_');
    const cfg = loadConfigs();
    const tcfg = cfg[interaction.guildId]?.tickets;
    if (!tcfg) { await interaction.reply({ content: '❌ Модуль тикетов не настроен.', flags: 64 }); return true; }

    // Проверка обработчика
    const canHandle = hasAdminOrOwner(interaction.member) || (tcfg.handlerRoleIds||[]).some(rid=>interaction.member.roles.cache.has(rid));
    if (!canHandle) { await interaction.reply({ content: '❌ Недостаточно прав для действия с тикетом.', flags: 64 }); return true; }

    const msg = interaction.message;
    const emb = msg.embeds?.[0];
    if (!emb) { await interaction.reply({ content: '❌ Нечего обновлять.', flags: 64 }); return true; }

    const e = EmbedBuilder.from(emb);
    if (action === 'assign') {
      // Меняем статус
      const fields = e.data.fields || [];
      const idx = fields.findIndex(f=>f.name==='Статус');
      if (idx>=0) fields[idx].value = `🟡 В работе — ${interaction.user}`; else fields.push({ name:'Статус', value:`🟡 В работе — ${interaction.user}`, inline:true });
      e.setFields(fields);
      await interaction.update({ embeds:[e] });
      return true;
    }
    if (action === 'close') {
      const fields = e.data.fields || [];
      const idx = fields.findIndex(f=>f.name==='Статус');
      if (idx>=0) fields[idx].value = `🟢 Закрыт — ${interaction.user}`; else fields.push({ name:'Статус', value:`🟢 Закрыт — ${interaction.user}`, inline:true });
      e.setFields(fields);
      // отключаем кнопки
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_assign_${id}`).setLabel('Взять в работу').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId(`ticket_close_${id}`).setLabel('Закрыть').setStyle(ButtonStyle.Danger).setDisabled(true)
      );
      await interaction.update({ embeds:[e], components: [disabledRow] });
      return true;
    }
    return false;
  }
};

module.exports = { commands: [ticketsSetup, ticketCreate] };

