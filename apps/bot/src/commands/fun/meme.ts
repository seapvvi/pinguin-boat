import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
} from 'discord.js';
import { createEmbed } from '../../services/embed';

interface MemeApiResponse {
  title?: string;
  url?: string;
  postLink?: string;
  subreddit?: string;
  author?: string;
  ups?: number;
  nsfw?: boolean;
  spoiler?: boolean;
}

export const data = new SlashCommandBuilder()
  .setName('meme')
  .setDescription('Affiche un meme aléatoire')
  .addStringOption((option) =>
    option
      .setName('subreddit')
      .setDescription('Subreddit spécifique (ex: memes, dankmemes, ...)')
      .setRequired(false)
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  _client: Client
): Promise<void> {
  await interaction.deferReply();

  const subreddit = interaction.options.getString('subreddit')?.trim();
  // meme-api.com returns a random meme as JSON; optionally scoped to a subreddit.
  const endpoint = subreddit
    ? `https://meme-api.com/gimme/${encodeURIComponent(subreddit)}`
    : 'https://meme-api.com/gimme';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      await interaction.editReply({
        content: subreddit
          ? `Impossible de récupérer un meme depuis r/${subreddit}. Vérifie le nom du subreddit.`
          : 'Impossible de récupérer un meme pour le moment. Réessaie plus tard.',
      });
      return;
    }

    const meme = (await res.json()) as MemeApiResponse;

    if (!meme.url) {
      await interaction.editReply({
        content: 'Aucun meme trouvé. Réessaie plus tard.',
      });
      return;
    }

    // Respect channel NSFW settings: skip NSFW memes in non-NSFW channels.
    const channel = interaction.channel;
    const isNsfwChannel =
      channel && 'nsfw' in channel ? Boolean((channel as { nsfw?: boolean }).nsfw) : false;
    if (meme.nsfw && !isNsfwChannel) {
      await interaction.editReply({
        content: 'Le meme récupéré est NSFW et ce salon ne l\'autorise pas. Réessaie.',
      });
      return;
    }

    const embed: EmbedBuilder = createEmbed('default')
      .setTitle(meme.title?.slice(0, 256) || 'Meme')
      .setImage(meme.url)
      .setURL(meme.postLink ?? null)
      .setFooter({
        text: [
          meme.subreddit ? `r/${meme.subreddit}` : null,
          typeof meme.ups === 'number' ? `👍 ${meme.ups}` : null,
        ]
          .filter(Boolean)
          .join(' • ') || 'meme',
      });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[Meme] Erreur lors de la récupération du meme:', err);
    await interaction.editReply({
      content: 'Une erreur est survenue lors de la récupération du meme. Réessaie plus tard.',
    });
  }
}
