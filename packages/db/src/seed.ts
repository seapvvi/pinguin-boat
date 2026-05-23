import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seed...\n');

  // ─── Plans Premium ───

  const plans = [
    {
      name: 'FREE',
      description: 'Plan gratuit avec les fonctionnalités de base',
      price: 0,
      maxGuilds: 1,
      features: JSON.stringify([
        'moderation',
        'levels',
        'music',
        'logs',
        'giveaways',
        'polls',
        'suggestions',
        'welcome',
        'autoroles',
      ]),
    },
    {
      name: 'BASIC',
      description: 'Plan de base pour serveurs en croissance',
      price: 499,
      maxGuilds: 3,
      features: JSON.stringify([
        'moderation',
        'levels',
        'music',
        'logs',
        'giveaways',
        'polls',
        'suggestions',
        'welcome',
        'autoroles',
        'tickets',
        'embeds',
        'premium_support',
        'custom_prefix',
      ]),
    },
    {
      name: 'PRO',
      description: 'Plan professionnel pour serveurs actifs',
      price: 999,
      maxGuilds: 10,
      features: JSON.stringify([
        'moderation',
        'protection',
        'levels',
        'music',
        'logs',
        'giveaways',
        'polls',
        'suggestions',
        'welcome',
        'autoroles',
        'tickets',
        'embeds',
        'economy',
        'premium_support',
        'custom_prefix',
        'advanced_logs',
        'multi_guild',
        'priority_support',
        'custom_branding',
      ]),
    },
    {
      name: 'ENTERPRISE',
      description: 'Plan entreprise avec accès illimité',
      price: 2999,
      maxGuilds: -1,
      features: JSON.stringify([
        'moderation',
        'protection',
        'levels',
        'music',
        'logs',
        'giveaways',
        'polls',
        'suggestions',
        'welcome',
        'autoroles',
        'tickets',
        'embeds',
        'economy',
        'premium_support',
        'custom_prefix',
        'advanced_logs',
        'multi_guild',
        'priority_support',
        'custom_branding',
        'early_access',
        'api_access',
      ]),
    },
  ];

  for (const plan of plans) {
    const created = await prisma.premiumPlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
    console.log(`  ✓ Plan premium créé : ${created.name} (${created.price}¢)`);
  }

  console.log('');

  // ─── Premium Feature Flags ───

  const featureFlags = [
    { key: 'MODERATION', name: 'Modération', description: 'Commandes de modération complètes' },
    { key: 'PROTECTION', name: 'Protection', description: 'Protection anti-raid et anti-spam' },
    { key: 'TICKETS', name: 'Tickets', description: 'Système de tickets de support' },
    { key: 'LOGS', name: 'Logs', description: 'Journaux d\'audit configurables' },
    { key: 'LEVELS', name: 'Niveaux', description: 'Système d\'XP et niveaux' },
    { key: 'ECONOMY', name: 'Économie', description: 'Système économique avec wallet et banque' },
    { key: 'MUSIC', name: 'Musique', description: 'Lecteur musical avec file d\'attente' },
    { key: 'GIVEAWAYS', name: 'Giveaways', description: 'Organisation de concours' },
    { key: 'POLLS', name: 'Sondages', description: 'Création de sondages' },
    { key: 'SUGGESTIONS', name: 'Suggestions', description: 'Système de suggestions' },
    { key: 'WELCOME', name: 'Bienvenue', description: 'Messages de bienvenue et d\'au revoir' },
    { key: 'AUTOROLES', name: 'Rôles Auto', description: 'Attribution automatique de rôles' },
    { key: 'EMBEDS', name: 'Embeds', description: 'Embeds personnalisés sauvegardés' },
    { key: 'CUSTOM_PREFIX', name: 'Préfixe personnalisé', description: 'Préfixe de commande personnalisé' },
    { key: 'MULTI_GUILD', name: 'Multi-Serveur', description: 'Utilisation sur plusieurs serveurs' },
    { key: 'PREMIUM_SUPPORT', name: 'Support Prioritaire', description: 'Accès au support prioritaire' },
    { key: 'ADVANCED_LOGS', name: 'Logs Avancés', description: 'Options de logs détaillées' },
    { key: 'CUSTOM_BRANDING', name: 'Marque personnalisée', description: 'Personnalisation de la marque' },
    { key: 'EARLY_ACCESS', name: 'Accès Anticipé', description: 'Accès aux fonctionnalités en avant-première' },
    { key: 'API_ACCESS', name: 'Accès API', description: 'Accès à l\'API publique du bot' },
  ];

  for (const flag of featureFlags) {
    const created = await prisma.premiumFeatureFlag.upsert({
      where: { key: flag.key },
      update: { name: flag.name, description: flag.description },
      create: { ...flag, minTier: 'FREE', enabled: true },
    });
    console.log(`  ✓ Feature flag premium : ${created.key} - ${created.name}`);
  }

  console.log('');

  // ─── Feature Flags globaux ───

  const globalFlags = [
    {
      key: 'ALPHA_ALL_FREE',
      name: 'Alpha Gratuit',
      description: 'Toutes les fonctionnalités premium sont accessibles gratuitement (phase alpha)',
      enabled: true,
    },
  ];

  for (const flag of globalFlags) {
    const created = await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: flag,
      create: flag,
    });
    console.log(`  ✓ Feature flag global : ${created.key} (enabled: ${created.enabled})`);
  }

  console.log('\n✅ Seed terminé avec succès !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
