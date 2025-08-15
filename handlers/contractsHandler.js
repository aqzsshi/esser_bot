const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  RoleSelectMenuBuilder,
  UserSelectMenuBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { dataPath } = require('../utils/dataPath');

const DATA_FILE = dataPath('contractsData.json');

// --------- Storage helpers ---------
function loadStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Ошибка чтения contractsData.json:', e);
  }
  return {};
}

function saveStore(store) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('Ошибка записи contractsData.json:', e);
  }
}

function getGuildState(guildId) {
  const store = loadStore();
  if (!store[guildId]) {
    store[guildId] = { orgs: [], nextOrgSeq: 1, contracts: {} };
    saveStore(store);
  }
  return store[guildId];
}

function setGuildState(guildId, guildState) {
  const store = loadStore();
  store[guildId] = guildState;
  saveStore(store);
}

function findOrg(guildState, orgId) {
  return guildState.orgs.find(o => o.id === orgId);
}

function requireAdmin(interaction) {
  return interaction.member && interaction.member.permissions && interaction.member.permissions.has('Administrator');
}

function canManageContract(interaction, contract, guildState) {
  const org = findOrg(guildState, contract.orgId);
  if (!org) return false;
  if (interaction.member.permissions.has('Administrator')) return true;
  if (interaction.user.id === contract.authorId) return true;
  const mode = org.settings.permissionMode || 'admin_author';
  if (mode === 'everyone') return true;
  // Другие режимы пока трактуем как admin_or_author
  return false;
}

// In-memory trackers
const pendingCreations = new Map(); // tempId -> { guildId, orgId, authorId, durationMinutes, name }
const contractTimers = new Map(); // contractId -> timeoutId

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// --------- UI Builders ---------
function moduleHomeEmbed(guildState) {
  const embed = new EmbedBuilder()
    .setTitle('🧱 Контракты')
    .setDescription('Управление модулем «Контракты».')
    .setColor('#1D1D1E');
  if (guildState.orgs.length === 0) {
    embed.addFields({ name: 'Организации', value: 'Пока нет ни одной. Нажмите «Установить модуль» чтобы создать организацию.' });
  } else {
    embed.addFields({
      name: 'Организации',
      value: guildState.orgs.map(o => `• ${o.name} [${o.id}] — ${o.enabled ? '🟢 включена' : '🔴 отключена'}`).join('\n')
    });
  }
  return embed;
}

function moduleHomeComponents(guildState) {
  const rows = [];
  const row1 = new ActionRowBuilder();
  if (guildState.orgs.length < 3) {
    row1.addComponents(new ButtonBuilder().setCustomId('contracts_install').setLabel('Установить модуль').setStyle(ButtonStyle.Primary));
  }
  rows.push(row1);
  if (guildState.orgs.length > 0) {
    // up to 5 buttons per row
    let current = new ActionRowBuilder();
    for (const org of guildState.orgs) {
      const button = new ButtonBuilder().setCustomId(`contracts_manage_org_${org.id}`).setLabel(`${org.name} [${org.id}]`).setStyle(ButtonStyle.Secondary);
      if (current.components.length >= 5) {
        rows.push(current);
        current = new ActionRowBuilder();
      }
      current.addComponents(button);
    }
    if (current.components.length > 0) rows.push(current);
  }
  return rows;
}

function orgManageEmbed(org) {
  const embed = new EmbedBuilder()
    .setTitle(`Организация: ${org.name} [${org.id}]`)
    .setColor('#1D1D1E')
    .addFields(
      { name: 'Статус', value: org.enabled ? '🟢 Включена' : '🔴 Отключена', inline: true },
      { name: 'Роли для упоминания', value: org.mentionRoleIds.length ? org.mentionRoleIds.map(id => `<@&${id}>`).join(', ') : '—', inline: true },
      { name: 'Права завершения/отмены', value: org.settings.permissionMode || 'admin_author', inline: false },
      { name: 'Опции', value: [
        `• Эмодзи «Выполнено»: ${org.settings.doneEmojiEnabled ? 'вкл' : 'выкл'}`,
        `• Добавление участников вручную: ${org.settings.manualAddEnabled ? 'вкл' : 'выкл'}`,
        `• Участие при ручном добавлении: ${org.settings.manualAllowJoinEnabled ? 'вкл' : 'выкл'}`,
        `• ЛС участникам при ручном добавлении: ${org.settings.dmOnManualAddEnabled ? 'вкл' : 'выкл'}`,
        `• Сбор участников (старт по кнопке): ${org.settings.collectParticipantsEnabled ? 'вкл' : 'выкл'}`
      ].join('\n'), inline: false },
      { name: 'Каналы', value: [
        `• Категория: ${org.categoryId ? `<#${org.categoryId}>` : '—'}`,
        `• Взять контракт: ${org.takeChannelId ? `<#${org.takeChannelId}>` : '—'}`,
        `• Уведомления: ${org.notifyChannelId ? `<#${org.notifyChannelId}>` : '—'}`,
        `• Логи: ${org.logsChannelId ? `<#${org.logsChannelId}>` : '—'}`
      ].join('\n'), inline: false }
    );
  return embed;
}

function orgManageComponents(org) {
  const rows = [];
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`contracts_rename_${org.id}`).setLabel('Изменить название').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`contracts_update_roles_${org.id}`).setLabel('Изменить роли для упоминания').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`contracts_update_perms_${org.id}`).setLabel('Изменить права').setStyle(ButtonStyle.Secondary)
  ));
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`contracts_toggle_done_${org.id}`).setLabel('Вкл/Выкл «Выполнено»').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`contracts_toggle_manual_${org.id}`).setLabel('Вкл/Выкл добавление вручную').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`contracts_toggle_manual_join_${org.id}`).setLabel('Вкл/Выкл участие при ручном добавлении').setStyle(ButtonStyle.Secondary)
  ));
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`contracts_toggle_dm_${org.id}`).setLabel('Вкл/Выкл ЛС при ручном добавлении').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`contracts_toggle_collect_${org.id}`).setLabel('Вкл/Выкл сбор участников').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`contracts_toggle_enabled_${org.id}`).setLabel('Вкл/Выкл организацию').setStyle(org.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
  ));
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`contracts_active_list_${org.id}`).setLabel('Активные контракты').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`contracts_delete_org_${org.id}`).setLabel('Удалить организацию').setStyle(ButtonStyle.Danger)
  ));
  return rows;
}

function contractEmbed(contract, org) {
  const statusMap = {
    collecting: '🟡 Сбор участников',
    running: '🟢 Выполнение',
    finished: '✅ Завершено',
    cancelled: '🔴 Отменено'
  };
  const embed = new EmbedBuilder()
    .setTitle(`Контракт • ${contract.name}`)
    .setColor('#1D1D1E')
    .addFields(
      { name: 'Организация', value: org.name, inline: true },
      { name: 'Автор', value: `<@${contract.authorId}>`, inline: true },
      { name: 'Длительность', value: `${contract.durationMinutes} мин`, inline: true },
      { name: 'Статус', value: statusMap[contract.status], inline: true }
    )
    .setFooter({ text: `ID: ${contract.id}` })
    .setTimestamp();

  const participants = Object.entries(contract.participants || {}).filter(([, p]) => p.joined);
  const participantsText = participants.length === 0 ? '—'
    : participants.map(([uid, p]) => `${p.done ? '✅' : (org.settings.doneEmojiEnabled ? '❌' : '')} <@${uid}>`).join('\n');
  embed.addFields({ name: 'Участники', value: participantsText, inline: false });

  return embed;
}

function contractComponents(contract, org) {
  const rows = [];
  const row1 = new ActionRowBuilder();
  if (!org.settings.manualAddEnabled || org.settings.manualAllowJoinEnabled) {
    // Разрешаем участие в любом случае, если manualAdd выключен; или если включен, но разрешено участие
    if (contract.status === 'collecting' || contract.status === 'running') {
      row1.addComponents(new ButtonBuilder().setCustomId(`contracts_join_${contract.id}`).setLabel(contract.participants?.[contract.authorId]?.joined ? 'Участвую' : 'Участвовать').setStyle(ButtonStyle.Secondary));
    }
  }
  if (org.settings.doneEmojiEnabled && (contract.status === 'collecting' || contract.status === 'running')) {
    row1.addComponents(new ButtonBuilder().setCustomId(`contracts_done_${contract.id}`).setLabel('Выполнено').setStyle(ButtonStyle.Secondary));
  }
  rows.push(row1);

  const row2 = new ActionRowBuilder();
  if (org.settings.collectParticipantsEnabled && contract.status === 'collecting') {
    row2.addComponents(new ButtonBuilder().setCustomId(`contracts_start_${contract.id}`).setLabel('Начать выполнение').setStyle(ButtonStyle.Success));
  }
  if (contract.status === 'collecting' || contract.status === 'running') {
    row2.addComponents(new ButtonBuilder().setCustomId(`contracts_finish_${contract.id}`).setLabel('Завершить').setStyle(ButtonStyle.Primary));
    row2.addComponents(new ButtonBuilder().setCustomId(`contracts_cancel_${contract.id}`).setLabel('Отменить').setStyle(ButtonStyle.Danger));
  }
  rows.push(row2);

  return rows;
}

async function ensureOrgChannels(interaction, orgName) {
  // Creates category + 3 channels
  const category = await interaction.guild.channels.create({ name: `${orgName} • Контракты`, type: 4 });
  const takeChannel = await interaction.guild.channels.create({ name: 'взять-контракт', type: 0, parent: category.id });
  const notifyChannel = await interaction.guild.channels.create({ name: 'уведомления-контрактов', type: 0, parent: category.id });
  const logsChannel = await interaction.guild.channels.create({ name: 'логи-контрактов', type: 0, parent: category.id });
  return { categoryId: category.id, takeChannelId: takeChannel.id, notifyChannelId: notifyChannel.id, logsChannelId: logsChannel.id };
}

async function postTakeMessage(guild, channelId, orgId, orgName) {
  const channel = await guild.channels.fetch(channelId);
  if (!channel || !channel.isTextBased()) return null;
  const embed = new EmbedBuilder()
    .setTitle(`Контракты • ${orgName}`)
    .setDescription('Нажмите «Взять контракт», чтобы начать. Также вы можете посмотреть активные контракты.')
    .setColor('#1D1D1E');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`contracts_take_${orgId}`).setLabel('Взять контракт').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`contracts_active_list_${orgId}`).setLabel('Активные контракты').setStyle(ButtonStyle.Secondary)
  );
  const msg = await channel.send({ embeds: [embed], components: [row] });
  return msg.id;
}

async function showModuleHome(interaction) {
  const guildState = getGuildState(interaction.guild.id);
  await interaction.reply({ embeds: [moduleHomeEmbed(guildState)], components: moduleHomeComponents(guildState), ephemeral: true });
}

async function showOrgManage(interaction, orgId) {
  const guildState = getGuildState(interaction.guild.id);
  const org = findOrg(guildState, orgId);
  if (!org) return interaction.reply({ content: 'Организация не найдена.', ephemeral: true });
  await interaction.reply({ embeds: [orgManageEmbed(org)], components: orgManageComponents(org), ephemeral: true });
}

async function createContract(guild, guildState, org, authorId, durationMinutes, name) {
  const contractId = generateId('ct');
  const now = Date.now();
  const displayName = name && name.trim() ? name.trim() : defaultContractName(new Date(now), guildState);
  const contract = {
    id: contractId,
    orgId: org.id,
    name: displayName,
    authorId,
    durationMinutes,
    createdAt: now,
    startedAt: org.settings.collectParticipantsEnabled ? null : now,
    status: org.settings.collectParticipantsEnabled ? 'collecting' : 'running',
    participants: {}
  };
  // Initial participants: author always participating
  contract.participants[authorId] = { joined: true, done: false };

  // Post notify message
  const notifyChannel = await guild.channels.fetch(org.notifyChannelId);
  if (!notifyChannel || !notifyChannel.isTextBased()) throw new Error('Notify channel not found');
  const content = org.mentionRoleIds.length ? org.mentionRoleIds.map(id => `<@&${id}>`).join(' ') : null;
  const message = await notifyChannel.send({ content, embeds: [contractEmbed(contract, org)], components: contractComponents(contract, org) });
  contract.notifyMessageId = message.id;
  contract.notifyChannelId = org.notifyChannelId;
  contract.logsChannelId = org.logsChannelId;

  // Save
  guildState.contracts[contractId] = contract;
  setGuildState(guild.id, guildState);

  // Timer if running
  if (contract.status === 'running') scheduleFinishTimer(guild, guildState, contractId);

  // Log start if running immediately
  if (contract.status === 'running') await logToOrg(guild, org.logsChannelId, `Начат контракт «${contract.name}» автором <@${authorId}> на ${durationMinutes} мин.`);

  return contract;
}

function defaultContractName(date, guildState) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const sameDay = Object.values(guildState.contracts).filter(c => new Date(c.createdAt).getDate() === date.getDate() && new Date(c.createdAt).getMonth() === date.getMonth() && new Date(c.createdAt).getFullYear() === date.getFullYear());
  const seq = sameDay.length + 1;
  return `${d}.${m}.${y} №${seq}`;
}

function scheduleFinishTimer(guild, guildState, contractId) {
  const contract = guildState.contracts[contractId];
  if (!contract || contract.status !== 'running') return;
  const msLeft = contract.startedAt + contract.durationMinutes * 60 * 1000 - Date.now();
  if (msLeft <= 0) return finishContract(guild, guildState, contractId, 'Автозавершение по времени');
  clearExistingTimer(contractId);
  const t = setTimeout(() => finishContract(guild, getGuildState(guild.id), contractId, 'Автозавершение по времени'), msLeft);
  contractTimers.set(contractId, t);
}

function clearExistingTimer(contractId) {
  const t = contractTimers.get(contractId);
  if (t) { clearTimeout(t); contractTimers.delete(contractId); }
}

async function updateContractMessage(guild, contractId) {
  const guildState = getGuildState(guild.id);
  const contract = guildState.contracts[contractId];
  if (!contract) return;
  const org = findOrg(guildState, contract.orgId);
  if (!org) return;
  try {
    const ch = await guild.channels.fetch(contract.notifyChannelId);
    if (!ch || !ch.isTextBased()) return;
    const msg = await ch.messages.fetch(contract.notifyMessageId);
    await msg.edit({ embeds: [contractEmbed(contract, org)], components: contractComponents(contract, org) });
  } catch {}
}

async function logToOrg(guild, logsChannelId, text) {
  try {
    const ch = await guild.channels.fetch(logsChannelId);
    if (!ch || !ch.isTextBased()) return;
    const embed = new EmbedBuilder().setColor('#1D1D1E').setDescription(text).setTimestamp();
    await ch.send({ embeds: [embed] });
  } catch {}
}

async function finishContract(guild, guildState, contractId, reasonText) {
  const contract = guildState.contracts[contractId];
  if (!contract || (contract.status !== 'running' && contract.status !== 'collecting')) return;
  contract.status = 'finished';
  clearExistingTimer(contractId);
  setGuildState(guild.id, guildState);
  await updateContractMessage(guild, contractId);
  await logToOrg(guild, contract.logsChannelId, `Контракт «${contract.name}» завершён. ${reasonText ? '(' + reasonText + ')' : ''}`);
}

async function cancelContract(guild, guildState, contractId) {
  const contract = guildState.contracts[contractId];
  if (!contract || (contract.status !== 'running' && contract.status !== 'collecting')) return;
  contract.status = 'cancelled';
  clearExistingTimer(contractId);
  setGuildState(guild.id, guildState);
  await updateContractMessage(guild, contractId);
  await logToOrg(guild, contract.logsChannelId, `Контракт «${contract.name}» отменён.`);
}

// --------- Commands ---------
const modulesCommand = {
  data: {
    name: 'модули',
    description: 'Управление модулями',
    options: [
      { type: 1, name: 'контракты', description: 'Модуль «Контракты»' }
    ]
  },
  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'контракты') {
      return showModuleHome(interaction);
    }
  },
  async handleComponent(interaction, client) {
    if (!interaction.customId.startsWith('contracts_')) return false;
    const guildId = interaction.guild.id;
    const guildState = getGuildState(guildId);

    // INSTALL
    if (interaction.customId === 'contracts_install') {
      if (!requireAdmin(interaction)) return interaction.reply({ content: 'Требуются права администратора.', ephemeral: true });
      if (guildState.orgs.length >= 3) return interaction.reply({ content: 'Достигнут лимит: 3 организации.', ephemeral: true });
      const modal = new ModalBuilder().setCustomId('contracts_install_modal').setTitle('Установка модуля «Контракты»')
        .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('org_name').setLabel('Название организации').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(64)));
      await interaction.showModal(modal);
      return true;
    }

    if (interaction.customId.startsWith('contracts_manage_org_')) {
      const orgId = interaction.customId.split('contracts_manage_org_')[1];
      return showOrgManage(interaction, orgId), true;
    }

    // Rename org
    if (interaction.customId.startsWith('contracts_rename_')) {
      if (!requireAdmin(interaction)) return interaction.reply({ content: 'Требуются права администратора.', ephemeral: true });
      const orgId = interaction.customId.split('contracts_rename_')[1];
      const modal = new ModalBuilder().setCustomId(`contracts_rename_modal_${orgId}`).setTitle('Переименовать организацию')
        .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('new_name').setLabel('Новое название').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(64)));
      await interaction.showModal(modal);
      return true;
    }

    // Update roles select
    if (interaction.customId.startsWith('contracts_update_roles_')) {
      if (!requireAdmin(interaction)) return interaction.reply({ content: 'Требуются права администратора.', ephemeral: true });
      const orgId = interaction.customId.split('contracts_update_roles_')[1];
      const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(`contracts_update_roles_select_${orgId}`).setPlaceholder('Выберите до 8 ролей').setMaxValues(8));
      await interaction.reply({ content: 'Выберите роли для упоминаний:', components: [row], ephemeral: true });
      return true;
    }

    // Update permissions
    if (interaction.customId.startsWith('contracts_update_perms_')) {
      if (!requireAdmin(interaction)) return interaction.reply({ content: 'Требуются права администратора.', ephemeral: true });
      const orgId = interaction.customId.split('contracts_update_perms_')[1];
      const row = new ActionRowBuilder().addComponents(
        {
          type: 3,
          custom_id: `contracts_update_perms_select_${orgId}`,
          placeholder: 'Выберите уровень доступа',
          options: [
            { label: 'Все пользователи', value: 'everyone', description: 'Любой может завершать/отменять' },
            { label: 'Админ или автор', value: 'admin_author', description: 'Только администратор сервера или автор' },
            { label: 'Админ/лидер/зам/автор', value: 'admin_leader_author', description: 'Трактуется как админ/автор' },
            { label: 'Админ/лидер/зам/старший/автор', value: 'admin_leader_senior_author', description: 'Трактуется как админ/автор' }
          ],
          min_values: 1,
          max_values: 1,
          type: 3 // StringSelect
        }
      );
      await interaction.reply({ content: 'Выберите права:', components: [row], ephemeral: true });
      return true;
    }

    // Toggles
    const toggleMap = [
      ['contracts_toggle_done_', 'doneEmojiEnabled'],
      ['contracts_toggle_manual_', 'manualAddEnabled'],
      ['contracts_toggle_manual_join_', 'manualAllowJoinEnabled'],
      ['contracts_toggle_dm_', 'dmOnManualAddEnabled'],
      ['contracts_toggle_collect_', 'collectParticipantsEnabled'],
      ['contracts_toggle_enabled_', 'enabled']
    ];
    for (const [prefix, field] of toggleMap) {
      if (interaction.customId.startsWith(prefix)) {
        if (!requireAdmin(interaction)) return interaction.reply({ content: 'Требуются права администратора.', ephemeral: true });
        const orgId = interaction.customId.split(prefix)[1];
        const org = findOrg(guildState, orgId);
        if (!org) return interaction.reply({ content: 'Организация не найдена.', ephemeral: true });
        if (field === 'enabled') org.enabled = !org.enabled; else org.settings[field] = !org.settings[field];
        setGuildState(guildId, guildState);
        return interaction.reply({ embeds: [orgManageEmbed(org)], components: orgManageComponents(org), ephemeral: true });
      }
    }

    // Delete org
    if (interaction.customId.startsWith('contracts_delete_org_')) {
      if (!requireAdmin(interaction)) return interaction.reply({ content: 'Требуются права администратора.', ephemeral: true });
      const orgId = interaction.customId.split('contracts_delete_org_')[1];
      const org = findOrg(guildState, orgId);
      if (!org) return interaction.reply({ content: 'Организация не найдена.', ephemeral: true });
      try {
        if (org.takeChannelId) await interaction.guild.channels.delete(org.takeChannelId).catch(() => {});
        if (org.notifyChannelId) await interaction.guild.channels.delete(org.notifyChannelId).catch(() => {});
        if (org.logsChannelId) await interaction.guild.channels.delete(org.logsChannelId).catch(() => {});
        if (org.categoryId) await interaction.guild.channels.delete(org.categoryId).catch(() => {});
      } catch {}
      guildState.orgs = guildState.orgs.filter(o => o.id !== orgId);
      // Remove contracts of org
      for (const [cid, c] of Object.entries(guildState.contracts)) {
        if (c.orgId === orgId) delete guildState.contracts[cid];
      }
      setGuildState(guildId, guildState);
      return interaction.reply({ content: 'Организация удалена.', ephemeral: true });
    }

    // Active contracts list
    if (interaction.customId.startsWith('contracts_active_list_')) {
      const orgId = interaction.customId.split('contracts_active_list_')[1];
      const active = Object.values(guildState.contracts).filter(c => c.orgId === orgId && (c.status === 'collecting' || c.status === 'running'));
      if (active.length === 0) return interaction.reply({ content: 'Активных контрактов нет.', ephemeral: true });
      const embed = new EmbedBuilder().setTitle('Активные контракты').setColor('#1D1D1E');
      active.forEach(c => embed.addFields({ name: c.name, value: `Автор: <@${c.authorId}> • Длительность: ${c.durationMinutes} мин • Статус: ${c.status} • ID: ${c.id}` }));
      const rows = [];
      let row = new ActionRowBuilder();
      for (const c of active) {
        const btn = new ButtonBuilder().setCustomId(`contracts_view_${c.id}`).setLabel(c.name.slice(0, 80)).setStyle(ButtonStyle.Secondary);
        if (row.components.length >= 5) { rows.push(row); row = new ActionRowBuilder(); }
        row.addComponents(btn);
      }
      if (row.components.length) rows.push(row);
      return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
    }

    // View specific contract -> jump via link
    if (interaction.customId.startsWith('contracts_view_')) {
      const cid = interaction.customId.split('contracts_view_')[1];
      const c = guildState.contracts[cid];
      if (!c) return interaction.reply({ content: 'Контракт не найден.', ephemeral: true });
      try {
        const ch = await interaction.guild.channels.fetch(c.notifyChannelId);
        const msg = await ch.messages.fetch(c.notifyMessageId);
        return interaction.reply({ content: `Перейти к сообщению: ${msg.url}`, ephemeral: true });
      } catch {
        return interaction.reply({ content: 'Сообщение контрактов не найдено.', ephemeral: true });
      }
    }

    // Take contract button
    if (interaction.customId.startsWith('contracts_take_')) {
      const orgId = interaction.customId.split('contracts_take_')[1];
      const org = findOrg(guildState, orgId);
      if (!org) return interaction.reply({ content: 'Организация не найдена.', ephemeral: true });
      if (!org.enabled) return interaction.reply({ content: 'Организация отключена. Создание контрактов приостановлено.', ephemeral: true });
      const modal = new ModalBuilder().setCustomId(`contracts_take_modal_${orgId}`).setTitle('Взять контракт')
        .addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('hours').setLabel('Часы (целое число)').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('minutes').setLabel('Минуты (целое число)').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Название (опционально)').setStyle(TextInputStyle.Short).setRequired(false))
        );
      await interaction.showModal(modal);
      return true;
    }

    // Join/Done/Start/Finish/Cancel buttons
    if (interaction.customId.startsWith('contracts_join_')) {
      const cid = interaction.customId.split('contracts_join_')[1];
      const c = guildState.contracts[cid];
      if (!c) return interaction.reply({ content: 'Контракт не найден.', ephemeral: true });
      const org = findOrg(guildState, c.orgId);
      if (!org) return interaction.reply({ content: 'Организация не найдена.', ephemeral: true });
      if (c.status !== 'collecting' && c.status !== 'running') return interaction.reply({ content: 'Контракт недоступен для участия.', ephemeral: true });
      if (org.settings.manualAddEnabled && !org.settings.manualAllowJoinEnabled) return interaction.reply({ content: 'Участие отключено. Участников добавляет автор.', ephemeral: true });
      c.participants[interaction.user.id] = c.participants[interaction.user.id] ? { joined: !c.participants[interaction.user.id].joined, done: false } : { joined: true, done: false };
      setGuildState(guildId, guildState);
      await updateContractMessage(interaction.guild, cid);
      return interaction.reply({ content: 'Участие обновлено.', ephemeral: true });
    }

    if (interaction.customId.startsWith('contracts_done_')) {
      const cid = interaction.customId.split('contracts_done_')[1];
      const c = guildState.contracts[cid];
      if (!c) return interaction.reply({ content: 'Контракт не найден.', ephemeral: true });
      const org = findOrg(guildState, c.orgId);
      if (!org || !org.settings.doneEmojiEnabled) return interaction.reply({ content: 'Недоступно.', ephemeral: true });
      const p = c.participants[interaction.user.id];
      if (!p || !p.joined) return interaction.reply({ content: 'Сначала присоединитесь к контракту.', ephemeral: true });
      p.done = !p.done;
      setGuildState(guildId, guildState);
      await updateContractMessage(interaction.guild, cid);
      return interaction.reply({ content: p.done ? 'Отмечено как выполнено.' : 'Отметка снята.', ephemeral: true });
    }

    if (interaction.customId.startsWith('contracts_start_')) {
      const cid = interaction.customId.split('contracts_start_')[1];
      const c = guildState.contracts[cid];
      if (!c) return interaction.reply({ content: 'Контракт не найден.', ephemeral: true });
      if (c.status !== 'collecting') return interaction.reply({ content: 'Контракт уже запущен или завершён.', ephemeral: true });
      if (!canManageContract(interaction, c, guildState)) return interaction.reply({ content: 'Недостаточно прав.', ephemeral: true });
      c.status = 'running';
      c.startedAt = Date.now();
      setGuildState(guildId, guildState);
      await updateContractMessage(interaction.guild, cid);
      scheduleFinishTimer(interaction.guild, guildState, cid);
      await logToOrg(interaction.guild, c.logsChannelId, `Контракт «${c.name}» запущен.`);
      return interaction.reply({ content: 'Выполнение начато.', ephemeral: true });
    }

    if (interaction.customId.startsWith('contracts_finish_')) {
      const cid = interaction.customId.split('contracts_finish_')[1];
      const c = guildState.contracts[cid];
      if (!c) return interaction.reply({ content: 'Контракт не найден.', ephemeral: true });
      if (!canManageContract(interaction, c, guildState)) return interaction.reply({ content: 'Недостаточно прав.', ephemeral: true });
      await finishContract(interaction.guild, guildState, cid, 'Завершено вручную');
      return interaction.reply({ content: 'Контракт завершён.', ephemeral: true });
    }

    if (interaction.customId.startsWith('contracts_cancel_')) {
      const cid = interaction.customId.split('contracts_cancel_')[1];
      const c = guildState.contracts[cid];
      if (!c) return interaction.reply({ content: 'Контракт не найден.', ephemeral: true });
      if (!canManageContract(interaction, c, guildState)) return interaction.reply({ content: 'Недостаточно прав.', ephemeral: true });
      await cancelContract(interaction.guild, guildState, cid);
      return interaction.reply({ content: 'Контракт отменён.', ephemeral: true });
    }

    return false;
  },
};

const contractsAliasCommand = {
  data: {
    name: 'контракты',
    description: 'Управление модулем «Контракты»'
  },
  async execute(interaction, client) {
    return showModuleHome(interaction);
  },
  handleComponent: modulesCommand.handleComponent
};

// --------- Modal handlers and Select menus ---------
async function handleModal(interaction, client) {
  if (interaction.customId === 'contracts_install_modal') {
    if (!requireAdmin(interaction)) return interaction.reply({ content: 'Требуются права администратора.', ephemeral: true });
    const orgName = interaction.fields.getTextInputValue('org_name').trim();
    const guildState = getGuildState(interaction.guild.id);
    if (guildState.orgs.length >= 3) return interaction.reply({ content: 'Достигнут лимит: 3 организации.', ephemeral: true });

    // Create channels/category
    const channels = await ensureOrgChannels(interaction, orgName);

    const orgId = `ORG${guildState.nextOrgSeq}`;
    guildState.nextOrgSeq += 1;
    const takeMsgId = await postTakeMessage(interaction.guild, channels.takeChannelId, orgId, orgName);
    const org = {
      id: orgId,
      name: orgName,
      categoryId: channels.categoryId,
      takeChannelId: channels.takeChannelId,
      notifyChannelId: channels.notifyChannelId,
      logsChannelId: channels.logsChannelId,
      baseTakeMessageId: takeMsgId,
      mentionRoleIds: [],
      enabled: true,
      settings: {
        permissionMode: 'admin_author',
        doneEmojiEnabled: true,
        manualAddEnabled: false,
        manualAllowJoinEnabled: true,
        dmOnManualAddEnabled: false,
        collectParticipantsEnabled: false
      }
    };
    guildState.orgs.push(org);
    setGuildState(interaction.guild.id, guildState);

    // Ask for roles (optional)
    const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(`contracts_install_roles_${org.id}`).setPlaceholder('Выберите до 8 ролей (опционально)').setMaxValues(8));
    await interaction.reply({ content: 'Организация создана! Выберите роли для упоминания (опционально):', components: [row], ephemeral: true });
    return true;
  }

  if (interaction.customId.startsWith('contracts_rename_modal_')) {
    if (!requireAdmin(interaction)) return interaction.reply({ content: 'Требуются права администратора.', ephemeral: true });
    const orgId = interaction.customId.split('contracts_rename_modal_')[1];
    const newName = interaction.fields.getTextInputValue('new_name').trim();
    const guildState = getGuildState(interaction.guild.id);
    const org = findOrg(guildState, orgId);
    if (!org) return interaction.reply({ content: 'Организация не найдена.', ephemeral: true });
    org.name = newName;
    try {
      if (org.categoryId) {
        const cat = await interaction.guild.channels.fetch(org.categoryId);
        await cat.setName(`${newName} • Контракты`).catch(() => {});
      }
    } catch {}
    setGuildState(interaction.guild.id, guildState);
    return interaction.reply({ content: 'Название обновлено.', ephemeral: true });
  }

  if (interaction.customId.startsWith('contracts_take_modal_')) {
    const orgId = interaction.customId.split('contracts_take_modal_')[1];
    const guildState = getGuildState(interaction.guild.id);
    const org = findOrg(guildState, orgId);
    if (!org || !org.enabled) return interaction.reply({ content: 'Организация не найдена или отключена.', ephemeral: true });
    const hours = parseInt(interaction.fields.getTextInputValue('hours')) || 0;
    const minutes = parseInt(interaction.fields.getTextInputValue('minutes')) || 0;
    const name = (interaction.fields.getTextInputValue('name') || '').trim();
    const durationMinutes = hours * 60 + minutes;
    if (durationMinutes <= 0) return interaction.reply({ content: 'Укажите длительность больше 0.', ephemeral: true });

    if (org.settings.manualAddEnabled) {
      // Ask to select participants (up to 20)
      const tempId = generateId('new');
      pendingCreations.set(tempId, { guildId: interaction.guild.id, orgId: org.id, authorId: interaction.user.id, durationMinutes, name });
      const row = new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`contracts_select_participants_${tempId}`).setPlaceholder('Выберите участников (до 20)').setMaxValues(20));
      await interaction.reply({ content: 'Выберите участников контракта:', components: [row], ephemeral: true });
      return true;
    } else {
      // Create immediately
      await createContract(interaction.guild, guildState, org, interaction.user.id, durationMinutes, name);
      return interaction.reply({ content: 'Контракт создан.', ephemeral: true });
    }
  }

  return false;
}

async function handleSelect(interaction, client) {
  const cid = interaction.customId;
  const guildState = getGuildState(interaction.guild.id);

  if (cid.startsWith('contracts_install_roles_')) {
    const orgId = cid.split('contracts_install_roles_')[1];
    const org = findOrg(guildState, orgId);
    if (!org) return interaction.reply({ content: 'Организация не найдена.', ephemeral: true });
    org.mentionRoleIds = interaction.values.slice(0, 8);
    setGuildState(interaction.guild.id, guildState);
    return interaction.reply({ content: 'Роли сохранены.', ephemeral: true });
  }

  if (cid.startsWith('contracts_update_roles_select_')) {
    const orgId = cid.split('contracts_update_roles_select_')[1];
    const org = findOrg(guildState, orgId);
    if (!org) return interaction.reply({ content: 'Организация не найдена.', ephemeral: true });
    org.mentionRoleIds = interaction.values.slice(0, 8);
    setGuildState(interaction.guild.id, guildState);
    return interaction.reply({ content: 'Роли обновлены.', ephemeral: true });
  }

  if (cid.startsWith('contracts_update_perms_select_')) {
    const orgId = cid.split('contracts_update_perms_select_')[1];
    const org = findOrg(guildState, orgId);
    if (!org) return interaction.reply({ content: 'Организация не найдена.', ephemeral: true });
    org.settings.permissionMode = interaction.values[0];
    setGuildState(interaction.guild.id, guildState);
    return interaction.reply({ content: 'Права обновлены.', ephemeral: true });
  }

  if (cid.startsWith('contracts_select_participants_')) {
    const tempId = cid.split('contracts_select_participants_')[1];
    const pending = pendingCreations.get(tempId);
    if (!pending || pending.guildId !== interaction.guild.id) return interaction.reply({ content: 'Истекла сессия выбора.', ephemeral: true });
    const org = findOrg(getGuildState(pending.guildId), pending.orgId);
    if (!org) return interaction.reply({ content: 'Организация не найдена.', ephemeral: true });
    const guildState2 = getGuildState(pending.guildId);
    const contract = await createContract(interaction.guild, guildState2, org, pending.authorId, pending.durationMinutes, pending.name);
    // Add selected participants
    const participants = interaction.values.slice(0, 20);
    for (const uid of participants) {
      contract.participants[uid] = { joined: true, done: false };
      if (org.settings.dmOnManualAddEnabled) {
        try { const u = await interaction.client.users.fetch(uid); await u.send({ content: `Вы добавлены в контракт «${contract.name}».` }); } catch {}
      }
    }
    // Save and update message
    const gs = getGuildState(pending.guildId);
    gs.contracts[contract.id] = contract;
    setGuildState(pending.guildId, gs);
    await updateContractMessage(interaction.guild, contract.id);
    pendingCreations.delete(tempId);
    return interaction.reply({ content: 'Контракт создан и участники добавлены.', ephemeral: true });
  }

  return false;
}

module.exports = {
  commands: [modulesCommand, contractsAliasCommand],
  handleComponent: modulesCommand.handleComponent,
  handleModal,
  handleSelect
};