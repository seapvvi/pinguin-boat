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

function spinReels(): string[] {
  return Array(3).fill(null).map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
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

    const reels = spinReels();
    const payout = calculatePayout(reels, bet);

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

    if (payout >= bet * 50) {
      await prisma.jackpotWin.create({
        data: {
          guildId: interaction.guild!.id,
          userId: interaction.user.id,
          bet,
          payout,
          symbols: reels.join(' '),
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
    await endGameSession(session.id, payout > 0 ? 'won' : 'lost', payout - bet);

    const display = reels.join(' │ ');
    const isJackpot = payout >= bet * 50;
    const isWin = payout > 0;

    const embed = createEmbed('minigame')
      .setTitle(isJackpot ? '🎰 💥 JACKPOT !!! 💥' : isWin ? '🎰 Gagné !' : '🎰 Perdu...')
      .setDescription(
        `\`\`\`\n╔═══════════╗\n║ ${display} ║\n╚═══════════╝\n\`\`\`` +
        (isJackpot ? '\n\n🔥 **JACKPOT !** 🔥' : '')
      )
      .addFields(
        { name: 'Mise', value: `${bet} ${economySettings.currencySymbol}`, inline: true },
        { name: 'Gain', value: payout > 0 ? `**+${payout}** ${economySettings.currencySymbol}` : `**0** ${economySettings.currencySymbol}`, inline: true },
        { name: 'Multiplicateur', value: payout > 0 ? `x${(payout / bet).toFixed(1)}` : '-', inline: true }
      )
      .setColor(isJackpot ? 0xffd700 : isWin ? 0x22c55e : 0xef4444)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    logger.error('Slot machine error', { err: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Une erreur est survenue lors du tirage.')] });
  }
}
