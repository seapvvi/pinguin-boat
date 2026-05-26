'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import {
  BookOpen, Shield, Swords, Ticket, ScrollText, Trophy, Wallet,
  Gift, Vote, Lightbulb, DoorOpen, UserPlus, FileText, Settings,
  Music, Crown, ChevronDown, ChevronRight, Terminal, Hash,
} from 'lucide-react';

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  commands?: { name: string; desc: string; usage?: string }[];
  features?: string[];
}

const SECTIONS: Section[] = [
  {
    id: 'getting-started',
    icon: <BookOpen size={18} />,
    title: 'Démarrage rapide',
    description: 'Comment ajouter Pinguin Boat à votre serveur et effectuer la configuration initiale.',
    features: [
      'Invitez le bot via le bouton "Inviter" dans le sélecteur de serveur.',
      'Assurez-vous que le bot possède les permissions Administrator ou au minimum : ManageChannels, ManageRoles, BanMembers, KickMembers, ManageMessages, SendMessages, EmbedLinks, ReadMessageHistory.',
      'Rendez-vous sur le dashboard puis sélectionnez votre serveur.',
      'Naviguez dans les modules via la barre latérale et configurez chacun selon vos besoins.',
      'Chaque module peut être activé/désactivé indépendamment via le toggle en haut de sa page.',
    ],
  },
  {
    id: 'moderation',
    icon: <Shield size={18} />,
    title: 'Modération',
    description: 'Commandes de modération manuelle pour gérer les membres de votre serveur.',
    commands: [
      { name: '/ban', desc: 'Bannir un membre du serveur.', usage: '/ban @utilisateur [raison] [durée]' },
      { name: '/unban', desc: 'Débannir un utilisateur.', usage: '/unban <id> [raison]' },
      { name: '/kick', desc: 'Expulser un membre du serveur.', usage: '/kick @utilisateur [raison]' },
      { name: '/mute', desc: 'Rendre un membre muet (timeout Discord).', usage: '/mute @utilisateur <durée> [raison]' },
      { name: '/unmute', desc: 'Retirer le timeout d\'un membre.', usage: '/unmute @utilisateur [raison]' },
      { name: '/warn', desc: 'Avertir un membre. Les avertissements sont enregistrés.', usage: '/warn @utilisateur <raison>' },
      { name: '/warnings', desc: 'Voir les avertissements d\'un membre.', usage: '/warnings @utilisateur' },
      { name: '/clearwarns', desc: 'Effacer tous les avertissements d\'un membre.', usage: '/clearwarns @utilisateur' },
      { name: '/purge', desc: 'Supprimer un nombre de messages dans un salon.', usage: '/purge <nombre> [@utilisateur]' },
      { name: '/slowmode', desc: 'Définir le slowmode d\'un salon.', usage: '/slowmode <secondes>' },
      { name: '/lock', desc: 'Verrouiller un salon (interdire d\'écrire).', usage: '/lock [salon]' },
      { name: '/unlock', desc: 'Déverrouiller un salon.', usage: '/unlock [salon]' },
      { name: '/case', desc: 'Voir les détails d\'un cas de modération.', usage: '/case <id>' },
      { name: '/modlogs', desc: 'Voir l\'historique de modération d\'un membre.', usage: '/modlogs @utilisateur' },
    ],
  },
  {
    id: 'automod',
    icon: <Swords size={18} />,
    title: 'Auto-Modération',
    description: 'Filtres automatiques pour protéger votre serveur sans intervention manuelle.',
    features: [
      'Filtre anti-spam : détecte et supprime les messages répétitifs ou envoyés trop rapidement.',
      'Filtre anti-liens : bloque les URLs et invitations Discord non autorisées.',
      'Filtre anti-mentions : limite les mentions en masse (@everyone, @here, rôles).',
      'Filtre anti-majuscules : réduit les messages entièrement en majuscules.',
      'Filtre de mots interdits : liste personnalisable de mots/expressions bloqués.',
      'Actions configurables : supprimer, avertir, mute temporaire selon le niveau de violation.',
      'Whitelist de rôles et salons pour exclure certains membres ou zones de l\'auto-modération.',
    ],
  },
  {
    id: 'protection',
    icon: <Swords size={18} />,
    title: 'Protection Anti-Raid',
    description: 'Protège votre serveur contre les raids et les bots malveillants.',
    features: [
      'Mode verification : impose une vérification aux nouveaux membres avant d\'accéder au serveur.',
      'Anti-join rapide : détecte les vagues de jointures et déclenche une alerte ou un lockdown.',
      'Lockdown automatique : verrouille tous les salons configurés en cas de raid détecté.',
      'Whitelist IP/compte : exempte certains membres de confiance des restrictions.',
      'Alertes en temps réel : notification dans un salon de log lors d\'une tentative de raid.',
    ],
  },
  {
    id: 'tickets',
    icon: <Ticket size={18} />,
    title: 'Tickets',
    description: 'Système de support avec tickets privés créés par les membres.',
    features: [
      'Panneau de tickets : créez un message avec bouton de création de ticket via le dashboard.',
      'Catégories multiples : définissez plusieurs types de tickets (support, report, candidature…).',
      'Permissions automatiques : le salon privé n\'est visible que par le membre et le staff.',
      'Transcriptions : sauvegardez le contenu d\'un ticket à sa fermeture.',
      'Commandes staff : /ticket close, /ticket add, /ticket remove, /ticket rename.',
    ],
    commands: [
      { name: '/ticket close', desc: 'Fermer le ticket actuel.', usage: '/ticket close [raison]' },
      { name: '/ticket add', desc: 'Ajouter un membre au ticket.', usage: '/ticket add @utilisateur' },
      { name: '/ticket remove', desc: 'Retirer un membre du ticket.', usage: '/ticket remove @utilisateur' },
    ],
  },
  {
    id: 'logs',
    icon: <ScrollText size={18} />,
    title: 'Logs',
    description: 'Journalisation des événements du serveur dans un salon dédié.',
    features: [
      'Événements disponibles : messages supprimés/modifiés, entrées/sorties membres, modifications de rôles, changements de salons, actions de modération, mises à jour vocales.',
      'Sélection granulaire : activez uniquement les événements dont vous avez besoin.',
      'Salon de log dédié : configurez un salon spécifique pour recevoir les logs.',
      'Ignorer des salons ou des utilisateurs : excluez certaines zones ou membres des logs.',
    ],
  },
  {
    id: 'levels',
    icon: <Trophy size={18} />,
    title: 'Niveaux / XP',
    description: 'Système de progression basé sur l\'activité des membres.',
    features: [
      'XP gagné automatiquement en envoyant des messages (configurable : min/max XP par message, cooldown).',
      'Annonce de passage de niveau dans un salon configurable ou en MP.',
      'Récompenses de rôles : attribuez automatiquement des rôles à certains paliers de niveau.',
      'Classement : commande /rank et /leaderboard pour voir sa position.',
      'Multiplicateurs de XP par rôle ou par salon.',
      'Réinitialisation du niveau d\'un membre : /xp reset @membre.',
    ],
    commands: [
      { name: '/rank', desc: 'Voir votre niveau et XP actuels.', usage: '/rank [@utilisateur]' },
      { name: '/leaderboard', desc: 'Afficher le classement XP du serveur.', usage: '/leaderboard' },
      { name: '/xp give', desc: 'Donner des XP à un membre (staff).', usage: '/xp give @utilisateur <montant>' },
      { name: '/xp remove', desc: 'Retirer des XP à un membre (staff).', usage: '/xp remove @utilisateur <montant>' },
      { name: '/xp reset', desc: 'Réinitialiser les XP d\'un membre (staff).', usage: '/xp reset @utilisateur' },
    ],
  },
  {
    id: 'economy',
    icon: <Wallet size={18} />,
    title: 'Économie',
    description: 'Système de monnaie virtuelle et de boutique pour votre serveur.',
    features: [
      'Monnaie virtuelle personnalisable (nom, symbole, emoji).',
      'Gains quotidiens, hebdomadaires et travail via commandes.',
      'Boutique : créez des articles achetables avec la monnaie du serveur.',
      'Transferts entre membres, classement des richesses.',
      'Intégration avec les niveaux : bonus économiques à certains paliers.',
    ],
    commands: [
      { name: '/balance', desc: 'Voir votre solde.', usage: '/balance [@utilisateur]' },
      { name: '/daily', desc: 'Récupérer votre bonus quotidien.', usage: '/daily' },
      { name: '/work', desc: 'Travailler pour gagner des coins.', usage: '/work' },
      { name: '/pay', desc: 'Payer un autre membre.', usage: '/pay @utilisateur <montant>' },
      { name: '/shop', desc: 'Voir la boutique du serveur.', usage: '/shop' },
      { name: '/buy', desc: 'Acheter un article de la boutique.', usage: '/buy <nom_article>' },
      { name: '/leaderboard money', desc: 'Classement des fortunes.', usage: '/leaderboard money' },
    ],
  },
  {
    id: 'giveaways',
    icon: <Gift size={18} />,
    title: 'Giveaways',
    description: 'Organisez des concours et tirages au sort sur votre serveur.',
    features: [
      'Création de giveaway avec durée, nombre de gagnants et description.',
      'Participation via réaction ou bouton.',
      'Tirage automatique à la fin du délai.',
      'Reroll : re-tirer de nouveaux gagnants si un gagnant ne répond pas.',
      'Annulation d\'un giveaway en cours.',
      'Conditions de participation configurables (rôle requis).',
    ],
    commands: [
      { name: '/giveaway start', desc: 'Démarrer un giveaway.', usage: '/giveaway start <durée> <gagnants> <prix>' },
      { name: '/giveaway end', desc: 'Terminer un giveaway immédiatement.', usage: '/giveaway end <id>' },
      { name: '/giveaway reroll', desc: 'Re-tirer les gagnants.', usage: '/giveaway reroll <id>' },
      { name: '/giveaway cancel', desc: 'Annuler un giveaway.', usage: '/giveaway cancel <id>' },
    ],
  },
  {
    id: 'polls',
    icon: <Vote size={18} />,
    title: 'Sondages',
    description: 'Créez des sondages interactifs pour consulter votre communauté.',
    features: [
      'Sondages à choix multiples avec jusqu\'à 10 options.',
      'Durée configurable avec clôture automatique.',
      'Résultats en temps réel affichés dans l\'embed.',
      'Vote unique par membre.',
    ],
    commands: [
      { name: '/poll', desc: 'Créer un sondage.', usage: '/poll <question> [option1] [option2] … [durée]' },
      { name: '/poll end', desc: 'Terminer un sondage manuellement.', usage: '/poll end <id>' },
    ],
  },
  {
    id: 'suggestions',
    icon: <Lightbulb size={18} />,
    title: 'Suggestions',
    description: 'Permettez aux membres de soumettre des suggestions via le bot.',
    features: [
      'Salon de suggestions configurable.',
      'Soumission via commande, vote communautaire avec reactions (+1 / -1).',
      'Gestion des suggestions : approuver, refuser, commenter (staff).',
      'Notifications optionnelles à l\'auteur lors d\'une décision.',
    ],
    commands: [
      { name: '/suggest', desc: 'Soumettre une suggestion.', usage: '/suggest <texte>' },
      { name: '/suggestion approve', desc: 'Approuver une suggestion (staff).', usage: '/suggestion approve <id> [commentaire]' },
      { name: '/suggestion deny', desc: 'Refuser une suggestion (staff).', usage: '/suggestion deny <id> [raison]' },
    ],
  },
  {
    id: 'welcome',
    icon: <DoorOpen size={18} />,
    title: 'Bienvenue',
    description: 'Messages d\'accueil et d\'au revoir personnalisés.',
    features: [
      'Message de bienvenue configurable avec variables : {user}, {server}, {count}.',
      'Message d\'au revoir pour les membres quittant le serveur.',
      'Embed personnalisable : couleur, image, description, footer.',
      'Mention de l\'utilisateur dans le message.',
    ],
  },
  {
    id: 'autoroles',
    icon: <UserPlus size={18} />,
    title: 'Auto-Rôles',
    description: 'Attribution automatique de rôles lors de l\'arrivée d\'un nouveau membre.',
    features: [
      'Jusqu\'à 5 rôles attribués automatiquement à l\'arrivée.',
      'Rôles séparés pour bots et humains.',
      'Délai configurable avant attribution (anti-raid).',
    ],
  },
  {
    id: 'embeds',
    icon: <FileText size={18} />,
    title: 'Embeds',
    description: 'Créez et envoyez des messages embed personnalisés dans vos salons.',
    features: [
      'Éditeur d\'embed complet : titre, description, couleur, image, footer, auteur, champs.',
      'Envoi dans n\'importe quel salon du serveur.',
      'Sauvegarde et réutilisation de templates.',
      'Prévisualisation avant envoi.',
    ],
  },
  {
    id: 'music',
    icon: <Music size={18} />,
    title: 'Musique',
    description: 'Lecture de musique dans les salons vocaux depuis YouTube.',
    commands: [
      { name: '/play', desc: 'Lancer une musique par URL ou recherche.', usage: '/play <url ou recherche>' },
      { name: '/pause', desc: 'Mettre en pause la lecture.', usage: '/pause' },
      { name: '/resume', desc: 'Reprendre la lecture.', usage: '/resume' },
      { name: '/skip', desc: 'Passer à la piste suivante.', usage: '/skip' },
      { name: '/stop', desc: 'Arrêter la musique et vider la queue.', usage: '/stop' },
      { name: '/queue', desc: 'Voir la file d\'attente.', usage: '/queue' },
      { name: '/volume', desc: 'Régler le volume (0–100).', usage: '/volume <0-100>' },
      { name: '/loop', desc: 'Activer/désactiver la répétition.', usage: '/loop' },
      { name: '/shuffle', desc: 'Mélanger la queue.', usage: '/shuffle' },
      { name: '/nowplaying', desc: 'Voir la piste en cours.', usage: '/nowplaying' },
    ],
  },
  {
    id: 'settings',
    icon: <Settings size={18} />,
    title: 'Paramètres',
    description: 'Configuration générale du bot sur votre serveur.',
    features: [
      'Préfixe de commande legacy (si applicable).',
      'Langue du bot (français/anglais).',
      'Salon d\'annonces, salon de règles.',
      'Rôles staff (modération, admin) reconnus par le bot.',
      'Retirer le bot du serveur proprement depuis le dashboard.',
    ],
  },
  {
    id: 'donor',
    icon: <Crown size={18} />,
    title: 'Avantages Donateurs',
    description: 'Fonctionnalités exclusives débloquées par un don de 5€ minimum sur Ko-fi.',
    features: [
      'Thèmes dashboard exclusifs : Gold, Aurora, Crimson, Synthwave, Everforest, Cobalt2, et plus à venir.',
      'Flocons de neige animés dans la sidebar.',
      'Badge Donateur sur votre profil (icone coeur).',
      'Rôle exclusif + salon privé sur le serveur Discord officiel.',
      'Accès anticipé aux nouvelles fonctionnalités en bêta.',
      'Vote prioritaire sur la roadmap du projet.',
      'Pour activer vos privilèges : faites un don de 5€+ sur ko-fi.com/pvvi en indiquant votre ID Discord dans le message.',
    ],
  },
];

export default function DocsPage() {
  const [openSection, setOpenSection] = useState<string | null>('getting-started');

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 820, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <BookOpen size={22} style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Documentation</h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
          Guide complet de tous les modules et commandes de Pinguin Boat.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {SECTIONS.map((section) => {
          const isOpen = openSection === section.id;
          return (
            <div
              key={section.id}
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                overflow: 'hidden',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <button
                type="button"
                onClick={() => setOpenSection(isOpen ? null : section.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 12,
                  padding: '12px 16px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: 'var(--accent)' }}>{section.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{section.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{section.description}</div>
                  </div>
                </div>
                {isOpen
                  ? <ChevronDown size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                  : <ChevronRight size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                }
              </button>

              {isOpen && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-color)' }}>
                  {section.features && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Hash size={12} style={{ color: 'var(--text-secondary)' }} />
                        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>Fonctionnalités</span>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {section.features.map((f, i) => (
                          <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {section.commands && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Terminal size={12} style={{ color: 'var(--text-secondary)' }} />
                        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>Commandes</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {section.commands.map((cmd) => (
                          <div
                            key={cmd.name}
                            style={{
                              display: 'flex', gap: 12, padding: '8px 10px',
                              borderRadius: 4, backgroundColor: 'var(--bg-surface-alt)',
                              border: '1px solid var(--border-color)',
                              alignItems: 'flex-start',
                            }}
                          >
                            <code style={{
                              fontSize: 12, fontWeight: 600, color: 'var(--accent)',
                              whiteSpace: 'nowrap', flexShrink: 0,
                              fontFamily: 'var(--font-jetbrains, monospace)',
                            }}>
                              {cmd.usage ?? cmd.name}
                            </code>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{cmd.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
