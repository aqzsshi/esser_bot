const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

// Список карт территорий войны за бизнес
const WAR_MAPS = [
  'квадрики',
  'лнс',
  'самолеты',
  'свалка',
  'бладсы',
  'большие конты',
  'грейпсид',
  'динозаврик',
  'зерно',
  'кай перика',
  'малые конты',
  'мексы',
  'мирор',
  'нефть',
  'сдача мяса',
  'старая поставка',
  'стеб',
  'стройка 1',
  'стройка 2',
  'тшка',
  'ферма мексы'
];

// Карта -> URL изображения (поставьте реальные ссылки при необходимости)
// По умолчанию используется один и тот же плейсхолдер, если ссылка не задана
const DEFAULT_IMAGE = 'https://i.ibb.co/8nmDpF27/image.png';
const MAP_IMAGES = Object.fromEntries(WAR_MAPS.map(name => [name, DEFAULT_IMAGE]));

const warMapsCommand = {
  data: new SlashCommandBuilder()
    .setName('вс_мапы')
    .setDescription('Показать карты территорий войны за бизнес с выбором изображения'),

  async execute(interaction) {
    // Начальный embed с общей картинкой и описанием
    const embed = new EmbedBuilder()
      .setColor('#2f3136')
      .setTitle('🗺️ Карты территорий войны за бизнес')
      .setDescription('Выберите карту в меню ниже, и изображение обновится на фото выбранной карты.')
      .setImage(DEFAULT_IMAGE)
      .setTimestamp();

    // Селект с картами (≤25 опций)
    const select = new StringSelectMenuBuilder()
      .setCustomId('war_maps_select')
      .setPlaceholder('Выберите карту')
      .addOptions(
        WAR_MAPS.map((mapName, index) => ({
          label: mapName,
          value: mapName,
          description: `Карта #${index + 1}`
        }))
      );

    const row = new ActionRowBuilder().addComponents(select);

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
  },

  async handleComponent(interaction) {
    if (!interaction.isStringSelectMenu()) return false;
    if (interaction.customId !== 'war_maps_select') return false;

    const selected = interaction.values[0];
    const imageUrl = MAP_IMAGES[selected] || DEFAULT_IMAGE;

    const updated = new EmbedBuilder()
      .setColor('#2f3136')
      .setTitle('🗺️ Карты территорий войны за бизнес')
      .setDescription(`Вы выбрали: **${selected}**`)
      .setImage(imageUrl)
      .setTimestamp();

    await interaction.update({ embeds: [updated] });
    return true;
  }
};

module.exports = { commands: [warMapsCommand] };

