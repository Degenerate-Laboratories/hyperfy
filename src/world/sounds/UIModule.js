import { SoundModule } from '../../core/systems/SoundManager'

/**
 * UI Sound Module
 *
 * Handles all UI interaction sounds:
 * - Button clicks
 * - Menu navigation
 * - Notifications
 * - Inventory actions
 *
 * Auto-registers with SoundManager.
 */
export class UIModule extends SoundModule {
  /**
   * Define all UI sounds
   */
  getSounds() {
    return {
      // Button interactions
      ui_button_click: {
        url: 'asset://sounds/ui/button_click.wav',
        volume: 0.5,
        spatial: false,
        category: 'ui',
      },
      ui_button_hover: {
        url: 'asset://sounds/ui/button_hover.wav',
        volume: 0.3,
        spatial: false,
        category: 'ui',
      },

      // Menu navigation
      ui_menu_open: {
        url: 'asset://sounds/ui/menu_open.wav',
        volume: 0.6,
        spatial: false,
        category: 'ui',
      },
      ui_menu_close: {
        url: 'asset://sounds/ui/menu_close.wav',
        volume: 0.6,
        spatial: false,
        category: 'ui',
      },

      // Notifications
      ui_notification: {
        url: 'asset://sounds/ui/notification.wav',
        volume: 0.7,
        spatial: false,
        category: 'ui',
      },
      ui_error: {
        url: 'asset://sounds/ui/error.wav',
        volume: 0.8,
        spatial: false,
        category: 'ui',
      },
      ui_success: {
        url: 'asset://sounds/ui/success.wav',
        volume: 0.7,
        spatial: false,
        category: 'ui',
      },

      // Inventory
      ui_item_pickup: {
        url: 'asset://sounds/ui/item_pickup.wav',
        volume: 0.6,
        spatial: false,
        category: 'ui',
      },
      ui_item_drop: {
        url: 'asset://sounds/ui/item_drop.wav',
        volume: 0.6,
        spatial: false,
        category: 'ui',
      },
      ui_equip: {
        url: 'asset://sounds/ui/equip.wav',
        volume: 0.7,
        spatial: false,
        category: 'ui',
      },
    }
  }

  init(world, soundManager) {
    super.init(world, soundManager)
    console.log('[ui] UI sound module initialized')
  }
}
