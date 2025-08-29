const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { hasAdminOrOwner } = require('./permissionUtils');

// ===== Persist helpers =====
function cfgPath() { return path.join(__dirname, 'serverConfigs.json'); }
function loadCfg() {
  try {
    const p = cfgPath();
    if (!fs.existsSync(p)) { fs.writeFileSync(p, JSON.stringify({}, null, 2)); return {}; }
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return typeof j === 'object' && j ? j : {};
  } catch { return {}; }
}
function saveCfg(cfg) { try { fs.writeFileSync(cfgPath(), JSON.stringify(cfg, null, 2)); return true; } catch { return false; } }

// ===== Constants & defaults =====
const MAX_FORMS = 20;
const FORMAT_SINGLE_CHANNEL = 'single';
const FORMAT_SEPARATE_CHANNELS = 'separate';

const CATBOX_IMAGES = [
  'https://files.catbox.moe/da0w4w.png','https://files.catbox.moe/6jzhtq.png','https://files.catbox.moe/43nnxn.png','https://files.catbox.moe/szn6b0.png',
  'https://files.catbox.moe/pplqpl.png','https://files.catbox.moe/9myp7x.png','https://files.catbox.moe/wns56v.png','https://files.catbox.moe/t580p5.png',
  'https://files.catbox.moe/htftvq.png','https://files.catbox.moe/yjvg4i.png','https://files.catbox.moe/ixic2v.png','https://files.catbox.moe/rjgbjp.png',
  'https://files.catbox.moe/rkl6vf.png','https://files.catbox.moe/esi5qq.png','https://files.catbox.moe/14u0x0.png','https://files.catbox.moe/ejgfof.png',
  'https://files.catbox.moe/31j2cu.png','https://files.catbox.moe/8u1yxj.png','https://files.catbox.moe/66xa00.png','https://files.catbox.moe/wlj27x.png',
  'https://files.catbox.moe/la691o.png'
];

function ensureServer(cfg, gid) {
  if (!cfg[gid]) cfg[gid] = {};
  if (!cfg[gid].ticketsForms) cfg[gid].ticketsForms = []; // array of form objects
  return cfg;
}

function nextFormId(forms) { const ids = forms.map(f=>f.id||0); let n=1; while (ids.includes(n)) n++; return n; }

// ===== UI builders =====
function buildFormsListEmbed(guild, forms) {
  const e = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('➕ Заявки — управление формами')
    .setDescription('Создавайте до 20 форм. Формат: один канал или отдельные каналы. Настройте вопросы, роли, шаблоны и кнопки.')
    .setImage(CATBOX_IMAGES[0])
    .setTimestamp();
  if (!forms.length) {
    e.addFields({ name: 'Формы', value: 'Пока нет форм. Нажмите «Установить модуль» ниже.', inline: false });
  } else {
    e.addFields({ name: 'Формы', value: forms.map(f=>`• ${f.name} [${f.id}] — формат: ${f.format===FORMAT_SINGLE_CHANNEL?'в один канал':'отдельные каналы'}${f.disabled?' (отключена)':''}`).join('\n') });
  }
  return e;
}

function buildFormsListRow(forms) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tickets_form_install').setLabel('Установить модуль').setStyle(ButtonStyle.Success)
  );
  const row2 = new ActionRowBuilder();
  forms.slice(0,5).forEach(f=>{
    row2.addComponents(new ButtonBuilder().setCustomId(`tickets_form_manage_${f.id}`).setLabel(`${f.name} [${f.id}]`).setStyle(ButtonStyle.Secondary));
  });
  return forms.length ? [row1, row2] : [row1];
}

function buildManageFormEmbed(form) {
  const e = new EmbedBuilder()
    .setColor('#2ecc71')
    .setTitle(`Управление формой: ${form.name} [${form.id}]`)
    .setDescription('Настройте название, роли, вопросы, формат, каналы/категорию, шаблоны ЛС, кнопки.')
    .setImage(CATBOX_IMAGES[1])
    .addFields(
      { name: 'Формат', value: form.format===FORMAT_SINGLE_CHANNEL?'Все заявки в один канал':'Отдельные каналы', inline: true },
      { name: 'Статус', value: form.disabled?'Отключена':'Активна', inline: true },
      { name: 'Канал (для одного канала)', value: form.reviewChannelId?`<#${form.reviewChannelId}>`:'—', inline: true },
      { name: 'Категория (для отдельных каналов)', value: form.categoryId?`<#${form.categoryId}>`:'—', inline: true },
      { name: 'Роль обзвона', value: form.callRoleId?`<@&${form.callRoleId}>`:'—', inline: true },
      { name: 'Роли после одобрения', value: form.acceptRoleIds?.length?form.acceptRoleIds.map(id=>`<@&${id}>`).join(', '):'—', inline: false },
      { name: 'Роли/польз. для упоминания', value: form.mentionIds?.length?form.mentionIds.map(id=>id.startsWith('U:')?`<@${id.slice(2)}>`:`<@&${id}>`).join(', '):'—', inline: false },
      { name: 'Кнопки под заявками', value: form.buttonsDisabled?'Отключены':'Включены', inline: true },
      { name: 'Вопросы (1–5)', value: form.questions?.length?form.questions.map((q,i)=>`${i+1}. ${q.required?'*':''}${q.label} (${q.long?'большое':'маленькое'}, ${q.min||0}-${q.max||500})`).join('\n'):'—', inline: false }
    )
    .setTimestamp();
  return e;
}

function buildManageFormRows(form) {
  const r1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tickets_form_rename_${form.id}`).setLabel('Изменить название').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`tickets_form_mentions_${form.id}`).setLabel('Изменить роли для упоминания').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`tickets_form_questions_${form.id}`).setLabel('Изменить вопросы').setStyle(ButtonStyle.Secondary)
  );
  const r2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tickets_form_format_${form.id}`).setLabel('Изменить формат').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`tickets_form_channel_${form.id}`).setLabel('Изменить канал').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`tickets_form_category_${form.id}`).setLabel('Изменить категорию').setStyle(ButtonStyle.Secondary)
  );
  const r3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tickets_form_postmsg_${form.id}`).setLabel('Отправить сообщение с кнопкой').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`tickets_form_callrole_${form.id}`).setLabel('Изменить роль обзвона').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`tickets_form_acceptroles_${form.id}`).setLabel('Изменить роли после одобрения').setStyle(ButtonStyle.Secondary)
  );
  const r4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tickets_form_templates_${form.id}`).setLabel('Изменить шаблоны ЛС').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`tickets_form_toggle_call_${form.id}`).setLabel('Вкл/Выкл режим обзвона').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`tickets_form_toggle_buttons_${form.id}`).setLabel('Вкл/Выкл кнопки под заявками').setStyle(ButtonStyle.Secondary)
  );
  const r5 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tickets_form_disable_${form.id}`).setLabel(form.disabled?'Включить форму':'Отключить форму').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`tickets_form_delete_${form.id}`).setLabel('Удалить форму').setStyle(ButtonStyle.Danger)
  );
  return [r1,r2,r3,r4,r5];
}

// ===== Commands =====
const ticketsManage = {
  data: new SlashCommandBuilder().setName('модули_заявки').setDescription('Управление модулем «Заявки»'),
  async execute(interaction, client) {
    if (!hasAdminOrOwner(interaction.member)) { await interaction.reply({ content:'❌ Недостаточно прав.', flags:64 }); return; }
    const cfg = ensureServer(loadCfg(), interaction.guildId);
    const forms = cfg[interaction.guildId].ticketsForms;
    const e = buildFormsListEmbed(interaction.guild, forms);
    const rows = buildFormsListRow(forms);
    await interaction.reply({ embeds:[e], components: rows });
  },
  async handleComponent(interaction, client) {
    if (!interaction.isButton()) return false;
    if (!hasAdminOrOwner(interaction.member)) { await interaction.reply({ content:'❌ Недостаточно прав.', flags:64 }); return true; }
    const cfg = ensureServer(loadCfg(), interaction.guildId);
    const forms = cfg[interaction.guildId].ticketsForms;

    // Install
    if (interaction.customId === 'tickets_form_install') {
      if (forms.length >= MAX_FORMS) { await interaction.reply({ content:'⚠️ Достигнут лимит форм (20).', flags:64 }); return true; }
      // Ask format via two buttons
      const e = new EmbedBuilder().setColor('#5865F2').setTitle('Установка модуля «Заявки»').setDescription('Выберите формат формы:').setImage(CATBOX_IMAGES[2]);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tickets_install_single').setLabel('Все заявки в один канал').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('tickets_install_separate').setLabel('Отдельные каналы').setStyle(ButtonStyle.Secondary)
      );
      await interaction.reply({ embeds:[e], components:[row], flags:64 });
      return true;
    }
    if (interaction.customId === 'tickets_install_single' || interaction.customId === 'tickets_install_separate') {
      const format = interaction.customId.endsWith('single') ? FORMAT_SINGLE_CHANNEL : FORMAT_SEPARATE_CHANNELS;
      // Ask form name via modal
      const modal = new ModalBuilder().setCustomId(`tickets_install_name_${format}`).setTitle('Название формы');
      const input = new TextInputBuilder().setCustomId('form_name').setLabel('Название формы').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
      return true;
    }

    // Manage
    if (interaction.customId.startsWith('tickets_form_manage_')) {
      const id = parseInt(interaction.customId.split('_').pop());
      const form = forms.find(f=>f.id===id);
      if (!form) { await interaction.reply({ content:'❌ Форма не найдена.', flags:64 }); return true; }
      const e = buildManageFormEmbed(form);
      const rows = buildManageFormRows(form);
      await interaction.reply({ embeds:[e], components: rows, flags:64 });
      return true;
    }

    // Toggle, delete, simple actions
    const m = interaction.customId.match(/^tickets_form_(rename|format|channel|category|mentions|questions|postmsg|callrole|acceptroles|templates|toggle_call|toggle_buttons|disable|delete)_(\d+)$/);
    if (m) {
      const action = m[1];
      const id = parseInt(m[2]);
      const idx = forms.findIndex(f=>f.id===id);
      if (idx<0) { await interaction.reply({ content:'❌ Форма не найдена.', flags:64 }); return true; }
      const form = forms[idx];

      // Actions
      if (action==='disable') { form.disabled = !form.disabled; saveCfg(cfg); await interaction.reply({ content:`✅ Форма ${form.disabled?'отключена':'включена'}.`, flags:64 }); return true; }
      if (action==='delete') { forms.splice(idx,1); saveCfg(cfg); await interaction.reply({ content:'🗑 Форма удалена.', flags:64 }); return true; }
      if (action==='format') { form.format = form.format===FORMAT_SINGLE_CHANNEL?FORMAT_SEPARATE_CHANNELS:FORMAT_SINGLE_CHANNEL; saveCfg(cfg); await interaction.reply({ content:`🔁 Формат изменён на: ${form.format===FORMAT_SINGLE_CHANNEL?'в один канал':'отдельные каналы'}.`, flags:64 }); return true; }
      if (action==='toggle_call') { form.callMode = !form.callMode; saveCfg(cfg); await interaction.reply({ content:`🎙 Режим обзвона: ${form.callMode?'включен':'выключен'}.`, flags:64 }); return true; }
      if (action==='toggle_buttons') { form.buttonsDisabled = !form.buttonsDisabled; saveCfg(cfg); await interaction.reply({ content:`🔘 Кнопки под заявками: ${form.buttonsDisabled?'отключены':'включены'}.`, flags:64 }); return true; }

      // Modal-driven edits
      let modal;
      if (action==='rename') { modal = new ModalBuilder().setCustomId(`tickets_edit_rename_${id}`).setTitle('Изменить название'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Название формы').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60).setValue(form.name||''))); }
      if (action==='channel') { modal = new ModalBuilder().setCustomId(`tickets_edit_channel_${id}`).setTitle('Изменить канал заявок (ID)'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('review').setLabel('ID канала для рассмотрения').setStyle(TextInputStyle.Short).setRequired(true).setValue(form.reviewChannelId||''))); }
      if (action==='category') { modal = new ModalBuilder().setCustomId(`tickets_edit_category_${id}`).setTitle('Изменить категорию (ID)'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('category').setLabel('ID категории для каналов').setStyle(TextInputStyle.Short).setRequired(true).setValue(form.categoryId||''))); }
      if (action==='mentions') { modal = new ModalBuilder().setCustomId(`tickets_edit_mentions_${id}`).setTitle('Роли/пользователи для упоминания'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('mentions').setLabel('ID ролей/пользователей (через запятую). Для пользователя: U:ID').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue((form.mentionIds||[]).join(',')))); }
      if (action==='callrole') { modal = new ModalBuilder().setCustomId(`tickets_edit_callrole_${id}`).setTitle('Роль обзвона (ID)'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('callrole').setLabel('ID роли обзвона').setStyle(TextInputStyle.Short).setRequired(false).setValue(form.callRoleId||''))); }
      if (action==='acceptroles') { modal = new ModalBuilder().setCustomId(`tickets_edit_acceptroles_${id}`).setTitle('Роли после одобрения'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('acceptroles').setLabel('ID ролей через запятую').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue((form.acceptRoleIds||[]).join(',')))); }
      if (action==='templates') { modal = new ModalBuilder().setCustomId(`tickets_edit_templates_${id}`).setTitle('Шаблоны ЛС'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tpl_accept').setLabel('Шаблон: одобрение').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue(form.templates?.accept||'')), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tpl_decline').setLabel('Шаблон: отклонение').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue(form.templates?.decline||'')), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tpl_call').setLabel('Шаблон: приглашение на обзвон').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue(form.templates?.call||'')) ); }
      if (action==='questions') { modal = new ModalBuilder().setCustomId(`tickets_edit_questions_${id}`).setTitle('Изменить вопросы (JSON)'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('questions').setLabel('JSON массива вопросов').setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder('[{"label":"Имя","required":true,"long":false,"min":1,"max":60}]').setValue(JSON.stringify(form.questions||[])))); }
      if (action==='postmsg') { modal = new ModalBuilder().setCustomId(`tickets_edit_postmsg_${id}`).setTitle('Отправить сообщение с кнопкой'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('targetChannel').setLabel('ID канала для кнопки').setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Заголовок (необяз.)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(128)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('text').setLabel('Текст (необяз.)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('image').setLabel('Картинка URL (необяз.)').setStyle(TextInputStyle.Short).setRequired(false)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('btn').setLabel('Текст кнопки (необяз.)').setStyle(TextInputStyle.Short).setRequired(false)) ); }
      if (modal) { await interaction.showModal(modal); return true; }
    }
    return false;
  },
  async handleModal(interaction, client) {
    if (!interaction.isModalSubmit()) return false;
    if (!hasAdminOrOwner(interaction.member)) { await interaction.reply({ content:'❌ Недостаточно прав.', flags:64 }); return true; }
    const cfg = ensureServer(loadCfg(), interaction.guildId);
    const forms = cfg[interaction.guildId].ticketsForms;

    // Install name
    if (interaction.customId.startsWith('tickets_install_name_')) {
      const format = interaction.customId.endsWith(FORMAT_SINGLE_CHANNEL) ? FORMAT_SINGLE_CHANNEL : FORMAT_SEPARATE_CHANNELS;
      const name = interaction.fields.getTextInputValue('form_name').trim();
      const id = nextFormId(forms);
      const form = { id, name, format, disabled: false, questions: [], mentionIds: [], callMode: false, callRoleId: '', acceptRoleIds: [], templates: {} };
      forms.push(form); saveCfg(cfg);
      await interaction.reply({ content: `✅ Форма установлена: ${name} [${id}]`, flags:64 });
      return true;
    }

    // Edits
    const m = interaction.customId.match(/^tickets_edit_(rename|channel|category|mentions|callrole|acceptroles|templates|questions|postmsg)_(\d+)$/);
    if (!m) return false;
    const action = m[1];
    const id = parseInt(m[2]);
    const idx = forms.findIndex(f=>f.id===id); if (idx<0) { await interaction.reply({ content:'❌ Форма не найдена.', flags:64 }); return true; }
    const form = forms[idx];

    if (action==='rename') { form.name = interaction.fields.getTextInputValue('name').trim(); }
    if (action==='channel') { form.reviewChannelId = interaction.fields.getTextInputValue('review').trim(); }
    if (action==='category') { form.categoryId = interaction.fields.getTextInputValue('category').trim(); }
    if (action==='mentions') { const val = interaction.fields.getTextInputValue('mentions').trim(); form.mentionIds = val?val.split(',').map(s=>s.trim()):[]; }
    if (action==='callrole') { form.callRoleId = interaction.fields.getTextInputValue('callrole').trim(); }
    if (action==='acceptroles') { const val = interaction.fields.getTextInputValue('acceptroles').trim(); form.acceptRoleIds = val?val.split(',').map(s=>s.trim()):[]; }
    if (action==='templates') {
      form.templates = form.templates || {};
      form.templates.accept = interaction.fields.getTextInputValue('tpl_accept');
      form.templates.decline = interaction.fields.getTextInputValue('tpl_decline');
      form.templates.call = interaction.fields.getTextInputValue('tpl_call');
    }
    if (action==='questions') {
      try { const arr = JSON.parse(interaction.fields.getTextInputValue('questions')||'[]'); form.questions = Array.isArray(arr)?arr.slice(0,5):[]; } catch { /* ignore */ }
    }
    if (action==='postmsg') {
      const channelId = interaction.fields.getTextInputValue('targetChannel').trim();
      const title = interaction.fields.getTextInputValue('title').trim();
      const text = interaction.fields.getTextInputValue('text').trim();
      const image = interaction.fields.getTextInputValue('image').trim();
      const btnText = interaction.fields.getTextInputValue('btn').trim() || 'Подать заявку';
      try {
        const ch = await client.channels.fetch(channelId);
        const e = new EmbedBuilder().setColor('#1D1D1E').setTitle(title || form.name).setDescription(text || 'Нажмите кнопку для подачи заявки.').setTimestamp();
        if (image && image.startsWith('http')) e.setImage(image);
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`tickets_open_form_${form.id}`).setLabel(btnText).setStyle(ButtonStyle.Success));
        await ch.send({ embeds:[e], components:[row] });
        await interaction.reply({ content:'✅ Сообщение отправлено.', flags:64 });
      } catch { await interaction.reply({ content:'❌ Не удалось отправить сообщение.', flags:64 }); }
      saveCfg(cfg); return true;
    }

    saveCfg(cfg);
    await interaction.reply({ content:'✅ Изменения применены.', flags:64 });
    return true;
  }
};

// Подача заявки (по кнопке): открываем модал с вопросами формы
async function handleOpenForm(interaction, client) {
  if (!interaction.isButton() || !interaction.customId.startsWith('tickets_open_form_')) return false;
  const cfg = ensureServer(loadCfg(), interaction.guildId);
  const id = parseInt(interaction.customId.split('_').pop());
  const form = cfg[interaction.guildId].ticketsForms.find(f=>f.id===id);
  if (!form || form.disabled) { await interaction.reply({ content:'❌ Форма недоступна.', flags:64 }); return true; }

  // Protection: only one open ticket in separate mode per user
  if (form.format===FORMAT_SEPARATE_CHANNELS) {
    const existing = interaction.guild.channels.cache.find(c=>c.parentId===form.categoryId && c.topic === `form:${form.id};user:${interaction.user.id}`);
    if (existing) { await interaction.reply({ content:'⚠️ У вас уже есть активная заявка по этой форме. Дождитесь рассмотрения или удаления.', flags:64 }); return true; }
  }

  const questions = (form.questions||[]).slice(0,5);
  const modal = new ModalBuilder().setCustomId(`tickets_submit_${form.id}`).setTitle(form.name.slice(0,45));
  for (let i=0;i<questions.length;i++) {
    const q = questions[i];
    const input = new TextInputBuilder().setCustomId(`q_${i}`).setLabel(q.label?.slice(0,45)||`Вопрос ${i+1}`).setStyle(q.long?TextInputStyle.Paragraph:TextInputStyle.Short).setRequired(!!q.required);
    if (q.min) input.setMinLength(Math.max(1, Math.min(4000, q.min)));
    if (q.max) input.setMaxLength(Math.max(1, Math.min(4000, q.max)));
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }
  if (!questions.length) {
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q_0').setLabel('Сообщение').setStyle(TextInputStyle.Paragraph).setRequired(false)));
  }
  await interaction.showModal(modal);
  return true;
}

// Обработка отправки заявки
async function handleSubmitForm(interaction, client) {
  if (!interaction.isModalSubmit() || !interaction.customId.startsWith('tickets_submit_')) return false;
  const cfg = ensureServer(loadCfg(), interaction.guildId);
  const id = parseInt(interaction.customId.split('_').pop());
  const form = cfg[interaction.guildId].ticketsForms.find(f=>f.id===id);
  if (!form || form.disabled) { await interaction.reply({ content:'❌ Форма недоступна.', flags:64 }); return true; }

  const answers = (form.questions||[]).map((q,i)=>({ label: q.label||`Вопрос ${i+1}`, value: interaction.fields.getTextInputValue(`q_${i}`)||'' }));
  if (!answers.length) answers.push({ label: 'Сообщение', value: interaction.fields.getTextInputValue('q_0')||'' });

  // Build ticket embed
  const idxImage = (form.id + Date.now()) % CATBOX_IMAGES.length;
  const e = new EmbedBuilder().setColor('#1D1D1E').setTitle(`Заявка: ${form.name}`).setDescription(`Статус: 🔵 На рассмотрении\n\nЗаявку заполнил: ${interaction.user}\nДата: \`${new Date().toLocaleString('ru-RU')}\``).setImage(CATBOX_IMAGES[idxImage]).setTimestamp();
  for (const a of answers) { e.addFields({ name: a.label, value: a.value || '—', inline: false }); }

  const approve = new ButtonBuilder().setCustomId(`tickets_action_approve_${form.id}`).setLabel('Одобрить').setStyle(ButtonStyle.Success);
  const decline = new ButtonBuilder().setCustomId(`tickets_action_decline_${form.id}`).setLabel('Отклонить').setStyle(ButtonStyle.Danger);
  const call = new ButtonBuilder().setCustomId(`tickets_action_call_${form.id}`).setLabel('Пригласить на обзвон').setStyle(ButtonStyle.Primary);
  const row = new ActionRowBuilder().addComponents(approve, decline, call);

  if (form.format===FORMAT_SINGLE_CHANNEL) {
    const ch = await interaction.guild.channels.fetch(form.reviewChannelId).catch(()=>null);
    if (!ch) { await interaction.reply({ content:'❌ Канал рассмотрения не найден.', flags:64 }); return true; }
    const mention = (form.mentionIds||[]).map(id=>id.startsWith('U:')?`<@${id.slice(2)}>`:`<@&${id}>`).join(' ');
    await ch.send({ content: mention||undefined, embeds:[e], components: form.buttonsDisabled?[]:[row] });
    await interaction.reply({ content:'✅ Заявка отправлена!', flags:64 });
  } else {
    // separate channel per ticket under category
    const chan = await interaction.guild.channels.create({
      name: `${form.name}-${interaction.user.username}`.slice(0,90),
      type: ChannelType.GuildText,
      parent: form.categoryId || null,
      topic: `form:${form.id};user:${interaction.user.id}`,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
      ]
    });
    // add access roles/users
    for (const mid of (form.mentionIds||[])) {
      if (mid.startsWith('U:')) await chan.permissionOverwrites.create(mid.slice(2), { ViewChannel: true, SendMessages: true }).catch(()=>{});
      else await chan.permissionOverwrites.create(mid, { ViewChannel: true, SendMessages: true }).catch(()=>{});
    }
    await chan.send({ embeds:[e], components: form.buttonsDisabled?[]:[row] });
    await interaction.reply({ content:`✅ Заявка отправлена! Канал: ${chan}`, flags:64 });
  }
  return true;
}

// Кнопки обработки заявки
async function handleTicketActions(interaction, client) {
  if (!interaction.isButton() || !interaction.customId.startsWith('tickets_action_')) return false;
  const [ , , action, idStr ] = interaction.customId.split('_');
  const cfg = ensureServer(loadCfg(), interaction.guildId);
  const form = cfg[interaction.guildId].ticketsForms.find(f=>f.id===parseInt(idStr));
  if (!form) { await interaction.reply({ content:'❌ Форма не найдена.', flags:64 }); return true; }

  // Permission: mentionIds, call role holders, admins/owner
  const can = hasAdminOrOwner(interaction.member) || (form.mentionIds||[]).some(mid => mid.startsWith('U:')? (interaction.user.id===mid.slice(2)) : interaction.member.roles.cache.has(mid));
  if (!can) { await interaction.reply({ content:'❌ Недостаточно прав.', flags:64 }); return true; }

  const msg = interaction.message;
  const emb = msg.embeds?.[0];
  if (!emb) { await interaction.reply({ content:'❌ Нет embed для обновления.', flags:64 }); return true; }
  const e = EmbedBuilder.from(emb);

  if (action==='approve') {
    e.setColor('#2ecc71');
    e.setDescription((e.data.description||'').replace(/Статус:.*/,'').trim()+`\nСтатус: 🟢 Принято\nРассмотрел: ${interaction.user}`);
    await msg.edit({ embeds:[e] });
    // call role
    if (form.callMode && form.callRoleId) {
      const authorMatch = /Заявку заполнил: <@(?<id>\d+)>/u.exec(e.data.description||'');
      const userId = authorMatch?.groups?.id; if (userId) {
        const member = await interaction.guild.members.fetch(userId).catch(()=>null);
        if (member) await member.roles.add(form.callRoleId).catch(()=>{});
      }
    }
    // accept roles
    for (const rid of (form.acceptRoleIds||[])) {
      const authorMatch = /Заявку заполнил: <@(?<id>\d+)>/u.exec(e.data.description||'');
      const userId = authorMatch?.groups?.id; if (userId) {
        const member = await interaction.guild.members.fetch(userId).catch(()=>null);
        if (member) await member.roles.add(rid).catch(()=>{});
      }
    }
    // DM template
    if (form.templates?.accept) {
      const authorMatch = /Заявку заполнил: <@(?<id>\d+)>/u.exec(e.data.description||'');
      const userId = authorMatch?.groups?.id; if (userId) {
        const user = await interaction.client.users.fetch(userId).catch(()=>null);
        if (user) await user.send(form.templates.accept.replace('{пинг_отправителя}', `<@${userId}>`)).catch(()=>{});
      }
    }
    await interaction.reply({ content:'✅ Заявка одобрена.', flags:64 });
    return true;
  }

  if (action==='decline') {
    // ask reason via modal
    const modal = new ModalBuilder().setCustomId(`tickets_decline_${idStr}`).setTitle('Причина отказа');
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Причина (видно модерации)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)));
    await interaction.showModal(modal);
    return true;
  }

  if (action==='call') {
    if (!form.callMode || !form.callRoleId) { await interaction.reply({ content:'ℹ️ Режим обзвона выключен или не настроен.', flags:64 }); return true; }
    const authorMatch = /Заявку заполнил: <@(?<id>\d+)>/u.exec((emb?.data?.description)||'');
    const userId = authorMatch?.groups?.id; if (userId) {
      const member = await interaction.guild.members.fetch(userId).catch(()=>null);
      if (member) await member.roles.add(form.callRoleId).catch(()=>{});
      if (form.templates?.call) { const user = await interaction.client.users.fetch(userId).catch(()=>null); if (user) await user.send(form.templates.call.replace('{пинг_отправителя}', `<@${userId}>`)).catch(()=>{}); }
      await interaction.reply({ content:'📞 Приглашение на обзвон отправлено/роль выдана.', flags:64 });
    } else { await interaction.reply({ content:'❌ Не удалось определить автора.', flags:64 }); }
    return true;
  }
  return false;
}

async function handleDeclineModal(interaction, client) {
  if (!interaction.isModalSubmit() || !interaction.customId.startsWith('tickets_decline_')) return false;
  const reason = interaction.fields.getTextInputValue('reason');
  const idStr = interaction.customId.split('_').pop();
  const msg = interaction.message || (await interaction.channel.messages.fetch(interaction.targetId).catch(()=>null));
  const emb = interaction.message?.embeds?.[0];
  const e = emb ? EmbedBuilder.from(emb) : null;
  if (!e) { await interaction.reply({ content:'❌ Нет embed для обновления.', flags:64 }); return true; }
  e.setColor('#e74c3c');
  e.setDescription((e.data.description||'').replace(/Статус:.*/,'').trim()+`\nСтатус: 🔴 Отклонено\nОтклонил: ${interaction.user}\nПричина: ${reason}`);
  await interaction.reply({ content:'❌ Заявка отклонена.', flags:64 });
  return true;
}

module.exports = {
  commands: [ticketsManage],
  handleComponent: async (interaction, client) => {
    return await ticketsManage.handleComponent?.(interaction, client) || await handleOpenForm(interaction, client) || await handleTicketActions(interaction, client);
  },
  handleModal: async (interaction, client) => {
    return await ticketsManage.handleModal?.(interaction, client) || await handleSubmitForm(interaction, client) || await handleDeclineModal(interaction, client);
  }
};

