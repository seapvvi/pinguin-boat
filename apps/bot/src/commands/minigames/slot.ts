import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { getEconomySettings, getOrCreateWallet } from '../../services/economy';
import { getMinigameSettings, createGameSession, endGameSession, minigameChannelError } from '../../services/minigames';
import { errorEmbed, createEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';
import { setCooldown } from '../../guards/cooldown';
import { logger } from '@pinguin/shared';

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '⭐', '7️⃣'] as const;

const PAYOUTS: Record<string, Record<string, number>> = {
  '7️⃣': { 3: 50, 2: 3 },
  '💎': { 3: 20, 2: 2 },
  '⭐': { 3: 10, 2: 0 },
  '🔔': { 3: 5, 2: 0 },
  '🍇': { 3: 3, 2: 0 },
  '🍊': { 3: 2, 2: 0 },
  '🍋': { 3: 1.5, 2: 0 },
  '🍒': { 3: 1.5, 2: 0 },
};

function randomSymbol(): string {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function spinReels(): string[] {
  return [randomSymbol(), randomSymbol(), randomSymbol()];
}

function calculatePayout(reels: string[], bet: number): number {
  const [a, b, c] = reels;

  if (a === b && b === c) {
    return Math.floor(bet * (PAYOUTS[a]?.[3] ?? 1));
  }

  if (a === b || a === c || b === c) {
    const match = a === b ? a : a === c ? a : b;
    return Math.floor(bet * (PAYOUTS[match]?.[2] ?? 0));
  }

  return 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSlotDisplay(reels: string[], highlight = false): string {
  const sym = (s: string) => (highlight ? `**${s}**` : s);
  return `\`\`\`╔═══════════════╗\n║   ${sym(reels[0])} │ ${sym(reels[1])} │ ${sym(reels[2])}   ║\n╚═══════════════╝\`\`\``;
}

function getMultiplierLabel(mult: number): string {
  if (mult >= 50) return '🔥 JACKPOT';
  if (mult >= 20) return '💎 MÉGA GAIN';
  if (mult >= 10) return '⭐ SUPER GAIN';
  if (mult >= 5) return '🔔 GROS GAIN';
  if (mult >= 2) return '👍 GAIN';
  return '';
}

export const data = new SlashCommandBuilder()
  .setName('slotmachine')
  .setDescription('Tentez votre chance à la machine à sous 777 !')
  .addIntegerOption((opt) =>
    opt.setName('mise')
      .setDescription('Mise en coins')
      .setRequired(true)
      .setMinValue(1)
  );

export const module = 'minigames';

export async function execute(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) return;

  try {
    if (!(await isModuleEnabled(interaction.guild.id, 'minigames'))) {
      await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'Le module minijeux est désactivé sur ce serveur.')] });
      return;
    }

    const settings = await getMinigameSettings(interaction.guild.id);
    const economySettings = await getEconomySettings(interaction.guild.id);

    const channelErr = minigameChannelError(settings, interaction.channelId);
    if (channelErr) {
      await interaction.editReply({ embeds: [errorEmbed('Mauvais salon', channelErr)] });
      return;
    }

    const bet = interaction.options.getInteger('mise', true);

    if (bet < settings.betMin || bet > settings.betMax) {
      await interaction.editReply({
        embeds: [errorEmbed('Mise invalide', `La mise doit être entre ${settings.betMin} et ${settings.betMax} ${economySettings.currencySymbol}.`)]
      });
      return;
    }

    await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());
    const wallet = await getOrCreateWallet(interaction.guild.id, interaction.user.id, economySettings.startupBalance);

    if (wallet.wallet < bet) {
      await interaction.editReply({
        embeds: [errorEmbed('Fonds insuffisants', `Vous n'avez que ${wallet.wallet} ${economySettings.currencySymbol} dans votre portefeuille.`)]
      });
      return;
    }

    setCooldown(interaction.user.id, 'slotmachine', 3);

    const finalReels = spinReels();
    const payout = calculatePayout(finalReels, bet);
    const isJackpot = payout >= bet * 50;
    const isWin = payout > 0;

    await prisma.economyWallet.update({
      where: { guildId_userId: { guildId: interaction.guild!.id, userId: interaction.user.id } },
      data: {
        wallet: { decrement: bet },
        ...(payout > 0 ? { wallet: { increment: payout }, totalEarned: { increment: payout - bet } } : {}),
      },
    });

    await prisma.economyTransaction.create({
      data: {
        guildId: interaction.guild!.id,
        toUserId: interaction.user.id,
        amount: payout,
        type: 'GAMBLE',
        description: `Machine à sous 777 - ${payout > 0 ? `Gagné x${(payout / bet).toFixed(1)}` : 'Perdu'}`,
      },
    });

    if (isJackpot) {
      await prisma.jackpotWin.create({
        data: {
          guildId: interaction.guild!.id,
          userId: interaction.user.id,
          bet,
          payout,
          symbols: finalReels.join(' '),
        },
      });
    }

    const session = await createGameSession(
      interaction.guild.id,
      interaction.user.id,
      'slot_machine',
      bet,
      interaction.channelId,
      interaction.id
    );
    await endGameSession(session.id, isWin ? 'won' : 'lost', payout - bet);

    const spinEmbed = createEmbed('minigame')
      .setTitle('🎰 Machine à sous')
      .setDescription(`${buildSlotDisplay(['?', '?', '?'])}\n\n⏳ **La machine s'active...**`)
      .addFields(
        { name: 'Mise', value: `${bet} ${economySettings.currencySymbol}`, inline: true },
      )
      .setColor(0xf59e0b)
      .setTimestamp();

    await interaction.editReply({ embeds: [spinEmbed] });

    const timings = [350, 350, 400, 450, 500, 600];

    for (let frame = 0; frame < timings.length; frame++) {
      await sleep(timings[frame]);

      const progress = frame + 1;
      let displayReels: string[];

      if (progress <= 3) {
        displayReels = [randomSymbol(), randomSymbol(), randomSymbol()];
      } else if (progress === 4) {
        displayReels = [finalReels[0], randomSymbol(), randomSymbol()];
      } else if (progress === 5) {
        displayReels = [finalReels[0], finalReels[1], randomSymbol()];
      } else {
        displayReels = finalReels;
      }

      const statusText =
        progress <= 3 ? '🎰 **Les rouleaux tournent...**' :
        progress === 4 ? '🎰 **Premier rouleau s\'arrête...**' :
        progress === 5 ? '🎰 **Deuxième rouleau s\'arrête...**' :
        '🎰 **Résultat !**';

      const animEmbed = createEmbed('minigame')
        .setTitle('🎰 Machine à sous')
        .setDescription(`${buildSlotDisplay(displayReels)}\n\n${statusText}`)
        .addFields(
          { name: 'Mise', value: `${bet} ${economySettings.currencySymbol}`, inline: true },
        )
        .setColor(0xf59e0b)
        .setTimestamp();

      await interaction.editReply({ embeds: [animEmbed] });
    }

    const mult = payout / bet;
    const label = getMultiplierLabel(mult);
    const jackpotStars = isJackpot ? '\n\n🌟 ⭐ ✨ **JACKPOT !** ✨ ⭐ 🌟' : '';

    const title = isJackpot
      ? '🎰💥💥💥 JACKPOT !!! 💥💥💥🎰'
      : isWin
        ? `🎰 ${label || 'Gagné !'}`
        : '🎰 Perdu...';

    const color = isJackpot ? 0xffd700 : isWin ? 0x22c55e : 0xef4444;

    const resultEmbed = createEmbed('minigame')
      .setTitle(title)
      .setDescription(`${buildSlotDisplay(finalReels, isWin)}${jackpotStars}`)
      .addFields(
        { name: 'Mise', value: `${bet} ${economySettings.currencySymbol}`, inline: true },
        { name: 'Gain', value: payout > 0 ? `**+${payout}** ${economySettings.currencySymbol}` : `**0** ${economySettings.currencySymbol}`, inline: true },
        { name: 'Multiplicateur', value: payout > 0 ? `x${mult.toFixed(1)}` : '-', inline: true },
        ...(isJackpot ? [{ name: '🔥 JACKPOT', value: 'Félicitations ! Tu as décroché le gros lot !', inline: false }] : []),
      )
      .setColor(color)
      .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.editReply({ embeds: [resultEmbed] });

  } catch (error) {
    logger.error('Slot machine error', { err: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Une erreur est survenue lors du tirage.')] });
  }
}
