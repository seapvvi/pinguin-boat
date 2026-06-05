import { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction, Client } from 'discord.js';

export type InteractionHandler<T extends ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction> = (
  interaction: T,
  client: Client,
) => Promise<void>;

export interface HandlerRegistration<T extends ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction> {
  customId: string;
  type: 'exact' | 'prefix';
  handler: InteractionHandler<T>;
}

class InteractionRegistry {
  private buttonHandlers = new Map<string, HandlerRegistration<ButtonInteraction>>();
  private modalHandlers = new Map<string, HandlerRegistration<ModalSubmitInteraction>>();
  private selectHandlers = new Map<string, HandlerRegistration<StringSelectMenuInteraction>>();

  registerButton(customId: string, type: 'exact' | 'prefix', handler: InteractionHandler<ButtonInteraction>): void {
    this.buttonHandlers.set(customId, { customId, type, handler });
  }

  registerModal(customId: string, type: 'exact' | 'prefix', handler: InteractionHandler<ModalSubmitInteraction>): void {
    this.modalHandlers.set(customId, { customId, type, handler });
  }

  registerSelect(customId: string, type: 'exact' | 'prefix', handler: InteractionHandler<StringSelectMenuInteraction>): void {
    this.selectHandlers.set(customId, { customId, type, handler });
  }

  findButtonHandler(customId: string): HandlerRegistration<ButtonInteraction> | undefined {
    // Check exact match first
    const exact = this.buttonHandlers.get(customId);
    if (exact) return exact;

    // Check prefix matches
    for (const [key, registration] of this.buttonHandlers.entries()) {
      if (registration.type === 'prefix' && customId.startsWith(key)) {
        return registration;
      }
    }

    return undefined;
  }

  findModalHandler(customId: string): HandlerRegistration<ModalSubmitInteraction> | undefined {
    // Check exact match first
    const exact = this.modalHandlers.get(customId);
    if (exact) return exact;

    // Check prefix matches
    for (const [key, registration] of this.modalHandlers.entries()) {
      if (registration.type === 'prefix' && customId.startsWith(key)) {
        return registration;
      }
    }

    return undefined;
  }

  findSelectHandler(customId: string): HandlerRegistration<StringSelectMenuInteraction> | undefined {
    // Check exact match first
    const exact = this.selectHandlers.get(customId);
    if (exact) return exact;

    // Check prefix matches
    for (const [key, registration] of this.selectHandlers.entries()) {
      if (registration.type === 'prefix' && customId.startsWith(key)) {
        return registration;
      }
    }

    return undefined;
  }
}

export const registry = new InteractionRegistry();
